import fs from "fs/promises";
import path from "path";

import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import {
  createChatBodySchema,
  createEntityProfileBodySchema,
  idSchema,
} from "../chat-core/schemas";
import {
  createChat,
  createImportedAssistantMessage,
  listChatsByEntityProfile,
} from "../services/chat-core/chats-repository";
import {
  createEntityProfile,
  deleteEntityProfile,
  getEntityProfileById,
  listEntityProfiles,
  updateEntityProfile,
} from "../services/chat-core/entity-profiles-repository";
import { buildPromptTemplateRenderContext } from "../services/chat-core/prompt-template-context";
import { renderLiquidTemplate } from "../services/chat-core/prompt-template-renderer";
import { getBranchCurrentTurn } from "../services/chat-entry-parts/branch-turn-repository";
import { createEntryWithVariant } from "../services/chat-entry-parts/entries-repository";
import { createPart } from "../services/chat-entry-parts/parts-repository";
import { createVariant, updateVariantDerived } from "../services/chat-entry-parts/variants-repository";

const router = express.Router();

const idParamsSchema = z.object({ id: idSchema });
const exportQuerySchema = z.object({
  format: z.enum(["json", "png"]).optional().default("json"),
});

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const FALLBACK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBgL8h2QAAAABJRU5ErkJggg==";

function sanitizeFilename(input: string): string {
  const safe = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe.length > 0 ? safe : "entity_profile";
}

