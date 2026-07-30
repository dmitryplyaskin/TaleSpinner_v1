const LOOPBACK_HOST = "127.0.0.1";
const DEFAULT_LAN_HOST = "0.0.0.0";
const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
] as const;

type NetworkEnvironment = Record<string, string | undefined>;

export type ServerNetworkPolicy = {
  host: string;
  lanMode: boolean;
  allowedOrigins: ReadonlySet<string>;
  isOriginAllowed: (origin: string | undefined) => boolean;
};

export function rejectDisallowedOrigin(
  policy: ServerNetworkPolicy
): RequestHandler {
  return (request, response, next) => {
    const origin = request.header("origin");
    if (policy.isOriginAllowed(origin)) {
      next();
      return;
    }
    response.status(403).json({
      error: {
        code: "ORIGIN_NOT_ALLOWED",
        message: "Request origin is not allowed",
      },
    });
  };
}

function isEnabled(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function parseAllowedOrigins(value: string | undefined): Set<string> {
  const configured = value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return new Set(configured?.length ? configured : DEFAULT_CORS_ORIGINS);
}

export function resolveServerNetworkPolicy(
  environment: NetworkEnvironment = process.env
): ServerNetworkPolicy {
  const lanMode = isEnabled(environment.TALESPINNER_LAN_MODE);
  const host = lanMode
    ? environment.TALESPINNER_HOST?.trim() || DEFAULT_LAN_HOST
    : LOOPBACK_HOST;
  const allowedOrigins = parseAllowedOrigins(environment.TALESPINNER_CORS_ORIGINS);

  return {
    host,
    lanMode,
    allowedOrigins,
    isOriginAllowed: (origin) => origin === undefined || allowedOrigins.has(origin),
  };
}
import type { RequestHandler } from "express";
