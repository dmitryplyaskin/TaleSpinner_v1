
import { createPasswordHash, verifyPassword } from "./password-service";
import {
  createAuthSession,
  type AuthMethod,
  type CreatedAuthSession,
} from "./session-service";
import {
  createInitialUser,
  createUser,
  getUserById,
  getUserCredentialsById,
  getUserCredentialsByUsername,
  recordUserLogin,
  type UserDto,
  type UserRole,
} from "./users-repository";

import type { AuthConfig } from "../../core/auth/auth-config";

export type AuthResult = {
  user: UserDto;
  session: CreatedAuthSession;
};

export class AuthServiceError extends Error {
  constructor(
    public readonly code:
      | "SETUP_COMPLETED"
      | "INVALID_CREDENTIALS"
      | "ACCOUNT_DISABLED"
      | "PASSWORD_REQUIRED",
    message: string
  ) {
    super(message);
  }
}

async function issueSession(params: {
  userId: string;
  authMethod: AuthMethod;
  config: AuthConfig;
}): Promise<AuthResult> {
  const user = await getUserCredentialsById(params.userId);
  if (!user) {
    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "Invalid username or password."
    );
  }
  const session = await createAuthSession({
    user,
    authMethod: params.authMethod,
    config: params.config,
  });
  await recordUserLogin(user.id);
  const safeUser = await getUserById(user.id);
  if (!safeUser) {
    throw new Error("Authenticated user could not be reloaded.");
  }
  return { user: safeUser, session };
}

export async function setupInitialUser(params: {
  username: string;
  displayName?: string;
  password: string;
  config: AuthConfig;
}): Promise<AuthResult> {
  const passwordHash = await createPasswordHash(
    params.password,
    params.config.policy
  );
  const created = await createInitialUser({
    username: params.username,
    displayName: params.displayName ?? params.username,
    passwordHash,
  });
  if (!created) {
    throw new AuthServiceError(
      "SETUP_COMPLETED",
      "Initial setup has already been completed."
    );
  }
  return issueSession({
    userId: created.id,
    authMethod: passwordHash ? "password" : "local",
    config: params.config,
  });
}

export async function loginUser(params: {
  username?: string;
  userId?: string;
  password: string;
  config: AuthConfig;
}): Promise<AuthResult> {
  const user = params.userId
    ? await getUserCredentialsById(params.userId)
    : await getUserCredentialsByUsername(params.username ?? "");
  if (!user) {
    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "Invalid username or password."
    );
  }
  if (user.status !== "active") {
    throw new AuthServiceError("ACCOUNT_DISABLED", "Account is disabled.");
  }
  if (
    !user.passwordHash &&
    !params.config.policy.passwordlessLoginAllowed
  ) {
    throw new AuthServiceError(
      "PASSWORD_REQUIRED",
      "Passwordless login is disabled."
    );
  }
  if (!(await verifyPassword(user.passwordHash, params.password))) {
    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "Invalid username or password."
    );
  }
  return issueSession({
    userId: user.id,
    authMethod: user.passwordHash ? "password" : "local",
    config: params.config,
  });
}

export async function createAdditionalUser(params: {
  username: string;
  displayName?: string;
  password: string;
  role?: UserRole;
  config: AuthConfig;
}): Promise<UserDto> {
  const passwordHash = await createPasswordHash(
    params.password,
    params.config.policy
  );
  return createUser({
    username: params.username,
    displayName: params.displayName ?? params.username,
    passwordHash,
    role: params.role ?? "user",
  });
}
