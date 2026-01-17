import { Request, Response, NextFunction } from "express";
import { Logger } from "@core/types/common";
import { ApiErrorBody } from "@core/http/response";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const toErrorBody = (
  message: string,
  details?: unknown,
  code?: string
): ApiErrorBody => ({
  error: {
    message,
    ...(code ? { code } : {}),
    ...(details !== undefined ? { details } : {}),
  },
});

export const errorHandler = (logger?: Logger) => {
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof HttpError) {
      logger?.error(error.message, {
        statusCode: error.statusCode,
        code: error.code,
        details: error.details,
        path: req.path,
      });

      res
        .status(error.statusCode)
        .json(toErrorBody(error.message, error.details, error.code));
    } else {
      logger?.error("Unexpected error", { error, path: req.path });

      res.status(500).json(toErrorBody("Internal Server Error"));
    }
  };
};
