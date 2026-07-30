import fs from "fs/promises";

import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { createChatFromEntityProfile } from "../application/entity-profiles/use-cases/create-chat-from-entity-profile";
import {
  createChatBodySchema,
  createEntityProfileBodySchema,
  idSchema,
} from "../chat-core/schemas";
import { getRequestOwnerId } from "../core/request-context/request-context";
import {
  listChatsByEntityProfile,
} from "../services/chat-core/chats-repository";
import { resolveEntityProfileMediaPath } from "../services/chat-core/entity-profile-media";
import {
  createEntityProfile,
  deleteEntityProfile,
  getEntityProfileById,
  listEntityProfiles,
  updateEntityProfile,
} from "../services/chat-core/entity-profiles-repository";

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

async function buildCharSpecPngBuffer(profile: { name: string; spec: unknown; avatarAssetId: string | null }): Promise<Buffer> {
  const filePath = resolveEntityProfileMediaPath(profile.avatarAssetId);

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
  asyncHandler(async (req: Request) => {
    const profiles = await listEntityProfiles({ ownerId: getRequestOwnerId(req) });
    return { data: profiles };
  })
);

router.post(
  "/entity-profiles",
  validate({ body: createEntityProfileBodySchema }),
  asyncHandler(async (req: Request) => {
    const created = await createEntityProfile({
      ownerId: getRequestOwnerId(req, req.body.ownerId),
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
    const beforePath = resolveEntityProfileMediaPath(before?.avatarAssetId ?? null);
    const afterPath = resolveEntityProfileMediaPath(updated?.avatarAssetId ?? null);
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
    const filePath = resolveEntityProfileMediaPath(profile?.avatarAssetId ?? null);
    if (filePath) await fs.unlink(filePath).catch(() => undefined);

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
      ownerId: getRequestOwnerId(req),
    });
    return { data: chats };
  })
);

router.post(
  "/entity-profiles/:id/chats",
  validate({ params: idParamsSchema, body: createChatBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    return {
      data: await createChatFromEntityProfile({
        entityProfileId: params.id,
        ownerId: getRequestOwnerId(req, req.body.ownerId),
        title: req.body.title,
        meta: req.body.meta,
      }),
    };
  })
);

export default router;
