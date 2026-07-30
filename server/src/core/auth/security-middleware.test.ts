import { describe, expect, test, vi } from "vitest";

import { securityHeadersMiddleware } from "./security-middleware";

function readResourcePolicy(path: string): string | undefined {
  const headers = new Map<string, string>();
  const next = vi.fn();
  securityHeadersMiddleware(
    { path } as never,
    {
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
    } as never,
    next
  );
  expect(next).toHaveBeenCalledOnce();
  return headers.get("Cross-Origin-Resource-Policy");
}

describe("securityHeadersMiddleware", () => {
  test("allows media and default assets to be embedded by the frontend", () => {
    expect(readResourcePolicy("/media/images/avatar.png")).toBe("cross-origin");
    expect(readResourcePolicy("/defaults/backgrounds/default-bg.png")).toBe(
      "cross-origin"
    );
  });

  test("keeps API and application responses same-origin", () => {
    expect(readResourcePolicy("/api/auth/status")).toBe("same-origin");
    expect(readResourcePolicy("/index.html")).toBe("same-origin");
  });
});
