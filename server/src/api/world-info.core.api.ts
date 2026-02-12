import express, { type Request } from "express";
import multer from "multer";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { idSchema, ownerIdSchema } from "../chat-core/schemas";
import { getChatById } from "../services/chat-core/chats-repository";
import { listProjectedPromptMessages } from "../services/chat-entry-parts/prompt-history";
import {
  convertWorldInfoImport,
  exportWorldInfoBookToStNative,
  parseWorldInfoImportFile,
  type WorldInfoImportFormat,
} from "../services/world-info/world-info-converters";
import {
  MAX_WORLD_INFO_BOOK_BYTES,
  MAX_WORLD_INFO_ENTRIES_PER_BOOK,
  MAX_WORLD_INFO_ENTRY_CONTENT_CHARS,
} from "../services/world-info/world-info-defaults";
import {
  createWorldInfoBook,
  duplicateWorldInfoBook,
  getWorldInfoBookById,
  getWorldInfoBooksByIds,
  getWorldInfoSettings,
  listWorldInfoBindings,
  listWorldInfoBooks,
  patchWorldInfoSettings,
  replaceWorldInfoBindings,
  softDeleteWorldInfoBook,
  updateWorldInfoBook,
} from "../services/world-info/world-info-repositories";
import { resolveWorldInfoRuntimeForChat } from "../services/world-info/world-info-runtime";
import { worldInfoBindingRoles, worldInfoScopes } from "../services/world-info/world-info-types";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_WORLD_INFO_BOOK_BYTES,
  },
});

const scopeSchema = z.enum(worldInfoScopes);
const bindingRoleSchema = z.enum(worldInfoBindingRoles);

const listBooksQuerySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  query: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  before: z.coerce.number().int().positive().optional(),
});

const createBookBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  data: z.unknown().optional(),
  extensions: z.unknown().optional(),
});

const updateBookBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  data: z.unknown().optional(),
  extensions: z.unknown().optional(),
  version: z.number().int().positive().optional(),
});

const duplicateBookBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
});

const worldInfoSettingsPatchSchema = z
  .object({
    ownerId: ownerIdSchema.optional(),
    scanDepth: z.number().int().min(0).optional(),
    minActivations: z.number().int().min(0).optional(),
    minDepthMax: z.number().int().min(0).optional(),
    minActivationsDepthMax: z.number().int().min(0).optional(),
    budgetPercent: z.number().int().min(1).max(100).optional(),
    budgetCapTokens: z.number().int().min(0).optional(),
    contextWindowTokens: z.number().int().min(1).optional(),
    includeNames: z.boolean().optional(),
    recursive: z.boolean().optional(),
    overflowAlert: z.boolean().optional(),
    caseSensitive: z.boolean().optional(),
    matchWholeWords: z.boolean().optional(),
    useGroupScoring: z.boolean().optional(),
    insertionStrategy: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
    characterStrategy: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
    maxRecursionSteps: z.number().int().min(0).optional(),
    meta: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict();

const listBindingsQuerySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  scope: scopeSchema.optional(),
  scopeId: z.string().min(1).nullable().optional(),
});

const replaceBindingsBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  scope: scopeSchema,
  scopeId: z.string().min(1).nullable().optional(),
  items: z
    .array(
      z.object({
        bookId: idSchema,
        bindingRole: bindingRoleSchema.optional(),
        displayOrder: z.number().int().optional(),
        enabled: z.boolean().optional(),
      })
    )
    .max(500),
});

const resolveBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  chatId: idSchema,
  branchId: idSchema.optional(),
  entityProfileId: idSchema.optional(),
  trigger: z.enum(["generate", "regenerate"]).optional().default("generate"),
  historyLimit: z.coerce.number().int().min(1).max(200).optional().default(50),
  dryRun: z.boolean().optional().default(true),
});

