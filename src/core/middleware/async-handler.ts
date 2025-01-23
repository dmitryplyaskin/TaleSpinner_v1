import { Request, Response, NextFunction, RequestHandler } from "express";
import { Logger } from "@core/types/common";

export const asyncHandler = (handler: RequestHandler, logger?: Logger) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      logger?.error("Request handler error", {
        error,
        path: req.path,
        method: req.method,
      });
      next(error);
    }
  };
};
