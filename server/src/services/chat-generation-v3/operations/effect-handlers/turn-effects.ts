import { safeJsonStringify } from "../../../../chat-core/json";
import {
  createPart,
  getPartWithVariantContextById,
  updatePartPayloadText,
} from "../../../chat-entry-parts/parts-repository";

import type { RunPersistenceTarget, UserTurnTarget } from "../../contracts";

export async function persistAssistantTurnText(params: {
  target: RunPersistenceTarget | undefined;
  text: string;
}): Promise<{
  previousText: string | null;
  assistantEntryId: string;
  assistantMainPartId: string;
}> {
  const target = params.target;
  if (!target) {
    throw new Error("Assistant persistence target is required for turn.assistant.* effect");
  }

  const context = await getPartWithVariantContextById({
    partId: target.assistantMainPartId,
  });
  if (!context) throw new Error("Assistant target part not found");
  if (context.entryId !== target.assistantEntryId) {
    throw new Error("Assistant target entry mismatch");
  }

  const previousText =
    typeof context.part.payload === "string"
      ? context.part.payload
      : safeJsonStringify(context.part.payload, "");
  await updatePartPayloadText({
    partId: target.assistantMainPartId,
    payloadText: params.text,
    payloadFormat: "markdown",
  });

  return {
    previousText,
    assistantEntryId: target.assistantEntryId,
    assistantMainPartId: target.assistantMainPartId,
  };
}

export async function persistUserTurnText(params: {
  target: UserTurnTarget | undefined;
  text: string;
}): Promise<{
  previousText: string | null;
  replacedPartId: string;
  canonicalPartId: string;
  userEntryId: string;
}> {
  const target = params.target;
  if (!target) {
    throw new Error("User turn target is required for turn.user.* effect");
  }

  const context = await getPartWithVariantContextById({
    partId: target.userMainPartId,
  });
  if (!context) {
    throw new Error("User turn target part not found");
  }
  if (context.entryId !== target.userEntryId) {
    throw new Error("User turn target entry mismatch");
  }

  const previousText =
    typeof context.part.payload === "string"
      ? context.part.payload
      : safeJsonStringify(context.part.payload, "");
  const nextTags = Array.from(
    new Set([...(Array.isArray(context.part.tags) ? context.part.tags : []), "canonicalization"])
  );

  const canonicalPart = await createPart({
    ownerId: context.ownerId,
    variantId: context.variantId,
    channel: context.part.channel,
    order: context.part.order,
    payload: params.text,
    payloadFormat: context.part.payloadFormat ?? "markdown",
    schemaId: context.part.schemaId,
    label: context.part.label,
    visibility: context.part.visibility,
    ui: context.part.ui,
    prompt: context.part.prompt,
    lifespan: context.part.lifespan,
    createdTurn: context.part.createdTurn,
    source: "agent",
    agentId: context.part.agentId,
    model: context.part.model,
    requestId: context.part.requestId,
    replacesPartId: context.part.partId,
    tags: nextTags,
  });

  return {
    previousText,
    replacedPartId: context.part.partId,
    canonicalPartId: canonicalPart.partId,
    userEntryId: context.entryId,
  };
}
