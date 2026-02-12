import { describe, expect, test, vi } from "vitest";

import { asyncHandler } from "./async-handler";

describe("asyncHandler", () => {
  test("redacts sensitive fields in error context", async () => {
    const logger = { error: vi.fn() };
    const next = vi.fn();
    const req = {
      originalUrl: "/api/test",
      method: "POST",
      params: { id: "123" },
      query: { q: "value" },
      body: {
        token: "secret-token",
        nested: {
          password: "top-secret",
        },
      },
    };
    const res = {
      headersSent: false,
    };

    const wrapped = asyncHandler(
      async () => {
        throw new Error("boom");
      },
      { logger }
    );

    await wrapped(req as never, res as never, next as never);

    expect(logger.error).toHaveBeenCalledTimes(1);
    const [, context] = logger.error.mock.calls[0];
    expect(context).toMatchObject({
      body: {
        token: "[REDACTED]",
        nested: {
          password: "[REDACTED]",
        },
      },
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
