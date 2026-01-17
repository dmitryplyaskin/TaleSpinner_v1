import { type Request, type Response, type NextFunction, type RequestHandler } from "express";

import { type ApiResult } from "@core/http/response";

export type AsyncRequestHandler<T = any> = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<T>;

export type ErrorContext = {
  url: string;
  method: string;
  timestamp: string;
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

export type Logger = {
  error: (message: string, context: ErrorContext) => void;
};

export type AsyncHandlerOptions = {
  logger?: Logger;
  enableErrorLogging?: boolean;
  customErrorHandler?: (error: unknown, context: ErrorContext) => void;
};

const createErrorContext = (req: Request): ErrorContext => ({
  url: req.originalUrl,
  method: req.method,
  timestamp: new Date().toISOString(),
  params: req.params,
  body: req.body,
  query: req.query,
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
          res.status(status).send((r as any).data);
          return;
        }

        // JSON-ответ: если уже похоже на контракт (`data`/`error`) — отдаём как есть,
        // иначе заворачиваем в `{ data: ... }`.
        const isObject = typeof result === "object" && result !== null;
        const hasContractKeys =
          isObject && ("data" in (result as any) || "error" in (result as any));

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
          (error as any).httpContext = context;
        }
      }

      next(error);
    }
  };
};
