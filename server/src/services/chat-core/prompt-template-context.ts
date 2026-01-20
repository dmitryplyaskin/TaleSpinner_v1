import { getChatById, listMessagesForPrompt } from "./chats-repository";
import { getEntityProfileById } from "./entity-profiles-repository";
import { getSelectedUserPerson } from "./user-persons-repository";

import type { PromptTemplateRenderContext } from "./prompt-template-renderer";

export async function buildPromptTemplateRenderContext(params: {
  ownerId?: string;
  chatId?: string;
  branchId?: string;
  entityProfileId?: string;
  historyLimit?: number;
  excludeMessageIds?: string[];
}): Promise<PromptTemplateRenderContext> {
  const ownerId = params.ownerId ?? "global";

  // Default “empty” context: should never break Liquid rendering.
  const base: PromptTemplateRenderContext = {
    char: {},
    user: {},
    chat: {},
    messages: [],
    rag: {},
    now: new Date().toISOString(),
  };

  const [selectedUser] = await Promise.all([
    getSelectedUserPerson({ ownerId }),
  ]);

  base.user = selectedUser ?? {};

  if (!params.chatId) {
    if (params.entityProfileId) {
      const entityProfile = await getEntityProfileById(params.entityProfileId);
      base.char = entityProfile?.spec ?? {};
    }
    return base;
  }

  const chat = await getChatById(params.chatId);
  const branchId = params.branchId ?? chat?.activeBranchId ?? null;
  const entityProfileId = params.entityProfileId ?? chat?.entityProfileId ?? null;

  // If chat exists but branch is not resolved (shouldn't happen in v1), keep empty history.
  const history =
    branchId && params.chatId
      ? await listMessagesForPrompt({
          chatId: params.chatId,
          branchId,
          limit: params.historyLimit ?? 50,
          excludeMessageIds: params.excludeMessageIds,
        })
      : [];

  const entityProfile = entityProfileId
    ? await getEntityProfileById(entityProfileId)
    : null;

  return {
    char: entityProfile?.spec ?? {},
    user: selectedUser ?? {},
    chat: {
      id: chat?.id ?? params.chatId,
      title: chat?.title ?? "",
      branchId: branchId ?? params.branchId ?? null,
      createdAt: chat?.createdAt ?? null,
      updatedAt: chat?.updatedAt ?? null,
    },
    messages: history.map((m) => ({ role: m.role, content: m.content })),
    rag: {},
    now: new Date().toISOString(),
  };
}

