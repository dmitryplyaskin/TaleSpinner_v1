import argon2 from "argon2";

import type { AccessPolicy } from "../../core/auth/access-policy";

const PUBLIC_PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 1024;

function validatePassword(password: string, policy: AccessPolicy): void {
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`);
  }
  if (policy.passwordRequired && password.length === 0) {
    throw new Error("Password is required in public access mode.");
  }
  if (
    policy.passwordRequired &&
    password.length < PUBLIC_PASSWORD_MIN_LENGTH
  ) {
    throw new Error(
      `Password must contain at least ${PUBLIC_PASSWORD_MIN_LENGTH} characters.`
    );
  }
}

export async function createPasswordHash(
  password: string,
  policy: AccessPolicy
): Promise<string | null> {
  validatePassword(password, policy);
  if (password.length === 0) return null;

  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(
  passwordHash: string | null,
  password: string
): Promise<boolean> {
  if (!passwordHash) return password.length === 0;
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}
