

import { getChatById } from "../../services/chat-core/chats-repository";
import { getEntityProfileById } from "../../services/chat-core/entity-profiles-repository";
import { getGenerationById } from "../../services/chat-core/generations-repository";
import { getInstructionById } from "../../services/chat-core/instructions-repository";
import { getUserPersonById } from "../../services/chat-core/user-persons-repository";
import { getEntryById } from "../../services/chat-entry-parts/entries-repository";
import { getPartWithVariantContextById } from "../../services/chat-entry-parts/parts-repository";
import { getWorldInfoBookById } from "../../services/world-info/world-info-repositories";
import { asyncHandler } from "../middleware/async-handler";
import { runWithOwnerScope } from "../request-context/owner-scope-storage";

import type { Request, RequestHandler } from "express";

function injectTrustedOwner(request: Request, ownerId: string): void {
  if (
    request.body &&
    typeof request.body === "object" &&
    !Array.isArray(request.body)
  ) {
    (request.body as Record<string, unknown>).ownerId = ownerId;
  }
  if (request.query && typeof request.query === "object") {
    (request.query as Record<string, unknown>).ownerId = ownerId;
  }
}

async function resolveResourceOwner(
  path: string,
  authenticatedOwnerId: string
): Promise<string | null | undefined> {
  const segments = path.split("/").filter(Boolean);
  const [resource, id, nested] = segments;
  if (!id) return undefined;

  if (resource === "chats") return (await getChatById(id))?.ownerId ?? null;
  if (resource === "entity-profiles") {
    if (id === "import") return undefined;
    return (await getEntityProfileById(id))?.ownerId ?? null;
  }
  if (resource === "entries") {
    if (id === "soft-delete-bulk") return undefined;
    return (await getEntryById({ entryId: id })) ? authenticatedOwnerId : null;
  }
  if (resource === "parts") {
    return (await getPartWithVariantContextById({ partId: id }))?.ownerId ?? null;
  }
  if (resource === "instructions") {
    if (id === "default-st-preset" || id === "prerender") return undefined;
    return (await getInstructionById(id))?.ownerId ?? null;
  }
  if (resource === "user-persons") {
    return (await getUserPersonById(id))?.ownerId ?? null;
  }
  if (resource === "generations") {
    return (await getGenerationById(id)) ? authenticatedOwnerId : null;
  }
  if (resource === "world-info" && id === "books" && nested) {
    if (nested === "import") return undefined;
    return (await getWorldInfoBookById(nested))?.ownerId ?? null;
  }
  return undefined;
}

export const trustedOwnerMiddleware: RequestHandler = asyncHandler(
  async (request, response, next) => {
    const userId = request.auth?.user.id;
    if (!userId) {
      next();
      return;
    }
    await runWithOwnerScope(userId, async () => {
      injectTrustedOwner(request, userId);
      const resourceOwner = await resolveResourceOwner(request.path, userId);
      if (resourceOwner === undefined || resourceOwner === userId) {
        next();
        return;
      }
      response.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found.",
        },
      });
    });
  }
);

export const mediaOwnerMiddleware: RequestHandler = (
  request,
  response,
  next
) => {
  const userId = request.auth?.user.id;
  if (!userId) {
    response.status(401).end();
    return;
  }
  const segments = request.path.split("/").filter(Boolean);
  if (userId === "global") {
    const isNamespacedUpload =
      segments[0] === "images" &&
      segments.length >= 4 &&
      ["app-backgrounds", "user-persons", "entity-profiles", "agent-cards"].includes(
        segments[1] ?? ""
      );
    if (!isNamespacedUpload || segments[2] === "global") {
      next();
      return;
    }
    response.status(404).end();
    return;
  }
  if (segments.includes(userId)) {
    next();
    return;
  }
  response.status(404).end();
};
