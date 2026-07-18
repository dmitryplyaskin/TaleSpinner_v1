import { describe, expect, test } from "vitest";

import { createApp } from "../../app";

import { resolveServerNetworkPolicy } from "./server-network-policy";

describe("server network policy", () => {
  test("binds to loopback and restricts CORS by default", () => {
    const policy = resolveServerNetworkPolicy({});

    expect(policy.host).toBe("127.0.0.1");
    expect(policy.lanMode).toBe(false);
    expect(policy.isOriginAllowed("http://localhost:5173")).toBe(true);
    expect(policy.isOriginAllowed("http://127.0.0.1:5173")).toBe(true);
    expect(policy.isOriginAllowed("https://attacker.example")).toBe(false);
  });

  test("requires explicit LAN opt-in before honoring a public host", () => {
    expect(
      resolveServerNetworkPolicy({ TALESPINNER_HOST: "0.0.0.0" }).host
    ).toBe("127.0.0.1");

    const policy = resolveServerNetworkPolicy({
      TALESPINNER_LAN_MODE: "true",
      TALESPINNER_HOST: "0.0.0.0",
      TALESPINNER_CORS_ORIGINS: "http://192.168.1.20:5173",
    });
    expect(policy.host).toBe("0.0.0.0");
    expect(policy.lanMode).toBe(true);
    expect(policy.isOriginAllowed("http://192.168.1.20:5173")).toBe(true);
    expect(policy.isOriginAllowed("http://192.168.1.21:5173")).toBe(false);
  });

  test("allows requests without an Origin header for local native clients", () => {
    expect(resolveServerNetworkPolicy({}).isOriginAllowed(undefined)).toBe(true);
  });

  test("returns 403 before routing requests from a disallowed origin", async () => {
    const app = createApp();
    const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const started = app.listen(0, "127.0.0.1", () => resolve(started));
    });

    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing test address");
      const response = await fetch(`http://127.0.0.1:${address.port}/api/unknown`, {
        headers: { origin: "https://attacker.example" },
      });
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "ORIGIN_NOT_ALLOWED" },
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
