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
  TALESPINNER_ALLOW_REGISTRATION: "true",
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

  test("rate limits failed logins without penalizing successful logins", async () => {
    await fetch(`${baseUrl}/auth/setup`, {
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

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const successful = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: secureHeaders,
        body: JSON.stringify({
          username: "admin",
          password: "strong-password",
        }),
      });
      expect(successful.status).toBe(200);
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: secureHeaders,
        body: JSON.stringify({
          username: "admin",
          password: "wrong-password",
        }),
      });
      expect(failed.status).toBe(401);
    }

    const blocked = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: secureHeaders,
      body: JSON.stringify({
        username: "admin",
        password: "strong-password",
      }),
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });

  test("supports public registration after setup and rejects duplicates safely", async () => {
    await fetch(`${baseUrl}/auth/setup`, {
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

    const registered = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: secureHeaders,
      body: JSON.stringify({
        username: "bob",
        password: "another-strong-password",
      }),
    });
    expect(registered.status).toBe(201);
    expect(registered.headers.get("set-cookie")).toContain("HttpOnly");

    const duplicate = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: secureHeaders,
      body: JSON.stringify({
        username: "BOB",
        password: "another-strong-password",
      }),
    });
    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toMatchObject({
      error: { code: "USERNAME_TAKEN" },
    });
  });

  test("protects the last admin, revokes disabled sessions, and supports recovery", async () => {
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
    const setupBody = (await setup.json()) as {
      data: { user: { id: string }; csrfToken: string };
    };
    const adminCookie = setup.headers.get("set-cookie")?.split(";")[0] ?? "";
    const adminHeaders = {
      ...secureHeaders,
      cookie: adminCookie,
      "x-csrf-token": setupBody.data.csrfToken,
    };

    const rejected = await fetch(
      `${baseUrl}/auth/users/${setupBody.data.user.id}`,
      {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ status: "disabled" }),
      }
    );
    expect(rejected.status).toBe(409);

    const secondAdmin = await fetch(`${baseUrl}/auth/users`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        username: "second-admin",
        password: "second-admin-password",
        role: "admin",
      }),
    });
    expect(secondAdmin.status).toBe(201);

    const disabled = await fetch(
      `${baseUrl}/auth/users/${setupBody.data.user.id}`,
      {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ status: "disabled" }),
      }
    );
    expect(disabled.status).toBe(200);

    const invalidatedStatus = await fetch(`${baseUrl}/auth/status`, {
      headers: { ...secureHeaders, cookie: adminCookie },
    });
    await expect(invalidatedStatus.json()).resolves.toMatchObject({
      data: { authenticated: false },
    });

    const disabledLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: secureHeaders,
      body: JSON.stringify({
        username: "admin",
        password: "strong-password",
      }),
    });
    expect(disabledLogin.status).toBe(401);
    await expect(disabledLogin.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid username or password.",
      },
    });

    const recovered = await fetch(`${baseUrl}/auth/recover`, {
      method: "POST",
      headers: {
        ...secureHeaders,
        "x-setup-token": PUBLIC_ENV.TALESPINNER_SETUP_TOKEN,
      },
      body: JSON.stringify({
        username: "admin",
        newPassword: "recovered-strong-password",
      }),
    });
    expect(recovered.status).toBe(200);

    const login = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: secureHeaders,
      body: JSON.stringify({
        username: "admin",
        password: "recovered-strong-password",
      }),
    });
    expect(login.status).toBe(200);
  });

  test("rotates credentials while invalidating the previous session", async () => {
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
    const setupBody = (await setup.json()) as {
      data: { csrfToken: string };
    };
    const oldCookie = setup.headers.get("set-cookie")?.split(";")[0] ?? "";

    const changed = await fetch(`${baseUrl}/auth/password`, {
      method: "POST",
      headers: {
        ...secureHeaders,
        cookie: oldCookie,
        "x-csrf-token": setupBody.data.csrfToken,
      },
      body: JSON.stringify({
        currentPassword: "strong-password",
        newPassword: "replacement-password",
      }),
    });
    expect(changed.status).toBe(200);
    expect(changed.headers.get("set-cookie")).toContain("HttpOnly");

    const oldStatus = await fetch(`${baseUrl}/auth/status`, {
      headers: { ...secureHeaders, cookie: oldCookie },
    });
    await expect(oldStatus.json()).resolves.toMatchObject({
      data: { authenticated: false },
    });

    const oldLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: secureHeaders,
      body: JSON.stringify({
        username: "admin",
        password: "strong-password",
      }),
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: secureHeaders,
      body: JSON.stringify({
        username: "admin",
        password: "replacement-password",
      }),
    });
    expect(newLogin.status).toBe(200);
  });
});