function validateBookPayload(data: unknown): void {
  const payloadText = JSON.stringify(data ?? {});
  if (Buffer.byteLength(payloadText, "utf8") > MAX_WORLD_INFO_BOOK_BYTES) {
    throw new HttpError(400, "Book payload too large", "VALIDATION_ERROR");
  }
  const entries =
    typeof data === "object" && data !== null && "entries" in (data as Record<string, unknown>)
      ? (data as { entries?: unknown }).entries
      : undefined;
  const entryRecord =
    typeof entries === "object" && entries !== null && !Array.isArray(entries)
      ? (entries as Record<string, unknown>)
      : {};
  const keys = Object.keys(entryRecord);
  if (keys.length > MAX_WORLD_INFO_ENTRIES_PER_BOOK) {
    throw new HttpError(400, "Too many entries", "VALIDATION_ERROR");
  }
  for (const key of keys) {
    const value = entryRecord[key];
    const content =
      typeof value === "object" && value !== null && "content" in (value as Record<string, unknown>)
        ? (value as { content?: unknown }).content
        : "";
    if (typeof content === "string" && content.length > MAX_WORLD_INFO_ENTRY_CONTENT_CHARS) {
      throw new HttpError(400, "Entry content too long", "VALIDATION_ERROR");
    }
  }
}

router.get(
  "/world-info/books",
  validate({ query: listBooksQuerySchema }),
  asyncHandler(async (req: Request) => {
    const query = listBooksQuerySchema.parse(req.query);
    const data = await listWorldInfoBooks(query);
    return { data };
  })
);

router.post(
  "/world-info/books",
  validate({ body: createBookBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = createBookBodySchema.parse(req.body);
    validateBookPayload(body.data);
    const created = await createWorldInfoBook(body);
    return { data: created };
  })
);

router.get(
  "/world-info/books/:id",
  validate({ params: z.object({ id: idSchema }) }),
  asyncHandler(async (req: Request) => {
    const id = String((req.params as { id: string }).id);
    const item = await getWorldInfoBookById(id);
    if (!item) throw new HttpError(404, "WorldInfo book not found", "NOT_FOUND");
    return { data: item };
  })
);

router.put(
  "/world-info/books/:id",
  validate({ params: z.object({ id: idSchema }), body: updateBookBodySchema }),
  asyncHandler(async (req: Request) => {
    const id = String((req.params as { id: string }).id);
    const body = updateBookBodySchema.parse(req.body);
    if (typeof body.data !== "undefined") validateBookPayload(body.data);
    const updated = await updateWorldInfoBook({
      id,
      ownerId: body.ownerId,
      name: body.name,
      slug: body.slug,
      description: body.description,
      data: body.data,
      extensions: body.extensions,
      version: body.version,
    });
    if (!updated.item) throw new HttpError(404, "WorldInfo book not found", "NOT_FOUND");
    if (updated.conflict) {
      throw new HttpError(409, "Version conflict", "CONFLICT", {
        currentVersion: updated.item.version,
      });
    }
    return { data: updated.item };
  })
);

router.delete(
  "/world-info/books/:id",
  validate({ params: z.object({ id: idSchema }) }),
  asyncHandler(async (req: Request) => {
    const id = String((req.params as { id: string }).id);
    const ok = await softDeleteWorldInfoBook({ id, ownerId: "global" });
    if (!ok) throw new HttpError(404, "WorldInfo book not found", "NOT_FOUND");
    return { data: { id } };
  })
);

router.post(
  "/world-info/books/:id/duplicate",
  validate({ params: z.object({ id: idSchema }), body: duplicateBookBodySchema }),
  asyncHandler(async (req: Request) => {
    const id = String((req.params as { id: string }).id);
    const body = duplicateBookBodySchema.parse(req.body);
    const item = await duplicateWorldInfoBook({
      id,
      ownerId: body.ownerId,
      name: body.name,
      slug: body.slug,
    });
    if (!item) throw new HttpError(404, "WorldInfo book not found", "NOT_FOUND");
    return { data: item };
  })
);

router.post(
  "/world-info/books/import",
  upload.single("file"),
  asyncHandler(async (req: Request) => {
    const file = req.file;
    if (!file) throw new HttpError(400, "file is required", "VALIDATION_ERROR");

    const body = req.body as { ownerId?: string; format?: string };
    const formatRaw = (body.format ?? "auto") as WorldInfoImportFormat;
    const format: WorldInfoImportFormat = (
      [
        "auto",
        "st_native",
        "character_book",
        "agnai",
        "risu",
        "novel",
      ] as const
    ).includes(formatRaw)
      ? formatRaw
      : "auto";

    const parsed = parseWorldInfoImportFile({
      fileBuffer: file.buffer,
      originalName: file.originalname,
    });
    const converted = convertWorldInfoImport({
      raw: parsed.raw,
      format,
      fallbackName: file.originalname.replace(/\.[^.]+$/, ""),
    });
    validateBookPayload(converted.data);

    const book = await createWorldInfoBook({
      ownerId: body.ownerId,
      name: converted.name,
      data: converted.data,
      source: "imported",
    });

    return {
      data: {
        book,
        warnings: [...parsed.warnings, ...converted.warnings],
      },
    };
  })
);

