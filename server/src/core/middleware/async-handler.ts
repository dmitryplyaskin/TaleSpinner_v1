import { type Request, type Response, type NextFunction, type RequestHandler } from "express";

import { type ApiResult } from "@core/http/response";

export type AsyncRequestHandler<T = unknown> = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<T>;

export type ErrorContext = {
  url: string;
  method: string;
  timestamp: string;
  params?: unknown;
  body?: unknown;
  query?: unknown;
};

export type Logger = {
  error: (message: string, context: ErrorContext) => void;
};

export type AsyncHandlerOptions = {
  logger?: Logger;
  enableErrorLogging?: boolean;
  customErrorHandler?: (error: unknown, context: ErrorContext) => void;
};

const MAX_STRING_LENGTH = 512;
const MAX_OBJECT_KEYS = 30;
const MAX_ARRAY_ITEMS = 20;
const MAX_SERIALIZE_DEPTH = 4;
const SENSITIVE_KEY_RE = /(token|authorization|password|api[-_]?key|secret|cookie)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth >= MAX_SERIALIZE_DEPTH) return "[depth_limited]";

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    typeof value === "undefined"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
  }

  if (!isRecord(value)) {
    return String(value);
  }

  const out: Record<string, unknown> = {};
  const keys = Object.keys(value).slice(0, MAX_OBJECT_KEYS);
  for (const key of keys) {
    const raw = value[key];
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = sanitizeValue(raw, depth + 1);
  }
  return out;
}

const createErrorContext = (req: Request): ErrorContext => ({
  url: req.originalUrl,
  method: req.method,
  timestamp: new Date().toISOString(),
  params: sanitizeValue(req.params),
  body: sanitizeValue(req.body),
  query: sanitizeValue(req.query),
});

export const asyncHandler = <T extends RequestHandler>(
  handler: T,
  options: AsyncHandlerOptions = {}
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await handler(req, res, next);

      // Если ответ уже отправлен, ничего не делаем
      if (res.headersSent) {
        return;
      }

      // Если есть результат и он не undefined, отправляем его
      if (result !== undefined) {
        const r = result as unknown as Partial<ApiResult<unknown>>;

        const status = typeof r.status === "number" ? r.status : 200;
        const headers = r.headers;
        const isRaw = r.raw === true;

        if (headers && typeof headers === "object") {
          for (const [key, value] of Object.entries(headers)) {
            res.setHeader(key, value);
          }
        }

        if (isRaw) {
          // raw: true => отправляем data как есть (Buffer/string/и т.п.)
          res.status(status).send((r as { data?: unknown }).data);
          return;
        }

        // JSON-ответ: если уже похоже на контракт (`data`/`error`) — отдаём как есть,
        // иначе заворачиваем в `{ data: ... }`.
        const hasContractKeys =
          isRecord(result) && ("data" in result || "error" in result);

        const body = hasContractKeys ? result : { data: result };
        res.status(status).json(body);
      }
    } catch (error) {
      const context = createErrorContext(req);

      // Custom error handling
      if (options.customErrorHandler) {
        options.customErrorHandler(error, context);
      } else {
        // Default error processing
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        // Logging
        if (options.enableErrorLogging || options.logger) {
          const logger = options.logger?.error || console.error;
          logger(`AsyncHandler Error: ${errorMessage}`, context);
        }

        // Enhance error object
        if (error instanceof Error) {
          (error as Error & { httpContext?: ErrorContext }).httpContext = context;
        }
      }

      next(error);
    }
  };
};
