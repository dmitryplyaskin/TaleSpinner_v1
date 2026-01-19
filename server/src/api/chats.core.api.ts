import express, { type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";
import { initSse } from "@core/sse/sse";

import {
  branchIdParamsSchema,
  chatIdParamsSchema,
  createBranchBodySchema,
  createMessageBodySchema,
  listMessagesQuerySchema,
} from "../chat-core/schemas";
import { initDb } from "../db/client";
import { chatMessages } from "../db/schema";
import {
  activateBranch,
  createAssistantMessageWithVariant,
  createChatBranch,
  createChatMessage,
  getChatById,
  listMessagesForPrompt,
  listChatBranches,
  listChatMessages,
  softDeleteChat,
} from "../services/chat-core/chats-repository";
import { getEntityProfileById } from "../services/chat-core/entity-profiles-repository";
import { abortGeneration } from "../services/chat-core/generation-runtime";
import { createGeneration } from "../services/chat-core/generations-repository";
import { getRuntimeInfo, runChatGeneration } from "../services/chat-core/orchestrator";
import { createPipelineRun, finishPipelineRun } from "../services/chat-core/pipeline-runs-repository";
import {
  createPipelineStepRun,
  finishPipelineStepRun,
} from "../services/chat-core/pipeline-step-runs-repository";
import { renderLiquidTemplate } from "../services/chat-core/prompt-template-renderer";
import { pickActivePromptTemplate } from "../services/chat-core/prompt-templates-repository";

const router = express.Router();
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

router.get(
  "/chats/:id",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");
    return { data: chat };
  })
);

router.delete(
  "/chats/:id",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");
    const deleted = await softDeleteChat(params.id);
    return { data: deleted };
  })
);

router.get(
  "/chats/:id/branches",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");
    const branches = await listChatBranches({ chatId: params.id });
    return { data: branches };
  })
);

router.post(
  "/chats/:id/branches",
  validate({ params: chatIdParamsSchema, body: createBranchBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const parentBranchId =
      req.body.parentBranchId ??
      (typeof req.body.forkedFromMessageId === "string"
        ? chat.activeBranchId ?? undefined
        : undefined);

    if (typeof req.body.forkedFromMessageId === "string") {
      if (!parentBranchId) {
        throw new HttpError(
          400,
          "parentBranchId обязателен для fork (нет activeBranchId)",
          "VALIDATION_ERROR"
        );
      }
      const db = await initDb();
      const forkRows = await db
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.chatId, params.id),
            eq(chatMessages.branchId, parentBranchId),
            eq(chatMessages.id, req.body.forkedFromMessageId)
          )
        )
        .limit(1);
      if (!forkRows[0]) {
        throw new HttpError(404, "forkedFromMessageId не найден", "NOT_FOUND");
      }
    }

    const branch = await createChatBranch({
      ownerId: req.body.ownerId,
      chatId: params.id,
      title: req.body.title,
      parentBranchId,
      forkedFromMessageId: req.body.forkedFromMessageId,
      forkedFromVariantId: req.body.forkedFromVariantId,
      meta: req.body.meta,
    });

    return { data: branch };
  })
);

router.post(
  "/chats/:id/branches/:branchId/activate",
  validate({ params: branchIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string; branchId: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const branches = await listChatBranches({ chatId: params.id });
    const exists = branches.some((b) => b.id === params.branchId);
    if (!exists) throw new HttpError(404, "Branch не найден", "NOT_FOUND");

    const updated = await activateBranch({
      chatId: params.id,
      branchId: params.branchId,
    });
    return { data: updated };
  })
);

router.get(
  "/chats/:id/messages",
  validate({ params: chatIdParamsSchema, query: listMessagesQuerySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const query = req.query as unknown as { branchId?: string; limit: number; before?: number };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const branchId = query.branchId || chat.activeBranchId;
    if (!branchId) {
      throw new HttpError(400, "branchId обязателен (нет activeBranchId)", "VALIDATION_ERROR");
    }

    const messages = await listChatMessages({
      chatId: params.id,
      branchId,
      limit: query.limit,
      before: query.before,
    });
    return { data: { branchId, messages } };
  })
);

