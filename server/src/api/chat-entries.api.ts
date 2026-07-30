import express, { type Request, type Response } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { batchUpdateEntryParts } from "../application/chat-runtime/use-cases/batch-update-entry-parts";
import { continueGeneration } from "../application/chat-runtime/use-cases/continue-generation";
import { createEntryAndStartGeneration } from "../application/chat-runtime/use-cases/create-entry-and-start-generation";
import { deleteEntryVariant } from "../application/chat-runtime/use-cases/delete-entry-variant";
import { getChatEntries } from "../application/chat-runtime/use-cases/get-chat-entries";
import { getChatOperationRuntimeState } from "../application/chat-runtime/use-cases/get-chat-operation-runtime-state";
import { getEntryVariants } from "../application/chat-runtime/use-cases/get-entry-variants";
import { getLatestWorldInfoActivations } from "../application/chat-runtime/use-cases/get-latest-world-info-activations";
import { getPromptDiagnostics } from "../application/chat-runtime/use-cases/get-prompt-diagnostics";
import { manualEditEntry } from "../application/chat-runtime/use-cases/manual-edit-entry";
import { regenerateAssistantVariant } from "../application/chat-runtime/use-cases/regenerate-assistant-variant";
import { selectEntryVariant } from "../application/chat-runtime/use-cases/select-entry-variant";
import { setEntryPromptVisibility } from "../application/chat-runtime/use-cases/set-entry-prompt-visibility";
import { undoPartCanonicalization } from "../application/chat-runtime/use-cases/undo-part-canonicalization";
import { chatIdParamsSchema } from "../chat-core/schemas";
import {
  getEntryById,
  softDeleteEntry,
  softDeleteEntries,
} from "../services/chat-entry-parts/entries-repository";
import { softDeletePart } from "../services/chat-entry-parts/parts-repository";

import { streamGenerationSession } from "./chat-generation-stream";

import type { BatchUpdateEntryPartsBody as ChatRuntimeBatchUpdateEntryPartsBody } from "../application/chat-runtime/chat-entry-helpers";

const router = express.Router();

function ensureSseRequested(req: Request): void {
  const accept = String(req.headers.accept ?? "");
  if (!accept.includes("text/event-stream")) {
    throw new HttpError(406, "Нужен Accept: text/event-stream", "NOT_ACCEPTABLE");
  }
}

const listEntriesQuerySchema = z
  .object({
    branchId: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    before: z.coerce.number().int().positive().optional(), // backward-compatible createdAt cursor
    cursorCreatedAt: z.coerce.number().int().positive().optional(),
    cursorEntryId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const hasCreatedAt = typeof value.cursorCreatedAt === "number";
    const hasEntryId = typeof value.cursorEntryId === "string" && value.cursorEntryId.length > 0;
    if (hasCreatedAt !== hasEntryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursorCreatedAt и cursorEntryId должны передаваться вместе",
      });
    }
  });

router.get(
  "/chats/:id/entries",
  validate({ params: chatIdParamsSchema, query: listEntriesQuerySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const query = listEntriesQuerySchema.parse(req.query);
    return {
      data: await getChatEntries({
        chatId: params.id,
        query,
      }),
    };
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
    const body = createEntryBodySchema.parse(req.body);
    ensureSseRequested(req);
    await streamGenerationSession({
      req,
      res,
      buildSession: (abortController) =>
        createEntryAndStartGeneration({
          chatId: params.id,
          body,
          abortController,
        }),
    });
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
    ensureSseRequested(req);

    const body = continueEntryBodySchema.parse(req.body);
    await streamGenerationSession({
      req,
      res,
      buildSession: (abortController) =>
        continueGeneration({
          chatId: params.id,
          body,
          abortController,
        }),
    });
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
    await streamGenerationSession({
      req,
      res,
      buildSession: (abortController) =>
        regenerateAssistantVariant({
          entryId: params.id,
          body,
          abortController,
        }),
    });
    return;
  })
);

const promptDiagnosticsQuerySchema = z.object({
  variantId: z.string().min(1).optional(),
});

router.get(
  "/entries/:id/prompt-diagnostics",
  validate({ params: entryIdParamsSchema, query: promptDiagnosticsQuerySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const query = promptDiagnosticsQuerySchema.parse(req.query);
    return {
      data: await getPromptDiagnostics({
        entryId: params.id,
        variantId: query.variantId,
      }),
    };
  })
);

const latestWorldInfoActivationsQuerySchema = z.object({
  branchId: z.string().min(1).optional(),
});
const operationRuntimeStateQuerySchema = z.object({
  branchId: z.string().min(1).optional(),
});

router.get(
  "/chats/:id/operation-runtime-state",
  validate({ params: chatIdParamsSchema, query: operationRuntimeStateQuerySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const query = operationRuntimeStateQuerySchema.parse(req.query);
    return {
      data: await getChatOperationRuntimeState({
        chatId: params.id,
        branchId: query.branchId,
      }),
    };
  })
);

