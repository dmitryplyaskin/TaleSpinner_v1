import { expect } from "vitest";

import type { JsonResponse } from "./http";

type ApiSuccessEnvelope<T = unknown> = {
  data: T;
};

type ApiErrorEnvelope = {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
};

export function expectApiSuccess<T>(
  response: JsonResponse<unknown>,
  status = 200
): T {
  expect(response.status).toBe(status);
  expect(response.data).toBeTruthy();

  const payload = response.data as ApiSuccessEnvelope<T>;
  expect(payload).toHaveProperty("data");
  expect((payload as Record<string, unknown>).error).toBeUndefined();

  return payload.data;
}

export function expectApiError(
  response: JsonResponse<unknown>,
  status: number,
  code?: string
): ApiErrorEnvelope["error"] {
  expect(response.status).toBe(status);
  expect(response.data).toBeTruthy();

  const payload = response.data as ApiErrorEnvelope;
  expect(payload).toHaveProperty("error");
  expect(typeof payload.error.message).toBe("string");
  if (code) {
    expect(payload.error.code).toBe(code);
  }

  return payload.error;
}
