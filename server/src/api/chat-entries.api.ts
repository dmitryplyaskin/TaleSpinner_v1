import express, { type Request, type Response } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";
import { initSse, type SseWriter } from "@core/sse/sse";

import { chatIdParamsSchema } from "../chat-core/schemas";
import { getChatById } from "../services/chat-core/chats-repository";
import { abortGeneration } from "../services/chat-core/generation-runtime";
import { rerenderGreetingTemplatesIfPreplay } from "../services/chat-core/greeting-template-rerender";
import { buildPromptTemplateRenderContext } from "../services/chat-core/prompt-template-context";
import { renderLiquidTemplate } from "../services/chat-core/prompt-template-renderer";
import { getSelectedUserPerson } from "../services/chat-core/user-persons-repository";
import { getBranchCurrentTurn, incrementBranchTurn } from "../services/chat-entry-parts/branch-turn-repository";
import {
  createEntryWithVariant,
  getActiveVariantWithParts,
  getEntryById,
  listEntries,
  listEntriesWithActiveVariants,
  softDeleteEntry,
  updateEntryMeta,
} from "../services/chat-entry-parts/entries-repository";
import {
  applyManualEditToPart,
  createPart,
  softDeletePart,
} from "../services/chat-entry-parts/parts-repository";
import { getUiProjection } from "../services/chat-entry-parts/projection";
import {
  createVariant,
  deleteVariant,
  getVariantById,
  listEntryVariants,
  selectActiveVariant,
} from "../services/chat-entry-parts/variants-repository";
import { runChatGenerationV3 } from "../services/chat-generation-v3/run-chat-generation-v3";

import type { PromptTemplateRenderContext } from "../services/chat-core/prompt-template-renderer";
import type { RunEvent } from "../services/chat-generation-v3/contracts";
import type { Entry, Part, Variant } from "@shared/types/chat-entry-parts";

const router = express.Router();

type UserPersonaSnapshot = {
  id: string;
  name: string;
  avatarUrl?: string;
};

type UserEntryMeta = {
  requestId: string | null;
  personaSnapshot?: UserPersonaSnapshot;
  templateRender?: {
    engine: "liquidjs";
    rawContent: string;
    renderedContent: string;
    changed: boolean;
    renderedAt: string;
    source?: "entry_create" | "manual_edit";
  };
};

type SelectedUserLike = {
  id: string;
  name: string;
  avatarUrl?: string;
} | null;

const TEMPLATE_MAX_PASSES = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function buildUserEntryMeta(params: {
  requestId?: string;
  selectedUser: SelectedUserLike;
  templateRender?: UserEntryMeta["templateRender"];
}): UserEntryMeta {
  const meta: UserEntryMeta = {
    requestId: params.requestId ?? null,
  };

  if (params.templateRender) {
    meta.templateRender = params.templateRender;
  }

  if (!params.selectedUser) return meta;

  meta.personaSnapshot = {
    id: params.selectedUser.id,
    name: params.selectedUser.name,
    avatarUrl: params.selectedUser.avatarUrl,
  };

  return meta;
}

export async function renderUserInputWithLiquid(params: {
  content: string;
  context: PromptTemplateRenderContext;
  options?: {
    allowEmptyResult?: boolean;
  };
}): Promise<{ renderedContent: string; changed: boolean }> {
  let renderedContent = "";
  try {
    renderedContent = String(
      await renderLiquidTemplate({
        templateText: params.content,
        context: params.context,
        options: {
          strictVariables: false,
          maxPasses: TEMPLATE_MAX_PASSES,
        },
      })
    );
  } catch (error) {
    throw new HttpError(
      400,
      `User input template render error: ${error instanceof Error ? error.message : String(error)}`,
      "VALIDATION_ERROR"
    );
  }

  if (!params.options?.allowEmptyResult && renderedContent.trim().length === 0) {
    throw new HttpError(
      400,
      "User input became empty after Liquid rendering",
      "VALIDATION_ERROR"
    );
  }

  return {
    renderedContent,
    changed: renderedContent !== params.content,
  };
}

function ensureSseRequested(req: Request): void {
  const accept = String(req.headers.accept ?? "");
  if (!accept.includes("text/event-stream")) {
    throw new HttpError(406, "Нужен Accept: text/event-stream", "NOT_ACCEPTABLE");
  }
}

