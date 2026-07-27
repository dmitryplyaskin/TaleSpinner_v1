import { timingSafeEqual } from "node:crypto";

import express, { type Request, type Response } from "express";
import { z } from "zod";

import { clearSessionCookie, setSessionCookie } from "../core/auth/auth-cookie";
import { requireAuthenticatedApi } from "../core/auth/auth-middleware";
import { createLoginRateLimitMiddleware } from "../core/auth/security-middleware";
import { asyncHandler } from "../core/middleware/async-handler";
import { HttpError } from "../core/middleware/error-handler";
import { validate } from "../core/middleware/validate";
import {
  changeOwnPassword,
  createAdditionalUser,
  loginUser,
  recoverAdministrator,
  resetUserPassword,
  setupInitialUser,
  updateUserAdministration,
  AuthServiceError,
  type AuthResult,
} from "../services/auth/auth-service";
import {
  cleanupAuthSessions,
  revokeAuthSession,
  rotateSessionCsrfToken,
} from "../services/auth/session-service";
import {
  countUsers,
  listActiveUsers,
  listUsers,
} from "../services/auth/users-repository";

import type { AuthConfig } from "../core/auth/auth-config";

const identitySchema = z.string().trim().min(1).max(128);
const passwordSchema = z.string().max(1024);

const setupBodySchema = z.object({
  username: identitySchema.max(64),
  displayName: identitySchema.optional(),
  password: passwordSchema.default(""),
});

const loginBodySchema = z
  .object({
    username: z.string().trim().max(64).optional(),
    userId: z.string().trim().min(1).optional(),
    password: passwordSchema.default(""),
  })
  .refine((value) => Boolean(value.username || value.userId), {
    message: "username or userId is required",
  });

const createUserBodySchema = setupBodySchema.extend({
  role: z.enum(["admin", "user"]).default("user"),
});

const changePasswordBodySchema = z.object({
  currentPassword: passwordSchema.default(""),
  newPassword: passwordSchema,
});

const resetPasswordBodySchema = z.object({
  newPassword: passwordSchema,
});

const patchUserBodySchema = z
  .object({
    role: z.enum(["admin", "user"]).optional(),
    status: z.enum(["active", "disabled"]).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: "role or status is required",
  });

const userIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const recoveryBodySchema = z.object({
  username: identitySchema.max(64),
  newPassword: passwordSchema,
});

