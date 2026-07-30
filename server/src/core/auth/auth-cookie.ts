import type { AuthConfig } from "./auth-config";
import type { Response } from "express";


export function readCookie(
  cookieHeader: string | undefined,
  name: string
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function cookieSecurity(config: AuthConfig): string {
  return config.policy.secureCookiesRequired
    ? "; Secure; SameSite=Strict"
    : "; SameSite=Lax";
}

export function setSessionCookie(params: {
  response: Response;
  token: string;
  expiresAt: Date;
  config: AuthConfig;
}): void {
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((params.expiresAt.getTime() - Date.now()) / 1000)
  );
  params.response.append(
    "Set-Cookie",
    `${params.config.sessionCookieName}=${encodeURIComponent(params.token)}` +
      `; Path=/; HttpOnly; Max-Age=${maxAgeSeconds}` +
      `; Expires=${params.expiresAt.toUTCString()}` +
      cookieSecurity(params.config)
  );
}

export function clearSessionCookie(
  response: Response,
  config: AuthConfig
): void {
  response.append(
    "Set-Cookie",
    `${config.sessionCookieName}=; Path=/; HttpOnly; Max-Age=0` +
      "; Expires=Thu, 01 Jan 1970 00:00:00 GMT" +
      cookieSecurity(config)
  );
}
