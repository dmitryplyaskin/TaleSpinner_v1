import {
  resolveAuthSession,
  type SessionPrincipal,
} from "../../services/auth/session-service";
import { asyncHandler } from "../middleware/async-handler";
import { setAuthenticatedUserContext } from "../request-context/request-context";

import { clearSessionCookie, readCookie } from "./auth-cookie";

import type { AuthConfig } from "./auth-config";
import type { RequestHandler } from "express";


declare module "express-serve-static-core" {
  interface Request {
    auth?: SessionPrincipal;
  }
}

export function createAuthContextMiddleware(
  config: AuthConfig
): RequestHandler {
  return asyncHandler(async (request, response, next) => {
    const token = readCookie(
      request.header("cookie"),
      config.sessionCookieName
    );
    if (!token) {
      next();
      return;
    }

    const principal = await resolveAuthSession({ token, config });
    if (!principal) {
      clearSessionCookie(response, config);
      next();
      return;
    }

    request.auth = principal;
    setAuthenticatedUserContext(request, {
      userId: principal.user.id,
      role: principal.user.role,
    });
    next();
  });
}

export const requireAuthenticatedApi: RequestHandler = (
  request,
  response,
  next
) => {
  if (request.auth) {
    next();
    return;
  }
  response.status(401).json({
    error: {
      code: "AUTH_REQUIRED",
      message: "Authentication is required.",
    },
  });
};