router.get(
  "/world-info/books/:id/export",
  validate({
    params: z.object({ id: idSchema }),
    query: z.object({ format: z.literal("st_native").optional().default("st_native") }),
  }),
  asyncHandler(async (req: Request) => {
    const id = String((req.params as { id: string }).id);
    const item = await getWorldInfoBookById(id);
    if (!item) throw new HttpError(404, "WorldInfo book not found", "NOT_FOUND");
    const payload = exportWorldInfoBookToStNative({
      name: item.name,
      data: item.data,
      extensions: item.extensions,
    });
    return { data: payload };
  })
);

router.get(
  "/world-info/settings",
  validate({ query: z.object({ ownerId: ownerIdSchema.optional() }) }),
  asyncHandler(async (req: Request) => {
    const query = z.object({ ownerId: ownerIdSchema.optional() }).parse(req.query);
    const settings = await getWorldInfoSettings({ ownerId: query.ownerId });
    return { data: settings };
  })
);

router.put(
  "/world-info/settings",
  validate({ body: worldInfoSettingsPatchSchema }),
  asyncHandler(async (req: Request) => {
    const body = worldInfoSettingsPatchSchema.parse(req.body);
    const { ownerId, ...patch } = body;
    const settings = await patchWorldInfoSettings({ ownerId, patch });
    return { data: settings };
  })
);

router.get(
  "/world-info/bindings",
  validate({ query: listBindingsQuerySchema }),
  asyncHandler(async (req: Request) => {
    const query = listBindingsQuerySchema.parse(req.query);
    const bindings = await listWorldInfoBindings({
      ownerId: query.ownerId,
      scope: query.scope,
      scopeId: query.scopeId,
    });
    return { data: bindings };
  })
);

router.put(
  "/world-info/bindings",
  validate({ body: replaceBindingsBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = replaceBindingsBodySchema.parse(req.body);
    if (body.scope !== "global" && !body.scopeId) {
      throw new HttpError(400, "scopeId is required for non-global scope", "VALIDATION_ERROR");
    }
    const books = await getWorldInfoBooksByIds({
      ownerId: body.ownerId ?? "global",
      ids: body.items.map((item) => item.bookId),
    });
    if (books.length !== body.items.length) {
      throw new HttpError(400, "Some bookIds are missing or deleted", "VALIDATION_ERROR");
    }
    const bindings = await replaceWorldInfoBindings({
      ownerId: body.ownerId,
      scope: body.scope,
      scopeId: body.scopeId,
      items: body.items,
    });
    return { data: bindings };
  })
);

router.post(
  "/world-info/resolve",
  validate({ body: resolveBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = resolveBodySchema.parse(req.body);
    const chat = await getChatById(body.chatId);
    if (!chat) throw new HttpError(404, "Chat not found", "NOT_FOUND");
    const branchId = body.branchId ?? chat.activeBranchId;
    if (!branchId) throw new HttpError(400, "branchId is required", "VALIDATION_ERROR");

    const projected = await listProjectedPromptMessages({
      chatId: body.chatId,
      branchId,
      limit: body.historyLimit,
    });
    const history: Array<{ role: string; content: string }> = projected.messages;

    const resolved = await resolveWorldInfoRuntimeForChat({
      ownerId: body.ownerId ?? "global",
      chatId: body.chatId,
      branchId,
      entityProfileId: body.entityProfileId ?? chat.entityProfileId,
      trigger: body.trigger,
      history,
      scanSeed: `${body.chatId}:${branchId}:${body.trigger}:${Date.now()}`,
      dryRun: body.dryRun,
    });

    return { data: resolved };
  })
);

export default router;