function mapRunStatusToStreamDoneStatus(status: "done" | "failed" | "aborted" | "error"): "done" | "aborted" | "error" {
  if (status === "done") return "done";
  if (status === "aborted") return "aborted";
  return "error";
}

type RunProxySummary = {
  runStatus: "done" | "failed" | "aborted" | "error" | null;
  sawTextDelta: boolean;
};

async function proxyRunEventsToSse(params: {
  sse: SseWriter;
  events: AsyncGenerator<RunEvent>;
  envBase: Record<string, unknown>;
  reqClosed: () => boolean;
  abortController: AbortController;
  onGenerationId: (generationId: string) => void;
}): Promise<RunProxySummary> {
  let generationId: string | null = null;
  const summary: RunProxySummary = {
    runStatus: null,
    sawTextDelta: false,
  };

  for await (const evt of params.events) {
    if (evt.type === "run.started") {
      generationId = evt.data.generationId;
      params.onGenerationId(generationId);
      if (params.reqClosed()) {
        params.abortController.abort();
        abortGeneration(generationId);
      }
      params.sse.send("llm.stream.meta", { ...params.envBase, generationId });
    }

    const eventGenerationId =
      generationId ?? (evt.type === "run.started" ? evt.data.generationId : null);
    const eventEnvelope = {
      ...params.envBase,
      generationId: eventGenerationId,
      runId: evt.runId,
      seq: evt.seq,
      ...evt.data,
    };
    params.sse.send(evt.type, eventEnvelope);

    if (evt.type === "main_llm.delta") {
      if (evt.data.content.length > 0) summary.sawTextDelta = true;
      params.sse.send("llm.stream.delta", {
        ...params.envBase,
        generationId: eventGenerationId,
        content: evt.data.content,
      });
      continue;
    }

    if (evt.type === "main_llm.reasoning_delta") {
      if (evt.data.content.length > 0) summary.sawTextDelta = true;
      params.sse.send("llm.stream.reasoning_delta", {
        ...params.envBase,
        generationId: eventGenerationId,
        content: evt.data.content,
      });
      continue;
    }

    if (evt.type === "main_llm.finished" && evt.data.status === "error") {
      params.sse.send("llm.stream.error", {
        ...params.envBase,
        generationId: eventGenerationId,
        code: "generation_error",
        message: evt.data.message ?? "generation_error",
      });
      continue;
    }

    if (evt.type === "run.finished") {
      summary.runStatus = evt.data.status;
      params.sse.send("llm.stream.done", {
        ...params.envBase,
        generationId: eventGenerationId,
        status: mapRunStatusToStreamDoneStatus(evt.data.status),
      });
      if (evt.data.status !== "done" && evt.data.message) {
        params.sse.send("llm.stream.error", {
          ...params.envBase,
          generationId: eventGenerationId,
          code: "generation_error",
          message: evt.data.message,
        });
      }
      break;
    }
  }

  return summary;
}

export function resolveContinueUserTurnTarget(params: {
  lastEntry: Entry | null;
  lastVariant: Variant | null;
}): { userEntryId: string; userMainPartId: string } {
  if (!params.lastEntry || params.lastEntry.role !== "user") {
    throw new HttpError(
      409,
      "Продолжение доступно только когда последнее сообщение в ветке от пользователя",
      "CONTINUE_NOT_AVAILABLE"
    );
  }

  const variant = params.lastVariant;
  if (!variant) {
    throw new HttpError(
      409,
      "У последнего сообщения пользователя нет активного варианта",
      "CONTINUE_NOT_AVAILABLE"
    );
  }

  const editableMainParts = (variant.parts ?? [])
    .filter(isEditableMainPart)
    .sort(sortPartsStable);
  const userMainPart =
    editableMainParts.length > 0
      ? editableMainParts[editableMainParts.length - 1]
      : null;

  if (!userMainPart) {
    throw new HttpError(
      409,
      "У последнего сообщения пользователя нет редактируемой основной части",
      "CONTINUE_NOT_AVAILABLE"
    );
  }

  return {
    userEntryId: params.lastEntry.entryId,
    userMainPartId: userMainPart.partId,
  };
}

