import { resolveAccessPolicy, type AccessPolicy } from "./access-policy";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SESSION_TTL_DAYS = 30;
const MIN_PUBLIC_SECRET_LENGTH = 32;
const MIN_SETUP_TOKEN_LENGTH = 16;

type AuthEnvironment = Record<string, string | undefined>;

export type AuthConfig = {
  policy: AccessPolicy;
  sessionCookieName: string;
  sessionTtlMs: number;
  sessionSecret: string | null;
  setupToken: string | null;
  allowRegistration: boolean;
  trustProxy: boolean;
};

function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value?.trim().toLowerCase() === "true";
}

function parseSessionTtl(value: string | undefined): number {
  if (!value?.trim()) return DEFAULT_SESSION_TTL_DAYS * DAY_MS;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error(
      "TALESPINNER_SESSION_TTL_DAYS must be an integer between 1 and 365."
    );
  }
  return days * DAY_MS;
}

function optionalSecret(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validatePublicSecrets(config: AuthConfig): void {
  if (config.policy.mode !== "public") return;
  if (!config.trustProxy) {
    throw new Error(
      "TALESPINNER_TRUST_PROXY=true is required in public mode."
    );
  }
  if (
    !config.sessionSecret ||
    config.sessionSecret.length < MIN_PUBLIC_SECRET_LENGTH
  ) {
    throw new Error(
      `TALESPINNER_SESSION_SECRET must contain at least ${MIN_PUBLIC_SECRET_LENGTH} characters in public mode.`
    );
  }
  if (!config.setupToken || config.setupToken.length < MIN_SETUP_TOKEN_LENGTH) {
    throw new Error(
      `TALESPINNER_SETUP_TOKEN must contain at least ${MIN_SETUP_TOKEN_LENGTH} characters in public mode.`
    );
  }
}

export function resolveAuthConfig(
  environment: AuthEnvironment = process.env
): AuthConfig {
  const config: AuthConfig = {
    policy: resolveAccessPolicy(environment),
    sessionCookieName: "talespinner_session",
    sessionTtlMs: parseSessionTtl(environment.TALESPINNER_SESSION_TTL_DAYS),
    sessionSecret: optionalSecret(environment.TALESPINNER_SESSION_SECRET),
    setupToken: optionalSecret(environment.TALESPINNER_SETUP_TOKEN),
    allowRegistration: parseBoolean(
      environment.TALESPINNER_ALLOW_REGISTRATION
    ),
    trustProxy: parseBoolean(environment.TALESPINNER_TRUST_PROXY),
  };
  validatePublicSecrets(config);
  return config;
}
