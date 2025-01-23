import { Request, Response, NextFunction, RequestHandler } from "express";

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
      await handler(req, res, next);
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