async function createAssistantReasoningPart(params: {
  ownerId: string;
  variantId: string;
  createdTurn: number;
  requestId?: string;
}): Promise<Part> {
  return createPart({
    ownerId: params.ownerId,
    variantId: params.variantId,
    channel: "reasoning",
    order: -1,
    payload: "",
    payloadFormat: "markdown",
    visibility: { ui: "always", prompt: false },
    ui: { rendererId: "markdown" },
    prompt: { serializerId: "asText" },
    lifespan: "infinite",
    createdTurn: params.createdTurn,
    source: "llm",
    requestId: params.requestId,
  });
}

function isVariantTextuallyEmpty(variant: Variant): boolean {
  const parts = (variant.parts ?? []).filter((part) => !part.softDeleted);
  if (parts.length === 0) return true;

  return parts.every((part) => {
    if (typeof part.payload !== "string") return false;
    return part.payload.trim().length === 0;
  });
}

async function cleanupEmptyGenerationVariants(entryId: string): Promise<void> {
  let variants = await listEntryVariants({ entryId });
  for (const variant of variants) {
    if (variants.length <= 1) break;
    if (variant.kind !== "generation") continue;
    if (!isVariantTextuallyEmpty(variant)) continue;
    try {
      await deleteVariant({ entryId, variantId: variant.variantId });
    } catch {
      // best-effort cleanup; ignore failures for this variant
    }
    variants = variants.filter((v) => v.variantId !== variant.variantId);
  }
}

const listEntriesQuerySchema = z.object({
  branchId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  before: z.coerce.number().int().positive().optional(), // createdAt ms cursor
});

router.get(
  "/chats/:id/entries",
  validate({ params: chatIdParamsSchema, query: listEntriesQuerySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const query = req.query as unknown as { branchId?: string; limit: number; before?: number };

    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const branchId = query.branchId || chat.activeBranchId;
    if (!branchId) {
      throw new HttpError(400, "branchId обязателен (нет activeBranchId)", "VALIDATION_ERROR");
    }

    try {
      await rerenderGreetingTemplatesIfPreplay({
        ownerId: chat.ownerId,
        chatId: params.id,
        branchId,
        entityProfileId: chat.entityProfileId,
      });
    } catch {
      // best-effort rerender; never fail the entries listing
    }

    const entries = await listEntriesWithActiveVariants({
      chatId: params.id,
      branchId,
      limit: query.limit,
      before: query.before,
    });

    const currentTurn = await getBranchCurrentTurn({ branchId });
    return { data: { branchId, currentTurn, entries } };
  })
);

const createEntryBodySchema = z.object({
  ownerId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  role: z.enum(["user", "system"]),
  content: z.string().default(""),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
  requestId: z.string().min(1).optional(),
});

