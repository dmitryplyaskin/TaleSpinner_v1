import { Request, Response, NextFunction } from "express";
import { Logger } from "@core/types/common";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const errorHandler = (logger?: Logger) => {
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof HttpError) {
      logger?.error(error.message, {
        statusCode: error.statusCode,
        details: error.details,
        path: req.path,
      });

      res.status(error.statusCode).json({
        error: error.message,
        details: error.details,
      });
    } else {
      logger?.error("Unexpected error", { error, path: req.path });

      res.status(500).json({
        error: "Internal Server Error",
      });
    }
  };
};
