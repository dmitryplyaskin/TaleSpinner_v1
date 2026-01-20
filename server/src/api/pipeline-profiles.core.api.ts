import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { chatIdParamsSchema, idSchema, jsonValueSchema, ownerIdSchema } from "../chat-core/schemas";
import { getChatById } from "../services/chat-core/chats-repository";
import { getEntityProfileById } from "../services/chat-core/entity-profiles-repository";
import {
  deletePipelineProfileBinding,
  getPipelineProfileBinding,
  upsertPipelineProfileBinding,
} from "../services/chat-core/pipeline-profile-bindings-repository";
import { resolveActivePipelineProfile } from "../services/chat-core/pipeline-profile-resolver";
import {
  createPipelineProfile,
  deletePipelineProfile,
  getPipelineProfileById,
  listPipelineProfiles,
  updatePipelineProfile,
} from "../services/chat-core/pipeline-profiles-repository";

const router = express.Router();

const idParamsSchema = z.object({ id: idSchema });

const createBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  name: z.string().min(1),
  spec: jsonValueSchema,
  meta: jsonValueSchema.optional(),
});

const updateBodySchema = z.object({
  name: z.string().min(1).optional(),
  spec: jsonValueSchema.optional(),
  meta: jsonValueSchema.optional(),
});

router.get(
  "/pipeline-profiles",
  asyncHandler(async () => {
    const items = await listPipelineProfiles({ ownerId: "global" });
    return { data: items };
  })
);

router.post(
  "/pipeline-profiles",
  validate({ body: createBodySchema }),
  asyncHandler(async (req: Request) => {
    const created = await createPipelineProfile({
      ownerId: req.body.ownerId,
      name: req.body.name,
      spec: req.body.spec,
      meta: req.body.meta,
    });
    return { data: created };
  })
);

router.get(
  "/pipeline-profiles/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const item = await getPipelineProfileById(params.id);
    if (!item) throw new HttpError(404, "PipelineProfile не найден", "NOT_FOUND");
    return { data: item };
  })
);

router.put(
  "/pipeline-profiles/:id",
  validate({ params: idParamsSchema, body: updateBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const updated = await updatePipelineProfile({
      id: params.id,
      name: req.body.name,
      spec: typeof req.body.spec === "undefined" ? undefined : req.body.spec,
      meta: typeof req.body.meta === "undefined" ? undefined : req.body.meta,
    });
    if (!updated) throw new HttpError(404, "PipelineProfile не найден", "NOT_FOUND");
    return { data: updated };
  })
);

router.delete(
  "/pipeline-profiles/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const exists = await getPipelineProfileById(params.id);
    if (!exists) throw new HttpError(404, "PipelineProfile не найден", "NOT_FOUND");
    await deletePipelineProfile({ id: params.id, ownerId: "global" });
    return { data: { id: params.id } };
  })
);

// ---- Active profile bindings (global/entity/chat)

const upsertActiveProfileBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  // null = clear override
  profileId: idSchema.nullable(),
});

router.get(
  "/chats/:id/active-pipeline-profile",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const ownerId = "global";
    const [chatBinding, entityBinding, globalBinding, resolved] = await Promise.all([
      getPipelineProfileBinding({ ownerId, scope: "chat", scopeId: chat.id }),
      getPipelineProfileBinding({ ownerId, scope: "entity_profile", scopeId: chat.entityProfileId }),
      getPipelineProfileBinding({ ownerId, scope: "global" }),
      resolveActivePipelineProfile({ ownerId, chatId: chat.id, entityProfileId: chat.entityProfileId }),
    ]);

    return {
      data: {
        chatId: chat.id,
        entityProfileId: chat.entityProfileId,
        resolved,
        bindings: {
          chat: chatBinding ? { profileId: chatBinding.profileId } : null,
          entityProfile: entityBinding ? { profileId: entityBinding.profileId } : null,
          global: globalBinding ? { profileId: globalBinding.profileId } : null,
        },
      },
    };
  })
);

router.put(
  "/chats/:id/active-pipeline-profile",
  validate({ params: chatIdParamsSchema, body: upsertActiveProfileBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const body = upsertActiveProfileBodySchema.parse(req.body);
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const ownerId = body.ownerId ?? "global";
    if (body.profileId === null) {
      await deletePipelineProfileBinding({ ownerId, scope: "chat", scopeId: chat.id });
    } else {
      const profile = await getPipelineProfileById(body.profileId);
      if (!profile) throw new HttpError(404, "PipelineProfile не найден", "NOT_FOUND");
      await upsertPipelineProfileBinding({
        ownerId,
        scope: "chat",
        scopeId: chat.id,
        profileId: profile.id,
      });
    }

    const resolved = await resolveActivePipelineProfile({
      ownerId,
      chatId: chat.id,
      entityProfileId: chat.entityProfileId,
    });
    return { data: { chatId: chat.id, entityProfileId: chat.entityProfileId, resolved } };
  })
);

router.put(
  "/entity-profiles/:id/active-pipeline-profile",
  validate({ params: idParamsSchema, body: upsertActiveProfileBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const body = upsertActiveProfileBodySchema.parse(req.body);
    const entity = await getEntityProfileById(params.id);
    if (!entity) throw new HttpError(404, "EntityProfile не найден", "NOT_FOUND");

    const ownerId = body.ownerId ?? "global";
    if (body.profileId === null) {
      await deletePipelineProfileBinding({
        ownerId,
        scope: "entity_profile",
        scopeId: entity.id,
      });
    } else {
      const profile = await getPipelineProfileById(body.profileId);
      if (!profile) throw new HttpError(404, "PipelineProfile не найден", "NOT_FOUND");
      await upsertPipelineProfileBinding({
        ownerId,
        scope: "entity_profile",
        scopeId: entity.id,
        profileId: profile.id,
      });
    }
    return { data: { entityProfileId: entity.id, profileId: body.profileId } };
  })
);

router.put(
  "/active-pipeline-profile",
  validate({ body: upsertActiveProfileBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = upsertActiveProfileBodySchema.parse(req.body);
    const ownerId = body.ownerId ?? "global";

    if (body.profileId === null) {
      await deletePipelineProfileBinding({ ownerId, scope: "global" });
    } else {
      const profile = await getPipelineProfileById(body.profileId);
      if (!profile) throw new HttpError(404, "PipelineProfile не найден", "NOT_FOUND");
      await upsertPipelineProfileBinding({ ownerId, scope: "global", profileId: profile.id });
    }

    const globalBinding = await getPipelineProfileBinding({ ownerId, scope: "global" });
    return { data: { ownerId, global: globalBinding ? { profileId: globalBinding.profileId } : null } };
  })
);

export default router;