router.post(
  "/chats/:id/entries",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.params as unknown as { id: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    ensureSseRequested(req);

    const body = createEntryBodySchema.parse(req.body);
    const ownerId = body.ownerId ?? "global";
    const branchId = body.branchId || chat.activeBranchId;
    if (!branchId) throw new HttpError(400, "branchId обязателен (нет activeBranchId)", "VALIDATION_ERROR");

    const templateContext = await buildPromptTemplateRenderContext({
      ownerId,
      chatId: params.id,
      branchId,
      entityProfileId: chat.entityProfileId,
      historyLimit: 50,
    });
    const { renderedContent, changed } = await renderUserInputWithLiquid({
      content: body.content ?? "",
      context: templateContext,
    });

    const sse = initSse({ res });

    let generationId: string | null = null;
    const runAbortController = new AbortController();
    let shouldAbortOnClose = false;
    let reqClosed = false;
    req.on("close", () => {
      reqClosed = true;
      if (shouldAbortOnClose) {
        runAbortController.abort();
        if (generationId) abortGeneration(generationId);
      }
      sse.close();
    });

    try {
      const currentTurn = await getBranchCurrentTurn({ branchId });
      const selectedUser = await getSelectedUserPerson({ ownerId });
      const userEntryMeta = buildUserEntryMeta({
        requestId: body.requestId,
        selectedUser,
        templateRender: {
          engine: "liquidjs",
          rawContent: body.content ?? "",
          renderedContent,
          changed,
          renderedAt: new Date().toISOString(),
          source: "entry_create",
        },
      });

      const user = await createEntryWithVariant({
        ownerId,
        chatId: params.id,
        branchId,
        role: body.role,
        variantKind: "manual_edit",
        meta: userEntryMeta,
      });

      const userMainPart = await createPart({
        ownerId,
        variantId: user.variant.variantId,
        channel: "main",
        order: 0,
        payload: renderedContent,
        payloadFormat: "markdown",
        visibility: { ui: "always", prompt: true },
        ui: { rendererId: "markdown" },
        prompt: { serializerId: "asText" },
        lifespan: "infinite",
        createdTurn: currentTurn,
        source: "user",
        requestId: body.requestId,
      });

      const newTurn = await incrementBranchTurn({ branchId });

      const assistant = await createEntryWithVariant({
        ownerId,
        chatId: params.id,
        branchId,
        role: "assistant",
        variantKind: "generation",
      });

      const assistantMainPart = await createPart({
        ownerId,
        variantId: assistant.variant.variantId,
        channel: "main",
        order: 0,
        payload: "",
        payloadFormat: "markdown",
        visibility: { ui: "always", prompt: true },
        ui: { rendererId: "markdown" },
        prompt: { serializerId: "asText" },
        lifespan: "infinite",
        createdTurn: newTurn,
        source: "llm",
      });
      const assistantReasoningPart = await createAssistantReasoningPart({
        ownerId,
        variantId: assistant.variant.variantId,
        createdTurn: newTurn,
        requestId: body.requestId,
      });

      shouldAbortOnClose = true;
      if (reqClosed) {
        runAbortController.abort();
        if (generationId) abortGeneration(generationId);
      }

      const envBase = {
        chatId: params.id,
        branchId,
        userEntryId: user.entry.entryId,
        userMainPartId: userMainPart.partId,
        userRenderedContent: renderedContent,
        assistantEntryId: assistant.entry.entryId,
        assistantVariantId: assistant.variant.variantId,
        assistantMainPartId: assistantMainPart.partId,
        assistantReasoningPartId: assistantReasoningPart.partId,
      };
      await proxyRunEventsToSse({
        sse,
        envBase,
        reqClosed: () => reqClosed,
        abortController: runAbortController,
        onGenerationId: (id) => {
          generationId = id;
        },
        events: runChatGenerationV3({
          ownerId,
          chatId: params.id,
          branchId,
          entityProfileId: chat.entityProfileId,
          trigger: "generate",
          settings: body.settings,
          abortController: runAbortController,
          persistenceTarget: {
            mode: "entry_parts",
            assistantEntryId: assistant.entry.entryId,
            assistantMainPartId: assistantMainPart.partId,
            assistantReasoningPartId: assistantReasoningPart.partId,
          },
          userTurnTarget: {
            mode: "entry_parts",
            userEntryId: user.entry.entryId,
            userMainPartId: userMainPart.partId,
          },
        }),
      });

    } finally {
      sse.close();
    }

    return;
  })
);

const continueEntryBodySchema = z.object({
  ownerId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
  requestId: z.string().min(1).optional(),
});

