import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { bootstrapApp, createApp } from "../app";
import { resetDbForTests } from "../db/client";

const PUBLIC_ENV = {
  TALESPINNER_ACCESS_MODE: "public",
  TALESPINNER_SESSION_SECRET: "public-session-secret-value-123456789",
  TALESPINNER_SETUP_TOKEN: "public-setup-token",
  TALESPINNER_TRUST_PROXY: "true",
} as const;

describe("auth API in public mode", () => {
  let tempDir = "";
  let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
  let baseUrl = "";
  const previous = new Map<string, string | undefined>();

  beforeEach(async () => {
    for (const [key, value] of Object.entries(PUBLIC_ENV)) {
      previous.set(key, process.env[key]);
      process.env[key] = value;
    }
    resetDbForTests();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "talespinner-public-auth-"));
    await bootstrapApp({ dbPath: path.join(tempDir, "db.sqlite") });
    const app = createApp();
    server = await new Promise((resolve) => {
      const started = app.listen(0, "127.0.0.1", () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing address");
    baseUrl = `http://127.0.0.1:${address.port}/api`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    resetDbForTests();
    await fs.rm(tempDir, { recursive: true, force: true });
    for (const key of Object.keys(PUBLIC_ENV)) {
      const value = previous.get(key);
      if (typeof value === "string") process.env[key] = value;
      else delete process.env[key];
    }
  });

  const secureHeaders = {
    "content-type": "application/json",
    "x-forwarded-proto": "https",
  };

  test("requires HTTPS and a setup token, then issues hardened cookies", async () => {
    const insecure = await fetch(`${baseUrl}/auth/status`);
    expect(insecure.status).toBe(426);
    expect(insecure.headers.get("x-frame-options")).toBe("DENY");

    const rejected = await fetch(`${baseUrl}/auth/setup`, {
      method: "POST",
      headers: secureHeaders,
      body: JSON.stringify({
        username: "admin",
        password: "strong-password",
      }),
    });
    expect(rejected.status).toBe(403);

    const setup = await fetch(`${baseUrl}/auth/setup`, {
      method: "POST",
      headers: {
        ...secureHeaders,
        "x-setup-token": PUBLIC_ENV.TALESPINNER_SETUP_TOKEN,
      },
      body: JSON.stringify({
        username: "admin",
        password: "strong-password",
      }),
    });
    expect(setup.status).toBe(201);
    expect(setup.headers.get("set-cookie")).toMatch(/HttpOnly.*Secure.*SameSite=Strict/);
    await expect(setup.json()).resolves.toMatchObject({
      data: {
        user: { role: "admin", hasPassword: true },
        csrfToken: expect.any(String),
      },
    });
  });

  test("requires CSRF for authenticated mutations", async () => {
    const setup = await fetch(`${baseUrl}/auth/setup`, {
      method: "POST",
      headers: {
        ...secureHeaders,
        "x-setup-token": PUBLIC_ENV.TALESPINNER_SETUP_TOKEN,
      },
      body: JSON.stringify({
        username: "admin",
        password: "strong-password",
      }),
    });
    const body = (await setup.json()) as {
      data: { csrfToken: string };
    };
    const cookie = setup.headers.get("set-cookie")?.split(";")[0] ?? "";

    const rejected = await fetch(`${baseUrl}/auth/users`, {
      method: "POST",
      headers: { ...secureHeaders, cookie },
      body: JSON.stringify({
        username: "bob",
        password: "another-strong-password",
      }),
    });
    expect(rejected.status).toBe(403);

    const accepted = await fetch(`${baseUrl}/auth/users`, {
      method: "POST",
      headers: {
        ...secureHeaders,
        cookie,
        "x-csrf-token": body.data.csrfToken,
      },
      body: JSON.stringify({
        username: "bob",
        password: "another-strong-password",
      }),
    });
    expect(accepted.status).toBe(201);
  });
});
