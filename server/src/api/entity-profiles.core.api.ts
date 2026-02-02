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
import { getBranchCurrentTurn } from "../services/chat-entry-parts/branch-turn-repository";
import { createEntryWithVariant } from "../services/chat-entry-parts/entries-repository";
import { createPart } from "../services/chat-entry-parts/parts-repository";
import { createVariant } from "../services/chat-entry-parts/variants-repository";
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

      // --- New model: seed entry-parts so chat window (v2) renders immediately.
      if (firstMes.length > 0) {
        const ownerId = req.body.ownerId ?? "global";
        const createdTurn = await getBranchCurrentTurn({ branchId: mainBranch.id });

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
          payload: firstMes,
          payloadFormat: "markdown",
          visibility: { ui: "always", prompt: true },
          ui: { rendererId: "markdown" },
          prompt: { serializerId: "asText" },
          lifespan: "infinite",
          createdTurn,
          source: "import",
        });

        for (const greeting of altGreetings) {
          const v = await createVariant({
            ownerId,
            entryId: seeded.entry.entryId,
            kind: "import",
          });
          await createPart({
            ownerId,
            variantId: v.variantId,
            channel: "main",
            order: 0,
            payload: greeting,
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
        await createImportedAssistantMessage({
          ownerId: req.body.ownerId,
          chatId: chat.id,
          branchId: mainBranch.id,
          promptText: firstMes,
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
