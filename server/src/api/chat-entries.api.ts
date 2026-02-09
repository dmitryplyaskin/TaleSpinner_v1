import express, { type Request, type Response } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";
import { initSse } from "@core/sse/sse";

import { chatIdParamsSchema } from "../chat-core/schemas";
import { getChatById } from "../services/chat-core/chats-repository";
import { abortGeneration } from "../services/chat-core/generation-runtime";
import { getBranchCurrentTurn, incrementBranchTurn } from "../services/chat-entry-parts/branch-turn-repository";
import {
  createEntryWithVariant,
  getActiveVariantWithParts,
  getEntryById,
  listEntriesWithActiveVariants,
  softDeleteEntry,
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

import type { Part } from "@shared/types/chat-entry-parts";

const router = express.Router();

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

    const accept = String(req.headers.accept ?? "");
    const wantsSse = accept.includes("text/event-stream");
    if (!wantsSse) {
      throw new HttpError(406, "Нужен Accept: text/event-stream", "NOT_ACCEPTABLE");
    }

    const body = createEntryBodySchema.parse(req.body);
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
      const currentTurn = await getBranchCurrentTurn({ branchId });

      const user = await createEntryWithVariant({
        ownerId,
        chatId: params.id,
        branchId,
        role: body.role,
        variantKind: "manual_edit",
        meta: { requestId: body.requestId ?? null },
      });

      const userMainPart = await createPart({
        ownerId,
        variantId: user.variant.variantId,
        channel: "main",
        order: 0,
        payload: body.content ?? "",
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

      shouldAbortOnClose = true;
      if (reqClosed) {
        runAbortController.abort();
        if (generationId) abortGeneration(generationId);
      }

      const envBase = {
        chatId: params.id,
        branchId,
        userEntryId: user.entry.entryId,
        assistantEntryId: assistant.entry.entryId,
        assistantVariantId: assistant.variant.variantId,
        assistantMainPartId: assistantMainPart.partId,
      };

      for await (const evt of runChatGenerationV3({
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
        },
        userTurnTarget: {
          mode: "entry_parts",
          userEntryId: user.entry.entryId,
          userMainPartId: userMainPart.partId,
        },
      })) {
        if (evt.type === "run.started") {
          generationId = evt.data.generationId;
          if (reqClosed) {
            runAbortController.abort();
            abortGeneration(generationId);
          }
          sse.send("llm.stream.meta", { ...envBase, generationId });
        }

        const eventGenerationId =
          generationId ?? (evt.type === "run.started" ? evt.data.generationId : null);
        const eventEnvelope = {
          ...envBase,
          generationId: eventGenerationId,
          runId: evt.runId,
          seq: evt.seq,
          ...evt.data,
        };
        sse.send(evt.type, eventEnvelope);

        if (evt.type === "main_llm.delta") {
          sse.send("llm.stream.delta", {
            ...envBase,
            generationId: eventGenerationId,
            content: evt.data.content,
          });
          continue;
        }

        if (evt.type === "main_llm.finished" && evt.data.status === "error") {
          sse.send("llm.stream.error", {
            ...envBase,
            generationId: eventGenerationId,
            code: "generation_error",
            message: evt.data.message ?? "generation_error",
          });
          continue;
        }

        if (evt.type === "run.finished") {
          sse.send("llm.stream.done", {
            ...envBase,
            generationId: eventGenerationId,
            status:
              evt.data.status === "done"
                ? "done"
                : evt.data.status === "aborted"
                  ? "aborted"
                  : "error",
          });
          if (evt.data.status !== "done" && evt.data.message) {
            sse.send("llm.stream.error", {
              ...envBase,
              generationId: eventGenerationId,
              code: "generation_error",
              message: evt.data.message,
            });
          }
          break;
        }
      }
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
    const accept = String(req.headers.accept ?? "");
    const wantsSse = accept.includes("text/event-stream");
    if (!wantsSse) {
      throw new HttpError(406, "Нужен Accept: text/event-stream", "NOT_ACCEPTABLE");
    }

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
      };

      for await (const evt of runChatGenerationV3({
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
        },
      })) {
        if (evt.type === "run.started") {
          generationId = evt.data.generationId;
          if (reqClosed) {
            runAbortController.abort();
            abortGeneration(generationId);
          }
          sse.send("llm.stream.meta", { ...envBase, generationId });
        }

        const eventGenerationId =
          generationId ?? (evt.type === "run.started" ? evt.data.generationId : null);
        const eventEnvelope = {
          ...envBase,
          generationId: eventGenerationId,
          runId: evt.runId,
          seq: evt.seq,
          ...evt.data,
        };
        sse.send(evt.type, eventEnvelope);

        if (evt.type === "main_llm.delta") {
          sse.send("llm.stream.delta", {
            ...envBase,
            generationId: eventGenerationId,
            content: evt.data.content,
          });
          continue;
        }

        if (evt.type === "main_llm.finished" && evt.data.status === "error") {
          sse.send("llm.stream.error", {
            ...envBase,
            generationId: eventGenerationId,
            code: "generation_error",
            message: evt.data.message ?? "generation_error",
          });
          continue;
        }

        if (evt.type === "run.finished") {
          sse.send("llm.stream.done", {
            ...envBase,
            generationId: eventGenerationId,
            status:
              evt.data.status === "done"
                ? "done"
                : evt.data.status === "aborted"
                  ? "aborted"
                  : "error",
          });
          if (evt.data.status !== "done" && evt.data.message) {
            sse.send("llm.stream.error", {
              ...envBase,
              generationId: eventGenerationId,
              code: "generation_error",
              message: evt.data.message,
            });
          }
          break;
        }
      }
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
  return (
    part.channel === "main" &&
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
      if (!target || !isEditableMainPart(target)) {
        throw new HttpError(400, "partId не найден или не поддерживает редактирование", "VALIDATION_ERROR");
      }
      targetPartId = target.partId;
    } else {
      const visible = getUiProjection(entry, activeVariant, currentTurn, { debugEnabled: false });
      const editableVisible = visible.filter(isEditableMainPart);
      const fallback =
        editableVisible.length > 0 ? editableVisible[editableVisible.length - 1] : null;
      if (!fallback) {
        throw new HttpError(400, "Не найден editable main-part для редактирования", "VALIDATION_ERROR");
      }
      targetPartId = fallback.partId;
    }

    const targetPart = sourceParts.find((p) => p.partId === targetPartId) ?? null;
    if (!targetPart) {
      throw new HttpError(400, "partId не найден в активном варианте", "VALIDATION_ERROR");
    }

    await applyManualEditToPart({
      partId: targetPart.partId,
      payloadText: body.content,
      payloadFormat: targetPart.payloadFormat,
      requestId: body.requestId,
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
