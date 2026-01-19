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
  listChatsByEntityProfile,
} from "../services/chat-core/chats-repository";
import {
  createEntityProfile,
  deleteEntityProfile,
  getEntityProfileById,
  listEntityProfiles,
  updateEntityProfile,
} from "../services/chat-core/entity-profiles-repository";

const router = express.Router();

const idParamsSchema = z.object({ id: idSchema });

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
        avatarAssetId: z.string().min(1).nullable().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "Validation error", "VALIDATION_ERROR", {
        issues: parsed.error.issues,
      });
    }

    const updated = await updateEntityProfile({
      id: params.id,
      ...parsed.data,
    });
    if (!updated) {
      throw new HttpError(404, "EntityProfile не найден", "NOT_FOUND");
    }
    return { data: updated };
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

    const { chat, mainBranch } = await createChat({
      ownerId: req.body.ownerId,
      entityProfileId: params.id,
      title: req.body.title,
      meta: req.body.meta,
    });

    return { data: { chat, mainBranch } };
  })
);

export default router;
