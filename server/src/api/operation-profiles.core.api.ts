import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { idSchema, jsonValueSchema, ownerIdSchema } from "../chat-core/schemas";
import {
  createOperationBlock,
  getOperationBlockById,
  listOperationBlocks,
  resolveImportedOperationBlockName,
} from "../services/operations/operation-blocks-repository";
import {
  createOperationProfile,
  deleteOperationProfile,
  getOperationProfileById,
  listOperationProfiles,
  updateOperationProfile,
} from "../services/operations/operation-profiles-repository";
import {
  getOperationProfileSettings,
  setActiveOperationProfile,
} from "../services/operations/operation-profile-settings-repository";
import { validateOperationProfileImport } from "../services/operations/operation-profile-validator";

const router = express.Router();

const idParamsSchema = z.object({ id: idSchema });

const createBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  input: jsonValueSchema,
});

const updateBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  patch: jsonValueSchema,
});

function resolveImportedProfileName(input: string, existingNames: string[]): string {
  const base = input.trim() || "Imported profile";
  if (!existingNames.includes(base)) return base;
  for (let idx = 2; idx <= 9999; idx += 1) {
    const candidate = `${base} (imported ${idx})`;
    if (!existingNames.includes(candidate)) return candidate;
  }
  return `${base} (imported ${Date.now()})`;
}

router.get(
  "/operation-profiles",
  asyncHandler(async () => {
    const items = await listOperationProfiles({ ownerId: "global" });
    return { data: items };
  })
);

router.post(
  "/operation-profiles",
  validate({ body: createBodySchema }),
  asyncHandler(async (req: Request) => {
    const created = await createOperationProfile({
      ownerId: req.body.ownerId,
      input: req.body.input,
    });
    return { data: created };
  })
);

// ---- Active profile (global only)

router.get(
  "/operation-profiles/active",
  asyncHandler(async () => {
    const settings = await getOperationProfileSettings();
    return { data: settings };
  })
);

const setActiveBodySchema = z.object({
  activeProfileId: idSchema.nullable(),
});

router.put(
  "/operation-profiles/active",
  validate({ body: setActiveBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = setActiveBodySchema.parse(req.body);
    if (body.activeProfileId !== null) {
      const exists = await getOperationProfileById(body.activeProfileId);
      if (!exists) {
        throw new HttpError(404, "OperationProfile не найден", "NOT_FOUND");
      }
    }
    const updated = await setActiveOperationProfile({
      activeProfileId: body.activeProfileId,
    });
    return { data: updated };
  })
);

router.get(
  "/operation-profiles/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const item = await getOperationProfileById(params.id);
    if (!item) throw new HttpError(404, "OperationProfile не найден", "NOT_FOUND");
    return { data: item };
  })
);

router.put(
  "/operation-profiles/:id",
  validate({ params: idParamsSchema, body: updateBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const updated = await updateOperationProfile({
      ownerId: req.body.ownerId,
      profileId: params.id,
      patch: req.body.patch,
    });
    if (!updated) throw new HttpError(404, "OperationProfile не найден", "NOT_FOUND");
    return { data: updated };
  })
);

router.delete(
  "/operation-profiles/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const exists = await getOperationProfileById(params.id);
    if (!exists) throw new HttpError(404, "OperationProfile не найден", "NOT_FOUND");
    await deleteOperationProfile({ ownerId: "global", profileId: params.id });
    return { data: { id: params.id } };
  })
);

// ---- Import / export

router.get(
  "/operation-profiles/:id/export",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const item = await getOperationProfileById(params.id);
    if (!item) throw new HttpError(404, "OperationProfile не найден", "NOT_FOUND");
    const blocks = [];
    for (const ref of item.blockRefs) {
      const block = await getOperationBlockById(ref.blockId);
      if (!block) {
        throw new HttpError(400, "OperationBlock не найден", "VALIDATION_ERROR", {
          profileId: item.profileId,
          blockId: ref.blockId,
        });
      }
      blocks.push({
        blockId: block.blockId,
        name: block.name,
        description: block.description,
        enabled: block.enabled,
        operations: block.operations,
        meta: block.meta ?? undefined,
      });
    }
    return {
      data: {
        type: "operation_profile_bundle",
        version: 2,
        profile: {
          profileId: item.profileId,
          name: item.name,
          description: item.description,
          enabled: item.enabled,
          executionMode: item.executionMode,
          operationProfileSessionId: item.operationProfileSessionId,
          blockRefs: item.blockRefs,
          meta: item.meta ?? undefined,
        },
        blocks,
      },
    };
  })
);

const importBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  items: z.union([jsonValueSchema, z.array(jsonValueSchema)]),
});

router.post(
  "/operation-profiles/import",
  validate({ body: importBodySchema }),
  asyncHandler(async (req: Request) => {
    const ownerId = req.body.ownerId ?? "global";
    const rawItems: unknown[] = Array.isArray(req.body.items)
      ? (req.body.items as unknown[])
      : [req.body.items as unknown];

    const existingProfiles = await listOperationProfiles({ ownerId });
    const existingBlocks = await listOperationBlocks({ ownerId });
    const profileNames = new Set(existingProfiles.map((item) => item.name));
    const blockNames = new Set(existingBlocks.map((item) => item.name));

    const created = [];
    for (const raw of rawItems) {
      const validated = validateOperationProfileImport(raw);
      if (validated.kind === "legacy_v1") {
        const safeBlockName = resolveImportedOperationBlockName(
          `${validated.legacyProfile.name} block`,
          Array.from(blockNames)
        );
        blockNames.add(safeBlockName);
        const block = await createOperationBlock({
          ownerId,
          input: {
            name: safeBlockName,
            description: validated.legacyProfile.description,
            enabled: true,
            operations: validated.legacyProfile.operations,
            meta: validated.legacyProfile.meta,
          },
        });
        const safeProfileName = resolveImportedProfileName(validated.legacyProfile.name, Array.from(profileNames));
        profileNames.add(safeProfileName);
        const profile = await createOperationProfile({
          ownerId,
          input: {
            name: safeProfileName,
            description: validated.legacyProfile.description,
            enabled: validated.legacyProfile.enabled,
            executionMode: validated.legacyProfile.executionMode,
            operationProfileSessionId: validated.legacyProfile.operationProfileSessionId,
            blockRefs: [
              {
                blockId: block.blockId,
                enabled: true,
                order: 0,
              },
            ],
            meta: undefined,
          },
        });
        created.push(profile);
        continue;
      }

      const blockIdMap = new Map<string, string>();
      for (const block of validated.blocks) {
        const safeBlockName = resolveImportedOperationBlockName(block.name, Array.from(blockNames));
        blockNames.add(safeBlockName);
        const createdBlock = await createOperationBlock({
          ownerId,
          input: {
            name: safeBlockName,
            description: block.description,
            enabled: block.enabled,
            operations: block.operations,
            meta: block.meta,
          },
        });
        if (typeof block.importBlockId === "string") {
          blockIdMap.set(block.importBlockId, createdBlock.blockId);
        }
      }

      const mappedRefs = validated.profile.blockRefs.map((ref) => ({
        ...ref,
        blockId: blockIdMap.get(ref.blockId) ?? ref.blockId,
      }));
      const safeProfileName = resolveImportedProfileName(validated.profile.name, Array.from(profileNames));
      profileNames.add(safeProfileName);
      const profile = await createOperationProfile({
        ownerId,
        input: {
          ...validated.profile,
          name: safeProfileName,
          blockRefs: mappedRefs,
        },
      });
      created.push(profile);
    }
    return { data: { created } };
  })
);

export default router;