router.get(
  "/chats/:id/world-info/latest-activations",
  validate({ params: chatIdParamsSchema, query: latestWorldInfoActivationsQuerySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const query = latestWorldInfoActivationsQuerySchema.parse(req.query);
    return {
      data: await getLatestWorldInfoActivations({
        chatId: params.id,
        branchId: query.branchId,
      }),
    };
  })
);

router.get(
  "/entries/:id/variants",
  validate({ params: entryIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    return {
      data: await getEntryVariants({
        entryId: params.id,
      }),
    };
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
    return {
      data: await selectEntryVariant({
        entryId: params.id,
        variantId: params.variantId,
      }),
    };
  })
);

const manualEditBodySchema = z.object({
  ownerId: z.string().min(1).optional(),
  partId: z.string().min(1).optional(),
  content: z.string(),
  requestId: z.string().min(1).optional(),
});

const batchUpdateEntryPartSchema = z.object({
  partId: z.string().min(1).optional(),
  clientPartId: z.string().min(1).optional(),
  deleted: z.boolean().optional().default(false),
  channel: z.enum(["main", "reasoning", "aux", "trace"]).optional(),
  payloadFormat: z.enum(["text", "markdown", "json"]).optional(),
  label: z.string().min(1).optional(),
  visibility: z.object({
    ui: z.enum(["always", "never"]),
    prompt: z.boolean(),
  }),
  payload: z.unknown(),
}).superRefine((value, ctx) => {
  const hasPartId = typeof value.partId === "string";
  const hasClientPartId = typeof value.clientPartId === "string";
  if (hasPartId === hasClientPartId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either partId or clientPartId is required",
      path: ["partId"],
    });
  }
  if (hasClientPartId && value.deleted) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "New parts cannot be deleted",
      path: ["deleted"],
    });
  }
});

const batchUpdateEntryPartsBodySchema = z.object({
  variantId: z.string().min(1),
  mainPartId: z.string().min(1),
  orderedPartIds: z.array(z.string().min(1)).min(1),
  parts: z.array(batchUpdateEntryPartSchema).min(1),
});

router.post(
  "/entries/:id/manual-edit",
  validate({ params: entryIdParamsSchema, body: manualEditBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const body = manualEditBodySchema.parse(req.body);
    return {
      data: await manualEditEntry({
        entryId: params.id,
        body,
      }),
    };
  })
);

router.post(
  "/entries/:id/parts/batch-update",
  validate({ params: entryIdParamsSchema, body: batchUpdateEntryPartsBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const body =
      batchUpdateEntryPartsBodySchema.parse(req.body) as ChatRuntimeBatchUpdateEntryPartsBody;

    return {
      data: await batchUpdateEntryParts({
        entryId: params.id,
        body,
      }),
    };
  })
);

router.post(
  "/entries/:id/variants/:variantId/soft-delete",
  validate({ params: selectVariantParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string; variantId: string };
    return {
      data: await deleteEntryVariant({
        entryId: params.id,
        variantId: params.variantId,
      }),
    };
  })
);

const softDeleteEntryBodySchema = z.object({
  by: z.enum(["user", "agent"]).optional().default("user"),
});

const softDeleteEntriesBulkBodySchema = z.object({
  entryIds: z.array(z.string().min(1)).min(1),
  by: z.enum(["user", "agent"]).optional().default("user"),
});

const entryPromptVisibilityBodySchema = z.object({
  includeInPrompt: z.boolean(),
});

router.post(
  "/entries/soft-delete-bulk",
  validate({ body: softDeleteEntriesBulkBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = softDeleteEntriesBulkBodySchema.parse(req.body);
    const ids = await softDeleteEntries({
      entryIds: body.entryIds,
      by: body.by,
    });
    return { data: { ids } };
  })
);

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

router.post(
  "/entries/:id/prompt-visibility",
  validate({ params: entryIdParamsSchema, body: entryPromptVisibilityBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const body = entryPromptVisibilityBodySchema.parse(req.body);
    return {
      data: await setEntryPromptVisibility({
        entryId: params.id,
        includeInPrompt: body.includeInPrompt,
      }),
    };
  })
);

const partIdParamsSchema = z.object({ id: z.string().min(1) });
const softDeletePartBodySchema = z.object({
  by: z.enum(["user", "agent"]).optional().default("user"),
});
const canonicalizationUndoBodySchema = z.object({
  by: z.enum(["user", "agent"]).optional().default("user"),
});

router.post(
  "/parts/:id/canonicalization-undo",
  validate({ params: partIdParamsSchema, body: canonicalizationUndoBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const body = canonicalizationUndoBodySchema.parse(req.body);
    return {
      data: await undoPartCanonicalization({
        partId: params.id,
        body,
      }),
    };
  })
);

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