router.post(
  "/chats/:id/entries/continue",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.params as unknown as { id: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");
    ensureSseRequested(req);

    const body = continueEntryBodySchema.parse(req.body);
    const ownerId = body.ownerId ?? "global";
    const branchId = body.branchId || chat.activeBranchId;
    if (!branchId) throw new HttpError(400, "branchId обязателен (нет activeBranchId)", "VALIDATION_ERROR");

    const sse = initSse({ res });
    let generationId: string | null = null;
    const runAbortController = new AbortController();
    let shouldAbortOnClose = false;
    let reqClosed = false;
    req.on("close", () => {
      reqClosed = true;
      if (shouldAbortOnClose) {
        runAbortController.abort();
        if (generationId) abortGeneration(generationId);
      }
      sse.close();
    });

    try {
      const lastEntries = await listEntries({
        chatId: params.id,
        branchId,
        limit: 1,
      });
      const lastEntry = lastEntries.length > 0 ? lastEntries[lastEntries.length - 1] : null;
      const lastVariant = lastEntry ? await getActiveVariantWithParts({ entry: lastEntry }) : null;
      const userTurnTarget = resolveContinueUserTurnTarget({ lastEntry, lastVariant });

      const newTurn = await incrementBranchTurn({ branchId });
      const assistant = await createEntryWithVariant({
        ownerId,
        chatId: params.id,
        branchId,
        role: "assistant",
        variantKind: "generation",
      });
      const assistantMainPart = await createPart({
        ownerId,
        variantId: assistant.variant.variantId,
        channel: "main",
        order: 0,
        payload: "",
        payloadFormat: "markdown",
        visibility: { ui: "always", prompt: true },
        ui: { rendererId: "markdown" },
        prompt: { serializerId: "asText" },
        lifespan: "infinite",
        createdTurn: newTurn,
        source: "llm",
        requestId: body.requestId,
      });
      const assistantReasoningPart = await createAssistantReasoningPart({
        ownerId,
        variantId: assistant.variant.variantId,
        createdTurn: newTurn,
        requestId: body.requestId,
      });

      shouldAbortOnClose = true;
      if (reqClosed) {
        runAbortController.abort();
        if (generationId) abortGeneration(generationId);
      }

      const envBase = {
        chatId: params.id,
        branchId,
        userEntryId: userTurnTarget.userEntryId,
        assistantEntryId: assistant.entry.entryId,
        assistantVariantId: assistant.variant.variantId,
        assistantMainPartId: assistantMainPart.partId,
        assistantReasoningPartId: assistantReasoningPart.partId,
      };

      await proxyRunEventsToSse({
        sse,
        envBase,
        reqClosed: () => reqClosed,
        abortController: runAbortController,
        onGenerationId: (id) => {
          generationId = id;
        },
        events: runChatGenerationV3({
          ownerId,
          chatId: params.id,
          branchId,
          entityProfileId: chat.entityProfileId,
          trigger: "generate",
          settings: body.settings,
          abortController: runAbortController,
          persistenceTarget: {
            mode: "entry_parts",
            assistantEntryId: assistant.entry.entryId,
            assistantMainPartId: assistantMainPart.partId,
            assistantReasoningPartId: assistantReasoningPart.partId,
          },
          userTurnTarget: {
            mode: "entry_parts",
            userEntryId: userTurnTarget.userEntryId,
            userMainPartId: userTurnTarget.userMainPartId,
          },
        }),
      });

    } finally {
      sse.close();
    }

    return;
  })
);

const entryIdParamsSchema = z.object({ id: z.string().min(1) });
const regenerateBodySchema = z.object({
  ownerId: z.string().min(1).optional(),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
  requestId: z.string().min(1).optional(),
});

router.post(
  "/entries/:id/regenerate",
  validate({ params: entryIdParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.params as unknown as { id: string };
    ensureSseRequested(req);

    const body = regenerateBodySchema.parse(req.body);
    const ownerId = body.ownerId ?? "global";

    const entry = await getEntryById({ entryId: params.id });
    if (!entry) throw new HttpError(404, "Entry не найден", "NOT_FOUND");
    if (entry.role !== "assistant") {
      throw new HttpError(400, "regenerate поддерживается только для role=assistant", "VALIDATION_ERROR");
    }

    const chat = await getChatById(entry.chatId);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const sse = initSse({ res });

    let generationId: string | null = null;
    const runAbortController = new AbortController();
    let shouldAbortOnClose = false;
    let reqClosed = false;
    req.on("close", () => {
      reqClosed = true;
      if (shouldAbortOnClose) {
        runAbortController.abort();
        if (generationId) abortGeneration(generationId);
      }
      sse.close();
    });

    try {
      const newTurn = await incrementBranchTurn({ branchId: entry.branchId });

      const newVariant = await createVariant({
        ownerId,
        entryId: entry.entryId,
        kind: "generation",
      });
      await selectActiveVariant({ entryId: entry.entryId, variantId: newVariant.variantId });

      const assistantMainPart = await createPart({
        ownerId,
        variantId: newVariant.variantId,
        channel: "main",
        order: 0,
        payload: "",
        payloadFormat: "markdown",
        visibility: { ui: "always", prompt: true },
        ui: { rendererId: "markdown" },
        prompt: { serializerId: "asText" },
        lifespan: "infinite",
        createdTurn: newTurn,
        source: "llm",
      });
      const assistantReasoningPart = await createAssistantReasoningPart({
        ownerId,
        variantId: newVariant.variantId,
        createdTurn: newTurn,
        requestId: body.requestId,
      });

      shouldAbortOnClose = true;
      if (reqClosed) {
        runAbortController.abort();
        if (generationId) abortGeneration(generationId);
      }

      const envBase = {
        chatId: entry.chatId,
        branchId: entry.branchId,
        assistantEntryId: entry.entryId,
        assistantVariantId: newVariant.variantId,
        assistantMainPartId: assistantMainPart.partId,
        assistantReasoningPartId: assistantReasoningPart.partId,
      };
      await proxyRunEventsToSse({
        sse,
        envBase,
        reqClosed: () => reqClosed,
        abortController: runAbortController,
        onGenerationId: (id) => {
          generationId = id;
        },
        events: runChatGenerationV3({
          ownerId,
          chatId: entry.chatId,
          branchId: entry.branchId,
          entityProfileId: chat.entityProfileId,
          trigger: "regenerate",
          settings: body.settings,
          abortController: runAbortController,
          persistenceTarget: {
            mode: "entry_parts",
            assistantEntryId: entry.entryId,
            assistantMainPartId: assistantMainPart.partId,
            assistantReasoningPartId: assistantReasoningPart.partId,
          },
        }),
      });

      // Always run best-effort cleanup for empty generation variants.
      // This removes both the current aborted-empty variant and older empty leftovers.
      await cleanupEmptyGenerationVariants(entry.entryId);
    } finally {
      sse.close();
    }

    return;
  })
);

