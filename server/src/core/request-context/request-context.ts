import { randomUUID } from "node:crypto";

import type { Request, RequestHandler } from "express";

export const GLOBAL_OWNER_ID = "global";

export type RequestContext = {
  requestId: string;
  ownerScope: {
    ownerId: string;
    source: "context-default" | "explicit";
  };
  actor: {
    type: "system";
    id: null;
  };
  tenant: {
    id: null;
  };
};

declare module "express-serve-static-core" {
  interface Request {
    context?: RequestContext;
  }
}

function buildDefaultContext(requestId?: string): RequestContext {
  return {
    requestId: requestId ?? randomUUID(),
    ownerScope: {
      ownerId: GLOBAL_OWNER_ID,
      source: "context-default",
    },
    actor: {
      type: "system",
      id: null,
    },
    tenant: {
      id: null,
    },
  };
}

export const requestContextMiddleware: RequestHandler = (req, _res, next) => {
  const headerRequestId = req.header("x-request-id");
  req.context = buildDefaultContext(
    typeof headerRequestId === "string" && headerRequestId.trim().length > 0
      ? headerRequestId.trim()
      : undefined
  );
  next();
};

export function getRequestContext(req: Request): RequestContext {
  if (!req.context) {
    req.context = buildDefaultContext();
  }
  return req.context;
}

export function resolveOwnerId(
  requestedOwnerId?: string | null,
  fallbackOwnerId = GLOBAL_OWNER_ID
): string {
  return typeof requestedOwnerId === "string" && requestedOwnerId.trim().length > 0
    ? requestedOwnerId
    : fallbackOwnerId;
}

export function getRequestOwnerId(req: Request, requestedOwnerId?: string | null): string {
  void requestedOwnerId;
  return getRequestContext(req).ownerScope.ownerId;
}