router.post(
  "/chats/:id/messages",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.params as unknown as { id: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const accept = String(req.headers.accept ?? "");
    const wantsSse = accept.includes("text/event-stream");

    if (!wantsSse) {
      const body = createMessageBodySchema.parse(req.body);

      const branchId = body.branchId || chat.activeBranchId;
      if (!branchId) {
        throw new HttpError(
          400,
          "branchId обязателен (нет activeBranchId)",
          "VALIDATION_ERROR"
        );
      }

      if (body.role === "assistant") {
        throw new HttpError(
          400,
          "role=assistant запрещён в этом endpoint (v1)",
          "VALIDATION_ERROR"
        );
      }

      const message = await createChatMessage({
        ownerId: body.ownerId,
        chatId: params.id,
        branchId,
        role: body.role,
        promptText: body.promptText,
        format: body.format,
        blocks: body.blocks,
        meta: body.meta,
      });

      return { data: message };
    }

    // SSE mode: save user message + run generation
    const sseBodySchema = createMessageBodySchema.extend({
      settings: z.record(z.string(), z.unknown()).optional().default({}),
    });

    const body = sseBodySchema.parse(req.body);

    const branchId = body.branchId || chat.activeBranchId;
    if (!branchId) {
      throw new HttpError(400, "branchId обязателен (нет activeBranchId)", "VALIDATION_ERROR");
    }

    if (body.role === "assistant") {
      throw new HttpError(
        400,
        "role=assistant запрещён в этом endpoint (v1)",
        "VALIDATION_ERROR"
      );
    }

    // NOTE: for SSE we must take over the response; asyncHandler will not auto-send.
    const sse = initSse({ res });

    let generationId: string | null = null;
    let pipelineRunId: string | null = null;
    let llmStepRunId: string | null = null;
    try {
      const userMessage = await createChatMessage({
        ownerId: body.ownerId,
        chatId: params.id,
        branchId,
        role: body.role,
        promptText: body.promptText,
        format: body.format,
        blocks: body.blocks,
        meta: body.meta,
      });

      const assistant = await createAssistantMessageWithVariant({
        ownerId: body.ownerId,
        chatId: params.id,
        branchId,
      });

      const pipelineRun = await createPipelineRun({
        ownerId: body.ownerId,
        chatId: params.id,
        entityProfileId: chat.entityProfileId,
        trigger: "user_message",
        meta: { branchId, userMessageId: userMessage.id, assistantMessageId: assistant.assistantMessageId },
      });
      pipelineRunId = pipelineRun.id;

      // PRE step: pick template + render system prompt
      const preStep = await createPipelineStepRun({
        ownerId: body.ownerId,
        runId: pipelineRunId,
        stepName: "pre",
        stepType: "pre",
        input: { chatId: params.id, branchId },
      });

      let systemPrompt = DEFAULT_SYSTEM_PROMPT;
      let templateId: string | null = null;
      try {
        const [entityProfile, template, history] = await Promise.all([
          getEntityProfileById(chat.entityProfileId),
          pickActivePromptTemplate({
            ownerId: body.ownerId ?? "global",
            chatId: params.id,
            entityProfileId: chat.entityProfileId,
          }),
          listMessagesForPrompt({
            chatId: params.id,
            branchId,
            limit: 50,
            excludeMessageIds: [assistant.assistantMessageId],
          }),
        ]);

        if (template) templateId = template.id;
        if (template && entityProfile) {
          const rendered = await renderLiquidTemplate({
            templateText: template.templateText,
            context: {
              char: entityProfile.spec,
              user: {},
              chat: {
                id: params.id,
                title: chat.title,
                branchId,
                createdAt: chat.createdAt,
                updatedAt: chat.updatedAt,
              },
              messages: history.map((m) => ({ role: m.role, content: m.content })),
              rag: {},
              now: new Date().toISOString(),
            },
          });
          const normalized = rendered.trim();
          if (normalized) systemPrompt = normalized;
        }
      } catch {
        // Keep fallback prompt on any pre-step failure.
      }

      await finishPipelineStepRun({
        id: preStep.id,
        status: "done",
        output: { templateId, systemPrompt },
      });

      const runtime = await getRuntimeInfo({ ownerId: body.ownerId ?? "global" });

      const llmStep = await createPipelineStepRun({
        ownerId: body.ownerId,
        runId: pipelineRunId,
        stepName: "llm",
        stepType: "llm",
        input: { providerId: runtime.providerId, model: runtime.model, settings: body.settings },
      });
      llmStepRunId = llmStep.id;

      const createdGen = await createGeneration({
        ownerId: body.ownerId,
        chatId: params.id,
        messageId: assistant.assistantMessageId,
        variantId: assistant.variantId,
        pipelineRunId,
        pipelineStepRunId: llmStepRunId,
        providerId: runtime.providerId,
        model: runtime.model,
        settings: body.settings,
      });
      generationId = createdGen.id;

      // Close on disconnect and propagate abort.
      req.on("close", () => {
        if (generationId) {
          abortGeneration(generationId);
        }
        sse.close();
      });

      sse.send("llm.stream.meta", {
        chatId: params.id,
        branchId,
        userMessageId: userMessage.id,
        assistantMessageId: assistant.assistantMessageId,
        variantId: assistant.variantId,
        generationId,
        pipelineRunId,
        pipelineStepRunId: llmStepRunId,
      });

      let finalStatus: "done" | "aborted" | "error" = "done";
      for await (const evt of runChatGeneration({
        ownerId: body.ownerId,
        generationId,
        chatId: params.id,
        branchId,
        entityProfileId: chat.entityProfileId,
        systemPrompt,
        userMessageId: userMessage.id,
        assistantMessageId: assistant.assistantMessageId,
        variantId: assistant.variantId,
        settings: body.settings,
      })) {
        if (evt.type === "llm.stream.done") {
          finalStatus = evt.data.status;
        }
        sse.send(evt.type, evt.data);
      }

      // Finalize pipeline run logging.
      if (llmStepRunId) {
        await finishPipelineStepRun({
          id: llmStepRunId,
          status:
            finalStatus === "error" ? "error" : "done",
          output: { status: finalStatus, generationId },
          error: finalStatus === "error" ? "generation_failed" : null,
        });
      }
      if (pipelineRunId) {
        await finishPipelineRun({
          id: pipelineRunId,
          status: finalStatus === "done" ? "done" : finalStatus === "aborted" ? "aborted" : "error",
          meta: { branchId, generationId, status: finalStatus },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sse.send("llm.stream.error", { message });
      try {
        if (llmStepRunId) {
          await finishPipelineStepRun({
            id: llmStepRunId,
            status: "error",
            output: { status: "error", generationId },
            error: message,
          });
        }
        if (pipelineRunId) {
          await finishPipelineRun({
            id: pipelineRunId,
            status: "error",
            meta: { branchId, generationId, status: "error", error: message },
          });
        }
      } catch {
        // ignore secondary errors
      }
    } finally {
      sse.close();
    }

    return;
  })
);

export default router;

