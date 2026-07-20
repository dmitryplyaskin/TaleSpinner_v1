import { AsyncLocalStorage } from "node:async_hooks";

import { GLOBAL_OWNER_ID } from "./request-context";

const ownerStorage = new AsyncLocalStorage<string>();

export function runWithOwnerScope<T>(ownerId: string, work: () => T): T {
  return ownerStorage.run(ownerId, work);
}

export function getActiveOwnerId(): string | null {
  return ownerStorage.getStore() ?? null;
}

export function resolveTrustedOwnerId(requestedOwnerId?: string | null): string {
  return getActiveOwnerId() ?? requestedOwnerId ?? GLOBAL_OWNER_ID;
}
