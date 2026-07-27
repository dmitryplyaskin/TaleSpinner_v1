
import { createPasswordHash, verifyPassword } from "./password-service";
import {
  createAuthSession,
  revokeUserSessions,
  type AuthMethod,
  type CreatedAuthSession,
} from "./session-service";
import {
  createInitialUser,
  createUser,
  getUserById,
  getUserCredentialsById,
  getUserCredentialsByUsername,
  patchUserAdministration,
  recordUserLogin,
  recoverAdminPassword,
  updateUserPassword,
  type UserDto,
  type UserRole,
  type UserStatus,
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
      | "PASSWORD_REQUIRED"
      | "PASSWORD_POLICY_VIOLATION"
      | "USERNAME_TAKEN"
      | "USER_NOT_FOUND"
      | "LAST_ADMIN_REQUIRED",
    message: string
  ) {
    super(message);
  }
}

async function hashPassword(
  password: string,
  config: AuthConfig
): Promise<string | null> {
  try {
    return await createPasswordHash(password, config.policy);
  } catch (error) {
    throw new AuthServiceError(
      "PASSWORD_POLICY_VIOLATION",
      error instanceof Error ? error.message : "Password policy validation failed."
    );
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code?: unknown }).code).startsWith(
      "SQLITE_CONSTRAINT"
    )
  );
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
  const passwordHash = await hashPassword(params.password, params.config);
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
  const passwordHash = await hashPassword(params.password, params.config);
  try {
    return await createUser({
      username: params.username,
      displayName: params.displayName ?? params.username,
      passwordHash,
      role: params.role ?? "user",
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AuthServiceError(
        "USERNAME_TAKEN",
        "Username is already in use."
      );
    }
    throw error;
  }
}

export async function changeOwnPassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  config: AuthConfig;
}): Promise<AuthResult> {
  const current = await getUserCredentialsById(params.userId);
  if (
    !current ||
    current.status !== "active" ||
    !(await verifyPassword(current.passwordHash, params.currentPassword))
  ) {
    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "Current password is invalid."
    );
  }
  const passwordHash = await hashPassword(params.newPassword, params.config);
  await updateUserPassword(current.id, passwordHash);
  await revokeUserSessions(current.id);
  return issueSession({
    userId: current.id,
    authMethod: passwordHash ? "password" : "local",
    config: params.config,
  });
}

export async function updateUserAdministration(params: {
  userId: string;
  role?: UserRole;
  status?: UserStatus;
}): Promise<UserDto> {
  const result = await patchUserAdministration(params);
  if (result.status === "not_found") {
    throw new AuthServiceError("USER_NOT_FOUND", "User not found.");
  }
  if (result.status === "last_admin") {
    throw new AuthServiceError(
      "LAST_ADMIN_REQUIRED",
      "At least one active administrator is required."
    );
  }
  await revokeUserSessions(params.userId);
  return result.user;
}

export async function resetUserPassword(params: {
  userId: string;
  newPassword: string;
  config: AuthConfig;
}): Promise<UserDto> {
  const current = await getUserById(params.userId);
  if (!current) {
    throw new AuthServiceError("USER_NOT_FOUND", "User not found.");
  }
  const passwordHash = await hashPassword(params.newPassword, params.config);
  const updated = await updateUserPassword(params.userId, passwordHash);
  if (!updated) {
    throw new AuthServiceError("USER_NOT_FOUND", "User not found.");
  }
  await revokeUserSessions(params.userId);
  return updated;
}

export async function recoverAdministrator(params: {
  username: string;
  newPassword: string;
  config: AuthConfig;
}): Promise<void> {
  const passwordHash = await hashPassword(params.newPassword, params.config);
  if (!passwordHash) {
    throw new AuthServiceError("PASSWORD_REQUIRED", "Password is required.");
  }
  const recovered = await recoverAdminPassword({
    username: params.username,
    passwordHash,
  });
  if (!recovered) {
    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "Administrator recovery failed."
    );
  }
  await revokeUserSessions(recovered.id);
}
