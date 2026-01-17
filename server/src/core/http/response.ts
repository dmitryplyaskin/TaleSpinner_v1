export type ApiErrorBody = {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
};

export type ApiSuccessBody<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiResponseBody<T = unknown> = ApiSuccessBody<T> | ApiErrorBody;

/**
 * Унифицированный "дескриптор ответа" для asyncHandler:
 * - если `raw: true` — отправляем `data` через res.send (Buffer/строка/и т.п.)
 * - иначе отправляем JSON (обычно `{ data: ... }`)
 */
export type ApiResult<T = unknown> = ApiResponseBody<T> & {
  status?: number;
  headers?: Record<string, string>;
  raw?: boolean;
};

export const ok = <T>(data: T, meta?: Record<string, unknown>): ApiSuccessBody<T> =>
  meta ? { data, meta } : { data };