function safeTokenEquals(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function requirePublicSetupToken(request: Request, config: AuthConfig): void {
  if (config.policy.mode !== "public") return;
  if (
    !config.setupToken ||
    !safeTokenEquals(request.header("x-setup-token"), config.setupToken)
  ) {
    throw new HttpError(403, "Invalid setup token.", "INVALID_SETUP_TOKEN");
  }
}

function mapAuthError(
  error: unknown,
  config: AuthConfig,
  context: "login" | "default" = "default"
): never {
  if (!(error instanceof AuthServiceError)) throw error;
  if (
    context === "login" &&
    config.policy.mode === "public" &&
    ["INVALID_CREDENTIALS", "ACCOUNT_DISABLED", "PASSWORD_REQUIRED"].includes(
      error.code
    )
  ) {
    throw new HttpError(
      401,
      "Invalid username or password.",
      "INVALID_CREDENTIALS"
    );
  }
  const statusByCode: Partial<Record<AuthServiceError["code"], number>> = {
    LAST_ADMIN_REQUIRED: 409,
    PASSWORD_POLICY_VIOLATION: 400,
    SETUP_COMPLETED: 409,
    USERNAME_TAKEN: 409,
    USER_NOT_FOUND: 404,
  };
  throw new HttpError(statusByCode[error.code] ?? 401, error.message, error.code);
}

function applyAuthResult(
  response: Response,
  result: AuthResult,
  config: AuthConfig
) {
  setSessionCookie({
    response,
    token: result.session.token,
    expiresAt: result.session.expiresAt,
    config,
  });
  return {
    user: result.user,
    csrfToken: result.session.csrfToken,
    expiresAt: result.session.expiresAt,
  };
}

export function createAuthRouter(config: AuthConfig) {
  const router = express.Router();
  const authRateLimit = createLoginRateLimitMiddleware(config);

  router.get(
    "/status",
    asyncHandler(async (request: Request, response: Response) => {
      await cleanupAuthSessions();
      const userCount = await countUsers();
      if (userCount === 0) {
        return {
          data: {
            mode: config.policy.mode,
            setupRequired: true,
            authenticated: false,
            user: null,
            accounts: [],
          },
        };
      }

      if (request.auth) {
        const csrfToken = await rotateSessionCsrfToken(
          request.auth.sessionId,
          config
        );
        return {
          data: {
            mode: config.policy.mode,
            setupRequired: false,
            authenticated: true,
            user: request.auth.user,
            accounts: [],
            csrfToken,
          },
        };
      }

      const accounts =
        config.policy.mode === "local" ? await listActiveUsers() : [];
      if (
        config.policy.automaticLoginAllowed &&
        accounts.length === 1 &&
        !accounts[0]?.hasPassword
      ) {
        const result = await loginUser({
          userId: accounts[0].id,
          password: "",
          config,
        });
        return {
          data: {
            mode: config.policy.mode,
            setupRequired: false,
            authenticated: true,
            ...applyAuthResult(response, result, config),
            accounts: [],
          },
        };
      }

      return {
        data: {
          mode: config.policy.mode,
          setupRequired: false,
          authenticated: false,
          user: null,
          accounts,
        },
      };
    })
  );

  router.post(
    "/setup",
    authRateLimit,
    validate({ body: setupBodySchema }),
    asyncHandler(async (request: Request, response: Response) => {
      requirePublicSetupToken(request, config);
      const body = setupBodySchema.parse(request.body);
      try {
        const result = await setupInitialUser({ ...body, config });
        return {
          status: 201,
          data: applyAuthResult(response, result, config),
        };
      } catch (error) {
        mapAuthError(error, config);
      }
    })
  );

  router.post(
    "/login",
    authRateLimit,
    validate({ body: loginBodySchema }),
    asyncHandler(async (request: Request, response: Response) => {
      const body = loginBodySchema.parse(request.body);
      try {
        const result = await loginUser({ ...body, config });
        return { data: applyAuthResult(response, result, config) };
      } catch (error) {
        mapAuthError(error, config, "login");
      }
    })
  );

  router.post(
    "/register",
    authRateLimit,
    validate({ body: setupBodySchema }),
    asyncHandler(async (request: Request, response: Response) => {
      if (config.policy.mode !== "public" || !config.allowRegistration) {
        throw new HttpError(
          403,
          "Public registration is disabled.",
          "REGISTRATION_DISABLED"
        );
      }
      if ((await countUsers()) === 0) {
        throw new HttpError(
          409,
          "Initial setup must be completed first.",
          "SETUP_REQUIRED"
        );
      }
      const body = setupBodySchema.parse(request.body);
      try {
        await createAdditionalUser({ ...body, role: "user", config });
        const result = await loginUser({
          username: body.username,
          password: body.password,
          config,
        });
        return {
          status: 201,
          data: applyAuthResult(response, result, config),
        };
      } catch (error) {
        mapAuthError(error, config);
      }
    })
  );

  router.post(
    "/recover",
    authRateLimit,
    validate({ body: recoveryBodySchema }),
    asyncHandler(async (request: Request) => {
      if (config.policy.mode !== "public") {
        throw new HttpError(
          404,
          "Administrator recovery is only available in public mode.",
          "NOT_FOUND"
        );
      }
      requirePublicSetupToken(request, config);
      const body = recoveryBodySchema.parse(request.body);
      try {
        await recoverAdministrator({ ...body, config });
        return { data: { ok: true } };
      } catch (error) {
        mapAuthError(error, config, "login");
      }
    })
  );

  router.post(
    "/logout",
    requireAuthenticatedApi,
    asyncHandler(async (request: Request, response: Response) => {
      if (request.auth) await revokeAuthSession(request.auth.sessionId);
      clearSessionCookie(response, config);
      return { data: { ok: true } };
    })
  );

  router.post(
    "/password",
    requireAuthenticatedApi,
    validate({ body: changePasswordBodySchema }),
    asyncHandler(async (request: Request, response: Response) => {
      const body = changePasswordBodySchema.parse(request.body);
      try {
        const result = await changeOwnPassword({
          userId: request.auth!.user.id,
          ...body,
          config,
        });
        return { data: applyAuthResult(response, result, config) };
      } catch (error) {
        mapAuthError(error, config, "login");
      }
    })
  );

  router.get(
    "/users",
    requireAuthenticatedApi,
    asyncHandler(async (request: Request) => {
      if (request.auth?.user.role !== "admin") {
        throw new HttpError(403, "Administrator access is required.", "FORBIDDEN");
      }
      return { data: await listUsers() };
    })
  );

  router.post(
    "/users",
    requireAuthenticatedApi,
    validate({ body: createUserBodySchema }),
    asyncHandler(async (request: Request) => {
      if (request.auth?.user.role !== "admin") {
        throw new HttpError(403, "Administrator access is required.", "FORBIDDEN");
      }
      const body = createUserBodySchema.parse(request.body);
      try {
        const user = await createAdditionalUser({ ...body, config });
        return { status: 201, data: user };
      } catch (error) {
        mapAuthError(error, config);
      }
    })
  );

  router.patch(
    "/users/:id",
    requireAuthenticatedApi,
    validate({ params: userIdParamsSchema, body: patchUserBodySchema }),
    asyncHandler(async (request: Request) => {
      if (request.auth?.user.role !== "admin") {
        throw new HttpError(403, "Administrator access is required.", "FORBIDDEN");
      }
      const params = userIdParamsSchema.parse(request.params);
      const body = patchUserBodySchema.parse(request.body);
      try {
        return {
          data: await updateUserAdministration({
            userId: params.id,
            ...body,
          }),
        };
      } catch (error) {
        mapAuthError(error, config);
      }
    })
  );

  router.post(
    "/users/:id/password",
    requireAuthenticatedApi,
    validate({ params: userIdParamsSchema, body: resetPasswordBodySchema }),
    asyncHandler(async (request: Request) => {
      if (request.auth?.user.role !== "admin") {
        throw new HttpError(403, "Administrator access is required.", "FORBIDDEN");
      }
      const params = userIdParamsSchema.parse(request.params);
      const body = resetPasswordBodySchema.parse(request.body);
      try {
        return {
          data: await resetUserPassword({
            userId: params.id,
            ...body,
            config,
          }),
        };
      } catch (error) {
        mapAuthError(error, config);
      }
    })
  );

  return router;
}