function buildContentDisposition(name: string, ext: "json" | "png"): string {
  const baseName = name.trim().length > 0 ? name.trim() : "entity_profile";
  const fallback = `${sanitizeFilename(baseName)}.${ext}`;
  const utf8Name = encodeURIComponent(`${baseName}.${ext}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${utf8Name}`;
}

function toExportSpec(profile: { name: string; spec: unknown }): Record<string, unknown> {
  const spec = typeof profile.spec === "object" && profile.spec !== null && !Array.isArray(profile.spec)
    ? ({ ...(profile.spec as Record<string, unknown>) } as Record<string, unknown>)
    : {};
  spec.name = profile.name;
  return spec;
}

function crc32(input: Buffer): number {
  let crc = 0 ^ -1;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makeTextChunk(keyword: string, value: string): Buffer {
  const keyBuf = Buffer.from(keyword, "latin1");
  const valueBuf = Buffer.from(value, "utf8");
  const data = Buffer.concat([keyBuf, Buffer.from([0x00]), valueBuf]);
  return makePngChunk("tEXt", data);
}

function injectChunkBeforeIEND(basePng: Buffer, chunk: Buffer): Buffer {
  if (basePng.length < 8 || !basePng.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Base image is not PNG.");
  }

  let offset = 8;
  while (offset + 12 <= basePng.length) {
    const length = basePng.readUInt32BE(offset);
    const type = basePng.toString("ascii", offset + 4, offset + 8);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > basePng.length) break;

    if (type === "IEND") {
      return Buffer.concat([basePng.subarray(0, offset), chunk, basePng.subarray(offset)]);
    }
    offset = chunkEnd;
  }

  return Buffer.concat([basePng, chunk]);
}

function toProfileMediaPath(avatarAssetId: string | null): string | null {
  if (!avatarAssetId) return null;
  if (!avatarAssetId.startsWith("/media/")) return null;
  return path.join(process.cwd(), "data", avatarAssetId.replace(/^\/media\//, "media/"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractSelectedUserId(contextUser: unknown): string | null {
  if (!isRecord(contextUser)) return null;
  return typeof contextUser.id === "string" ? contextUser.id : null;
}

export type GreetingTemplateSeed = {
  engine: "liquidjs";
  rawTemplate: string;
  renderedForUserPersonId: string | null;
  renderedAt: string;
  renderError?: string;
};

const TEMPLATE_MAX_PASSES = 3;

export async function renderGreetingTemplateSinglePass(params: {
  rawTemplate: string;
  context: {
    char: unknown;
    user: unknown;
    chat: unknown;
    messages: Array<{ role: string; content: string }>;
    rag: unknown;
    art?: Record<string, unknown>;
    now: string;
  };
}): Promise<{
  rendered: string;
  seed: GreetingTemplateSeed;
}> {
  const renderedForUserPersonId = extractSelectedUserId(params.context.user);
  const baseSeed: GreetingTemplateSeed = {
    engine: "liquidjs",
    rawTemplate: params.rawTemplate,
    renderedForUserPersonId,
    renderedAt: new Date().toISOString(),
  };

  try {
    const rendered = String(
      await renderLiquidTemplate({
        templateText: params.rawTemplate,
        context: params.context,
        options: {
          strictVariables: false,
          maxPasses: TEMPLATE_MAX_PASSES,
        },
      })
    );
    return {
      rendered,
      seed: baseSeed,
    };
  } catch (error) {
    return {
      rendered: params.rawTemplate,
      seed: {
        ...baseSeed,
        renderError: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function buildCharSpecPngBuffer(profile: { name: string; spec: unknown; avatarAssetId: string | null }): Promise<Buffer> {
  const relPath = profile.avatarAssetId?.replace(/^\/media\//, "") ?? null;
  const filePath = relPath ? path.join(process.cwd(), "data", "media", relPath) : null;

  let basePng = Buffer.from(FALLBACK_PNG_BASE64, "base64");
  if (filePath) {
    try {
      const raw = await fs.readFile(filePath);
      if (raw.length >= 8 && raw.subarray(0, 8).equals(PNG_SIGNATURE)) {
        basePng = raw;
      }
    } catch {
      // fallback to built-in 1x1 png
    }
  }

  const payload = Buffer.from(JSON.stringify(toExportSpec(profile)), "utf8").toString("base64");
  const withChara = injectChunkBeforeIEND(basePng, makeTextChunk("chara", payload));
  const withCcv3 = injectChunkBeforeIEND(withChara, makeTextChunk("ccv3", payload));
  return withCcv3;
}

router.get(
  "/entity-profiles",
  asyncHandler(async () => {
    const profiles = await listEntityProfiles({ ownerId: "global" });
    return { data: profiles };
  })
);

router.post(
  "/entity-profiles",
  validate({ body: createEntityProfileBodySchema }),
  asyncHandler(async (req: Request) => {
    const created = await createEntityProfile({
      ownerId: req.body.ownerId,
      name: req.body.name,
      kind: req.body.kind,
      spec: req.body.spec,
      meta: req.body.meta,
      isFavorite: req.body.isFavorite,
      avatarAssetId: req.body.avatarAssetId,
    });
    return { data: created };
  })
);

router.get(
  "/entity-profiles/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const profile = await getEntityProfileById(params.id);
    if (!profile) {
      throw new HttpError(404, "EntityProfile не найден", "NOT_FOUND");
    }
    return { data: profile };
  })
);

router.put(
  "/entity-profiles/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    // Body is intentionally permissive: we validate only the fields we use.
    const parsed = z
      .object({
        name: z.string().min(1).optional(),
        kind: z.literal("CharSpec").optional(),
        spec: z.unknown().optional(),
        meta: z.unknown().optional(),
        isFavorite: z.boolean().optional(),
        avatarAssetId: z.string().min(1).nullable().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "Validation error", "VALIDATION_ERROR", {
        issues: parsed.error.issues,
      });
    }

    const before = await getEntityProfileById(params.id);
    const updated = await updateEntityProfile({
      id: params.id,
      ...parsed.data,
    });

    // Best-effort cleanup when avatar is replaced/cleared (avoid orphaned files).
    const beforePath = toProfileMediaPath(before?.avatarAssetId ?? null);
    const afterPath = toProfileMediaPath(updated?.avatarAssetId ?? null);
    if (beforePath && beforePath !== afterPath) {
      await fs.unlink(beforePath).catch(() => undefined);
    }

    if (!updated) {
      throw new HttpError(404, "EntityProfile не найден", "NOT_FOUND");
    }
    return { data: updated };
  })
);

router.get(
  "/entity-profiles/:id/export",
  validate({ params: idParamsSchema, query: exportQuerySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const query = exportQuerySchema.parse(req.query);
    const profile = await getEntityProfileById(params.id);
    if (!profile) {
      throw new HttpError(404, "EntityProfile не найден", "NOT_FOUND");
    }

    if (query.format === "png") {
      const pngBuffer = await buildCharSpecPngBuffer(profile);
      return {
        data: pngBuffer,
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": buildContentDisposition(profile.name, "png"),
        },
        raw: true,
      };
    }

    const exportSpec = toExportSpec(profile);
    return {
      data: Buffer.from(JSON.stringify(exportSpec, null, 2), "utf8"),
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": buildContentDisposition(profile.name, "json"),
      },
      raw: true,
    };
  })
);

router.delete(
  "/entity-profiles/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const profile = await getEntityProfileById(params.id);
    await deleteEntityProfile(params.id);

    // Best-effort cleanup for imported avatars (avoid orphaned files).
    const avatarPath = profile?.avatarAssetId ?? null;
    if (avatarPath && avatarPath.startsWith("/media/images/entity-profiles/")) {
      const rel = avatarPath.replace(/^\/media\//, ""); // -> images/entity-profiles/...
      const filePath = path.join(process.cwd(), "data", "media", rel);
      await fs.unlink(filePath).catch(() => undefined);
    }

    return { data: { id: params.id } };
  })
);

router.get(
  "/entity-profiles/:id/chats",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const chats = await listChatsByEntityProfile({
      entityProfileId: params.id,
      ownerId: "global",
    });
    return { data: chats };
  })
);