router.get(
  "/entries/:id/variants",
  validate({ params: entryIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const entry = await getEntryById({ entryId: params.id });
    if (!entry) throw new HttpError(404, "Entry не найден", "NOT_FOUND");
    const variants = await listEntryVariants({ entryId: entry.entryId });
    return { data: variants };
  })
);

const selectVariantParamsSchema = z.object({
  id: z.string().min(1), // entryId
  variantId: z.string().min(1),
});

router.post(
  "/entries/:id/variants/:variantId/select",
  validate({ params: selectVariantParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string; variantId: string };
    const entry = await getEntryById({ entryId: params.id });
    if (!entry) throw new HttpError(404, "Entry не найден", "NOT_FOUND");

    const variant = await getVariantById({ variantId: params.variantId });
    if (!variant || variant.entryId !== entry.entryId) {
      throw new HttpError(404, "Variant не найден", "NOT_FOUND");
    }

    await selectActiveVariant({ entryId: entry.entryId, variantId: params.variantId });

    return { data: { entryId: entry.entryId, activeVariantId: params.variantId } };
  })
);

const manualEditBodySchema = z.object({
  ownerId: z.string().min(1).optional(),
  partId: z.string().min(1).optional(),
  content: z.string(),
  requestId: z.string().min(1).optional(),
});

function sortPartsStable(a: Part, b: Part): number {
  if (a.order !== b.order) return a.order - b.order;
  if (a.partId < b.partId) return -1;
  if (a.partId > b.partId) return 1;
  return 0;
}

function isEditableMainPart(part: Part): boolean {
  if (part.channel !== "main") return false;
  return isEditablePart(part);
}

function isEditablePart(part: Part): boolean {
  return (
    !part.softDeleted &&
    typeof part.payload === "string" &&
    (part.payloadFormat === "text" || part.payloadFormat === "markdown")
  );
}

