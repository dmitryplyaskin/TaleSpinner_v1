import { type RequestHandler } from "express";
import { type ZodTypeAny, type z } from "zod";

import { HttpError } from "@core/middleware/error-handler";

export type ValidateSchemas = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

function replaceObject(target: Record<string, unknown>, value: unknown): void {
  // Express v5 may expose req.query as a getter-only property, so we must not reassign it.
  // Mutate the existing object instead.
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  if (value && typeof value === "object") {
    Object.assign(target, value as Record<string, unknown>);
  }
}

export const validate = (schemas: ValidateSchemas): RequestHandler => {
  return (req, _res, next) => {
    const issues: Array<{
      source: "body" | "params" | "query";
      issues: z.ZodIssue[];
    }> = [];

    if (schemas.params) {
      const parsed = schemas.params.safeParse(req.params);
      if (!parsed.success) {
        issues.push({ source: "params", issues: parsed.error.issues });
      } else {
        req.params = parsed.data as any;
      }
    }

    if (schemas.query) {
      const parsed = schemas.query.safeParse(req.query);
      if (!parsed.success) {
        issues.push({ source: "query", issues: parsed.error.issues });
      } else {
        replaceObject(
          req.query as unknown as Record<string, unknown>,
          parsed.data
        );
      }
    }

    if (schemas.body) {
      const parsed = schemas.body.safeParse(req.body);
      if (!parsed.success) {
        issues.push({ source: "body", issues: parsed.error.issues });
      } else {
        req.body = parsed.data as any;
      }
    }

    if (issues.length > 0) {
      next(
        new HttpError(400, "Validation error", "VALIDATION_ERROR", {
          issues,
        })
      );
      return;
    }

    next();
  };
};
