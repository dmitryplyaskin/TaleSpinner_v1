export type AccessMode = "local" | "public";

export type AccessPolicy = {
  mode: AccessMode;
  passwordRequired: boolean;
  passwordlessLoginAllowed: boolean;
  automaticLoginAllowed: boolean;
  secureCookiesRequired: boolean;
  loginRateLimitRequired: boolean;
  csrfProtectionRequired: boolean;
};

type AccessEnvironment = Record<string, string | undefined>;

function resolveAccessMode(environment: AccessEnvironment): AccessMode {
  const configured = environment.TALESPINNER_ACCESS_MODE?.trim().toLowerCase();
  if (!configured || configured === "local") return "local";
  if (configured === "public") return "public";

  throw new Error(
    `Invalid TALESPINNER_ACCESS_MODE "${configured}". Expected "local" or "public".`
  );
}

export function resolveAccessPolicy(
  environment: AccessEnvironment = process.env
): AccessPolicy {
  const mode = resolveAccessMode(environment);
  const isPublic = mode === "public";

  return {
    mode,
    passwordRequired: isPublic,
    passwordlessLoginAllowed: !isPublic,
    automaticLoginAllowed: !isPublic,
    secureCookiesRequired: isPublic,
    loginRateLimitRequired: isPublic,
    csrfProtectionRequired: isPublic,
  };
}