router.post(
  "/entity-profiles/:id/chats",
  validate({ params: idParamsSchema, body: createChatBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    // Ensure profile exists
    const profile = await getEntityProfileById(params.id);
    if (!profile) {
      throw new HttpError(404, "EntityProfile не найден", "NOT_FOUND");
    }
    const ownerId = req.body.ownerId ?? "global";

    const { chat, mainBranch } = await createChat({
      ownerId,
      entityProfileId: params.id,
      title: req.body.title,
      meta: req.body.meta,
    });

    // Seed an intro message from CharSpec (like legacy AgentCard introSwipes).
    // This improves UX: opening a freshly imported profile shows the first message immediately.
    try {
      const spec = profile.spec as any;
      const firstMes = typeof spec?.first_mes === "string" ? spec.first_mes.trim() : "";

      const altGreetingsRaw = Array.isArray(spec?.alternate_greetings) ? spec.alternate_greetings : [];
      const altGreetings = altGreetingsRaw
        .filter((x: unknown) => typeof x === "string")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      const greetingTemplateContext = await buildPromptTemplateRenderContext({
        ownerId,
        chatId: chat.id,
        branchId: mainBranch.id,
        entityProfileId: params.id,
        historyLimit: 50,
      });

      // --- New model: seed entry-parts so chat window (v2) renders immediately.
      if (firstMes.length > 0) {
        const createdTurn = await getBranchCurrentTurn({ branchId: mainBranch.id });
        const firstMesRender = await renderGreetingTemplateSinglePass({
          rawTemplate: firstMes,
          context: greetingTemplateContext,
        });

        const seeded = await createEntryWithVariant({
          ownerId,
          chatId: chat.id,
          branchId: mainBranch.id,
          role: "assistant",
          variantKind: "import",
          meta: { imported: true, source: "entity_profile_import", kind: "first_mes" },
        });

        await createPart({
          ownerId,
          variantId: seeded.variant.variantId,
          channel: "main",
          order: 0,
          payload: firstMesRender.rendered,
          payloadFormat: "markdown",
          visibility: { ui: "always", prompt: true },
          ui: { rendererId: "markdown" },
          prompt: { serializerId: "asText" },
          lifespan: "infinite",
          createdTurn,
          source: "import",
        });
        await updateVariantDerived({
          variantId: seeded.variant.variantId,
          derived: {
            templateSeed: firstMesRender.seed,
          },
        });

        for (const greeting of altGreetings) {
          const altRender = await renderGreetingTemplateSinglePass({
            rawTemplate: greeting,
            context: greetingTemplateContext,
          });
          const v = await createVariant({
            ownerId,
            entryId: seeded.entry.entryId,
            kind: "import",
            derived: {
              templateSeed: altRender.seed,
            },
          });
          await createPart({
            ownerId,
            variantId: v.variantId,
            channel: "main",
            order: 0,
            payload: altRender.rendered,
            payloadFormat: "markdown",
            visibility: { ui: "always", prompt: true },
            ui: { rendererId: "markdown" },
            prompt: { serializerId: "asText" },
            lifespan: "infinite",
            createdTurn,
            source: "import",
          });
        }
      }

      // --- Legacy model: keep for now (other parts of the app still use chatMessages/messageVariants).
      if (firstMes.length > 0) {
        const firstMesRender = await renderGreetingTemplateSinglePass({
          rawTemplate: firstMes,
          context: greetingTemplateContext,
        });
        await createImportedAssistantMessage({
          ownerId,
          chatId: chat.id,
          branchId: mainBranch.id,
          promptText: firstMesRender.rendered,
          meta: { source: "entity_profile_import", kind: "first_mes" },
        });
      }
    } catch {
      // best-effort; don't fail chat creation
    }

    return { data: { chat, mainBranch } };
  })
);

export default router;