router.post(
  "/entries/:id/manual-edit",
  validate({ params: entryIdParamsSchema, body: manualEditBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const body = manualEditBodySchema.parse(req.body);

    const entry = await getEntryById({ entryId: params.id });
    if (!entry) throw new HttpError(404, "Entry не найден", "NOT_FOUND");

    const activeVariant = await getActiveVariantWithParts({ entry });
    if (!activeVariant) {
      throw new HttpError(400, "Active variant не найден", "VALIDATION_ERROR");
    }

    const currentTurn = await getBranchCurrentTurn({ branchId: entry.branchId });
    const sourceParts = (activeVariant.parts ?? []).filter((p) => !p.softDeleted).sort(sortPartsStable);

    if (sourceParts.length === 0) {
      throw new HttpError(400, "В активном варианте нет частей для редактирования", "VALIDATION_ERROR");
    }

    let targetPartId: string | null = null;
    if (body.partId) {
      const target = sourceParts.find((p) => p.partId === body.partId) ?? null;
      if (!target || !isEditablePart(target)) {
        throw new HttpError(400, "partId не найден или не поддерживает редактирование", "VALIDATION_ERROR");
      }
      targetPartId = target.partId;
    } else {
      const visible = getUiProjection(entry, activeVariant, currentTurn, { debugEnabled: false });
      const editableMainVisible = visible.filter(isEditableMainPart);
      const editableVisible = visible.filter(isEditablePart);
      const fallbackMain =
        editableMainVisible.length > 0 ? editableMainVisible[editableMainVisible.length - 1] : null;
      const fallback =
        fallbackMain ?? (editableVisible.length > 0 ? editableVisible[editableVisible.length - 1] : null);
      if (!fallback) {
        throw new HttpError(400, "Не найден editable part для редактирования", "VALIDATION_ERROR");
      }
      targetPartId = fallback.partId;
    }

    const targetPart = sourceParts.find((p) => p.partId === targetPartId) ?? null;
    if (!targetPart) {
      throw new HttpError(400, "partId не найден в активном варианте", "VALIDATION_ERROR");
    }

    const ownerId = body.ownerId ?? "global";
    const templateContext = await buildPromptTemplateRenderContext({
      ownerId,
      chatId: entry.chatId,
      branchId: entry.branchId,
      historyLimit: 50,
    });
    const { renderedContent, changed } = await renderUserInputWithLiquid({
      content: body.content,
      context: templateContext,
      options: { allowEmptyResult: true },
    });

    await applyManualEditToPart({
      partId: targetPart.partId,
      payloadText: renderedContent,
      payloadFormat: targetPart.payloadFormat,
      requestId: body.requestId,
    });

    const nextMeta = {
      ...(isRecord(entry.meta) ? entry.meta : {}),
      templateRender: {
        engine: "liquidjs",
        rawContent: body.content,
        renderedContent,
        changed,
        renderedAt: new Date().toISOString(),
        source: "manual_edit",
      },
    };
    await updateEntryMeta({
      entryId: entry.entryId,
      meta: nextMeta,
    });

    return {
      data: {
        entryId: entry.entryId,
        activeVariantId: activeVariant.variantId,
      },
    };
  })
);

router.post(
  "/entries/:id/variants/:variantId/soft-delete",
  validate({ params: selectVariantParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string; variantId: string };
    const entry = await getEntryById({ entryId: params.id });
    if (!entry) throw new HttpError(404, "Entry не найден", "NOT_FOUND");

    const variant = await getVariantById({ variantId: params.variantId });
    if (!variant || variant.entryId !== entry.entryId) {
      throw new HttpError(404, "Variant не найден", "NOT_FOUND");
    }

    const variants = await listEntryVariants({ entryId: entry.entryId });
    if (variants.length <= 1) {
      throw new HttpError(400, "Нельзя удалить последний вариант", "VALIDATION_ERROR");
    }

    const deleted = await deleteVariant({
      entryId: entry.entryId,
      variantId: params.variantId,
    });

    return { data: deleted };
  })
);

const softDeleteEntryBodySchema = z.object({
  by: z.enum(["user", "agent"]).optional().default("user"),
});

router.post(
  "/entries/:id/soft-delete",
  validate({ params: entryIdParamsSchema, body: softDeleteEntryBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const body = softDeleteEntryBodySchema.parse(req.body);
    const entry = await getEntryById({ entryId: params.id });
    if (!entry) throw new HttpError(404, "Entry не найден", "NOT_FOUND");

    await softDeleteEntry({ entryId: entry.entryId, by: body.by });
    return { data: { id: entry.entryId } };
  })
);

const partIdParamsSchema = z.object({ id: z.string().min(1) });
const softDeletePartBodySchema = z.object({
  by: z.enum(["user", "agent"]).optional().default("user"),
});

router.post(
  "/parts/:id/soft-delete",
  validate({ params: partIdParamsSchema, body: softDeletePartBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const body = softDeletePartBodySchema.parse(req.body);
    await softDeletePart({ partId: params.id, by: body.by });
    return { data: { id: params.id } };
  })
);

export default router;
