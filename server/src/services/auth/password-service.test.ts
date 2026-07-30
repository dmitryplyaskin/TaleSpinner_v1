import { describe, expect, test } from "vitest";

import { resolveAccessPolicy } from "../../core/auth/access-policy";

import {
  createPasswordHash,
  verifyPassword,
} from "./password-service";

describe("password service", () => {
  test("allows an empty password only in local mode", async () => {
    await expect(
      createPasswordHash("", resolveAccessPolicy({}))
    ).resolves.toBeNull();

    await expect(
      createPasswordHash(
        "",
        resolveAccessPolicy({ TALESPINNER_ACCESS_MODE: "public" })
      )
    ).rejects.toThrow(/required/i);
  });

  test("hashes non-empty passwords with Argon2id", async () => {
    const hash = await createPasswordHash(
      "correct horse battery staple",
      resolveAccessPolicy({})
    );

    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(
      verifyPassword(hash, "correct horse battery staple")
    ).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
  });

  test("requires a stronger password in public mode", async () => {
    const policy = resolveAccessPolicy({
      TALESPINNER_ACCESS_MODE: "public",
    });

    await expect(createPasswordHash("short", policy)).rejects.toThrow(
      /at least 10/
    );
  });
});
