import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { bootstrapApp, createApp } from "../app";
import { resetDbForTests } from "../db/client";

describe("auth API in local mode", () => {
  let tempDir = "";
  let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
  let baseUrl = "";
  let previousMode: string | undefined;

  beforeEach(async () => {
    previousMode = process.env.TALESPINNER_ACCESS_MODE;
    process.env.TALESPINNER_ACCESS_MODE = "local";
    resetDbForTests();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "talespinner-auth-api-"));
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
    if (typeof previousMode === "string") {
      process.env.TALESPINNER_ACCESS_MODE = previousMode;
    } else {
      delete process.env.TALESPINNER_ACCESS_MODE;
    }
  });

  function cookieFrom(response: Response): string {
    const header = response.headers.get("set-cookie");
    if (!header) throw new Error("Missing session cookie");
    return header.split(";")[0];
  }

  test("requires setup, creates the first admin, and protects app APIs", async () => {
    const initialStatus = await fetch(`${baseUrl}/auth/status`);
    await expect(initialStatus.json()).resolves.toMatchObject({
      data: {
        mode: "local",
        setupRequired: true,
        authenticated: false,
      },
    });

    const denied = await fetch(`${baseUrl}/user-persons`);
    expect(denied.status).toBe(401);

    const setup = await fetch(`${baseUrl}/auth/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "" }),
    });
    expect(setup.status).toBe(201);
    const cookie = cookieFrom(setup);
    await expect(setup.json()).resolves.toMatchObject({
      data: {
        user: {
          id: "global",
          username: "alice",
          role: "admin",
          hasPassword: false,
        },
      },
    });

    const allowed = await fetch(`${baseUrl}/user-persons`, {
      headers: { cookie },
    });
    expect(allowed.status).toBe(200);
  });

  test("supports multiple passwordless local accounts", async () => {
    const setup = await fetch(`${baseUrl}/auth/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "" }),
    });
    const adminCookie = cookieFrom(setup);
    const adminPersonaResponse = await fetch(`${baseUrl}/user-persons`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: adminCookie,
      },
      body: JSON.stringify({ name: "Admin persona" }),
    });
    const adminPersona = (await adminPersonaResponse.json()) as {
      data: { id: string };
    };

    const created = await fetch(`${baseUrl}/auth/users`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: adminCookie,
      },
      body: JSON.stringify({ username: "bob", password: "", role: "user" }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      data: { id: string };
    };

    await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: { cookie: adminCookie },
    });
    const status = await fetch(`${baseUrl}/auth/status`);
    await expect(status.json()).resolves.toMatchObject({
      data: {
        authenticated: false,
        accounts: [
          { username: "admin" },
          { username: "bob" },
        ],
      },
    });

    const login = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: createdBody.data.id,
        password: "",
      }),
    });
    expect(login.status).toBe(200);
    const userCookie = cookieFrom(login);
    await expect(login.json()).resolves.toMatchObject({
      data: { user: { username: "bob", role: "user" } },
    });

    const isolatedList = await fetch(`${baseUrl}/user-persons`, {
      headers: { cookie: userCookie },
    });
    await expect(isolatedList.json()).resolves.toMatchObject({ data: [] });

    const directRead = await fetch(
      `${baseUrl}/user-persons/${adminPersona.data.id}`,
      { headers: { cookie: userCookie } }
    );
    expect(directRead.status).toBe(404);
  });
});
