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
  createAdditionalUser,
  loginUser,
  setupInitialUser,
  AuthServiceError,
  type AuthResult,
} from "../services/auth/auth-service";
import {
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

function mapAuthError(error: unknown): never {
  if (!(error instanceof AuthServiceError)) throw error;
  const status = error.code === "SETUP_COMPLETED" ? 409 : 401;
  throw new HttpError(status, error.message, error.code);
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
        mapAuthError(error);
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
        mapAuthError(error);
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
      const user = await createAdditionalUser({ ...body, config });
      return { status: 201, data: user };
    })
  );

  return router;
}
