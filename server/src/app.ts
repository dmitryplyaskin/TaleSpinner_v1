import { type Server } from "node:http";

import cors from "cors";
import express, { type Express } from "express";
import morgan from "morgan";

import { routes } from "./api/_routes_";
import { createAuthRouter } from "./api/auth.api";
import staticRouter from "./api/static.api";
import { resolveAccessPolicy } from "./core/auth/access-policy";
import { resolveAuthConfig } from "./core/auth/auth-config";
import {
  createAuthContextMiddleware,
  requireAuthenticatedApi,
} from "./core/auth/auth-middleware";
import {
  createCsrfProtectionMiddleware,
  createHttpsEnforcementMiddleware,
  securityHeadersMiddleware,
} from "./core/auth/security-middleware";
import {
  mediaOwnerMiddleware,
  trustedOwnerMiddleware,
} from "./core/auth/trusted-owner-middleware";
import { runBackendBootstrap } from "./core/bootstrap/bootstrap-coordinator";
import { structuredLogger } from "./core/logging/structured-logger";
import { errorHandler } from "./core/middleware/error-handler";
import { requestLifecycleLogger } from "./core/middleware/request-lifecycle-logger";
import {
  rejectDisallowedOrigin,
  resolveServerNetworkPolicy,
} from "./core/network/server-network-policy";
import { requestContextMiddleware } from "./core/request-context/request-context";

export type BootstrapAppOptions = {
  dbPath?: string;
};

export async function bootstrapApp(options: BootstrapAppOptions = {}): Promise<void> {
  await runBackendBootstrap({ dbPath: options.dbPath, logger: structuredLogger });
}

function shouldUseRequestLogging(): boolean {
  return process.env.NODE_ENV !== "test";
}

export function createApp(): Express {
  const app = express();
  const authConfig = resolveAuthConfig();
  const accessPolicy = resolveAccessPolicy();
  const networkPolicy = resolveServerNetworkPolicy();

  app.locals.accessPolicy = accessPolicy;
  app.locals.authConfig = authConfig;
  if (authConfig.trustProxy) app.set("trust proxy", 1);

  app.use(securityHeadersMiddleware);
  app.use(createHttpsEnforcementMiddleware(authConfig));
  if (shouldUseRequestLogging()) {
    app.use(morgan("dev"));
  }
  app.use(rejectDisallowedOrigin(networkPolicy));
  app.use(
    cors({
      origin: (origin, callback) => callback(null, networkPolicy.isOriginAllowed(origin)),
      credentials: true,
    })
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(requestContextMiddleware);
  app.use("/api", createAuthContextMiddleware(authConfig));
  app.use("/media", createAuthContextMiddleware(authConfig));
  app.use("/media", requireAuthenticatedApi, mediaOwnerMiddleware);
  app.use("/api", trustedOwnerMiddleware);
  app.use("/api", createCsrfProtectionMiddleware(authConfig));
  if (shouldUseRequestLogging()) {
    app.use(requestLifecycleLogger);
  }

  app.use(express.static("public"));

  app.use(staticRouter);
  app.use("/api/auth", createAuthRouter(authConfig));
  app.use("/api", requireAuthenticatedApi, routes);

  app.use(errorHandler(structuredLogger));

  return app;
}

export async function startAppServer(options: {
  port: number;
  dbPath?: string;
}): Promise<{ app: Express; server: Server }> {
  await bootstrapApp({ dbPath: options.dbPath });
  const app = createApp();
  const networkPolicy = resolveServerNetworkPolicy();

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(options.port, networkPolicy.host, () => resolve(s));
  });

  return { app, server };
}
