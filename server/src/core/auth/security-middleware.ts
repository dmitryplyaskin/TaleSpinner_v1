import { verifySessionCsrfToken } from "../../services/auth/session-service";

import type { AuthConfig } from "./auth-config";
import type { RequestHandler } from "express";



const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT_PATHS = new Set(["/auth/login", "/auth/setup"]);

export const securityHeadersMiddleware: RequestHandler = (
  _request,
  response,
  next
) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
};

export function createHttpsEnforcementMiddleware(
  config: AuthConfig
): RequestHandler {
  return (request, response, next) => {
    if (config.policy.mode !== "public" || request.secure) {
      next();
      return;
    }
    response.status(426).json({
      error: {
        code: "HTTPS_REQUIRED",
        message: "HTTPS is required in public access mode.",
      },
    });
  };
}

export function createCsrfProtectionMiddleware(
  config: AuthConfig
): RequestHandler {
  return (request, response, next) => {
    if (
      !config.policy.csrfProtectionRequired ||
      SAFE_METHODS.has(request.method) ||
      CSRF_EXEMPT_PATHS.has(request.path)
    ) {
      next();
      return;
    }
    const csrfToken = request.header("x-csrf-token");
    if (
      request.auth &&
      csrfToken &&
      verifySessionCsrfToken(request.auth, csrfToken, config)
    ) {
      next();
      return;
    }
    response.status(403).json({
      error: {
        code: "CSRF_TOKEN_INVALID",
        message: "A valid CSRF token is required.",
      },
    });
  };
}

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export function createLoginRateLimitMiddleware(
  config: AuthConfig,
  options: { maxAttempts?: number; windowMs?: number } = {}
): RequestHandler {
  const entries = new Map<string, RateLimitEntry>();
  const maxAttempts = options.maxAttempts ?? 5;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;

  return (request, response, next) => {
    if (!config.policy.loginRateLimitRequired) {
      next();
      return;
    }
    const now = Date.now();
    const key = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const current = entries.get(key);
    const entry =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : current;
    entry.count += 1;
    entries.set(key, entry);

    if (entries.size > 10_000) {
      for (const [entryKey, value] of entries) {
        if (value.resetAt <= now) entries.delete(entryKey);
      }
    }
    if (entry.count <= maxAttempts) {
      next();
      return;
    }
    response.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000)))
    );
    response.status(429).json({
      error: {
        code: "AUTH_RATE_LIMITED",
        message: "Too many authentication attempts. Try again later.",
      },
    });
  };
}
