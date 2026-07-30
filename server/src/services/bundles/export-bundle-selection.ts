import { randomUUID } from "node:crypto";

import {
  TALESPINNER_BUNDLE_ARCHIVE_EXTENSION,
  TALESPINNER_BUNDLE_ARCHIVE_MEDIA_TYPE,
  createBundleResourceId,
  parseTaleSpinnerBundle,
  type TaleSpinnerBundle,
  type TaleSpinnerBundleResource,
  type TaleSpinnerBundleResourceKind,
} from "@shared/types/bundles";

import { readEntityProfileAvatarFile } from "../chat-core/entity-profile-media";
import { getEntityProfileById } from "../chat-core/entity-profiles-repository";
import { getInstructionById } from "../chat-core/instructions-repository";
import { getOperationBlockById } from "../operations/operation-blocks-repository";
import { getOperationProfileById } from "../operations/operation-profiles-repository";
import { samplersService } from "../samplers.service";
import { getUiThemePresetById } from "../ui-theme/ui-theme-repository";
import { getWorldInfoBookById } from "../world-info/world-info-repositories";

import { encodeBundleArchive, type BundleArchiveFile } from "./bundle-archive";

export type BundleSelectionHandle = { kind: TaleSpinnerBundleResourceKind; id: string };

function safeFileBaseName(input: string): string {
  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "bundle";
}

export async function exportBundleSelection(params: {
  ownerId: string;
  source: BundleSelectionHandle;
  selections: BundleSelectionHandle[];
  format?: "json" | "archive" | "auto";
}): Promise<{
  fileName: string;
  contentType: string;
  buffer: Buffer;
  bundle: TaleSpinnerBundle;
}> {
  const resources: TaleSpinnerBundleResource[] = [];
  const files: Record<string, BundleArchiveFile> = {};
  const included = new Set<string>();
  let sourceResourceId: string | undefined;

  const include = async (handle: BundleSelectionHandle, role: TaleSpinnerBundleResource["role"]) => {
    const key = `${handle.kind}:${handle.id}`;
    if (included.has(key)) return;
    included.add(key);

    if (handle.kind === "instruction") {
      const instruction = await getInstructionById(handle.id);
      if (!instruction) throw new Error(`Instruction not found: ${handle.id}`);
      const resourceId = createBundleResourceId("instruction", `${instruction.name}-${instruction.id}`);
      resources.push({
        resourceId,
        kind: "instruction",
        schemaVersion: 1,
        role,
        title: instruction.name,
        payload:
          instruction.kind === "st_base"
            ? {
                name: instruction.name,
                kind: "st_base",
                engine: instruction.engine,
                stBase: instruction.stBase,
                meta: instruction.meta ?? undefined,
              }
            : {
                name: instruction.name,
                kind: "basic",
                engine: instruction.engine,
                templateText: instruction.templateText,
                meta: instruction.meta ?? undefined,
              },
      });
      if (handle.kind === params.source.kind && handle.id === params.source.id) sourceResourceId = resourceId;
      return;
    }

    if (handle.kind === "operation_block") {
      const block = await getOperationBlockById({
        ownerId: params.ownerId,
        blockId: handle.id,
      });
      if (!block) throw new Error(`Operation block not found: ${handle.id}`);
      const resourceId = createBundleResourceId("operation_block", `${block.name}-${block.blockId}`);
      resources.push({
        resourceId,
        kind: "operation_block",
        schemaVersion: 1,
        role,
        title: block.name,
        payload: {
          name: block.name,
          description: block.description,
          enabled: block.enabled,
          operations: block.operations,
          meta: block.meta ?? undefined,
        },
      });
      if (handle.kind === params.source.kind && handle.id === params.source.id) sourceResourceId = resourceId;
      return;
    }

    if (handle.kind === "operation_profile") {
      const profile = await getOperationProfileById({
        ownerId: params.ownerId,
        profileId: handle.id,
      });
      if (!profile) throw new Error(`Operation profile not found: ${handle.id}`);

      const enabledRefs = profile.blockRefs.filter((ref) => ref.enabled);
      const exportedBlockResources: Array<{ blockId: string; resourceId: string }> = [];
      for (const ref of enabledRefs) {
        const block = await getOperationBlockById({
          ownerId: params.ownerId,
          blockId: ref.blockId,
        });
        if (!block || !block.enabled) continue;
        const resourceId = createBundleResourceId("operation_block", `${block.name}-${block.blockId}`);
        exportedBlockResources.push({ blockId: block.blockId, resourceId });
        resources.push({
          resourceId,
          kind: "operation_block",
          schemaVersion: 1,
          role: "dependency",
          title: block.name,
          payload: {
            name: block.name,
            description: block.description,
            enabled: block.enabled,
            operations: block.operations,
            meta: block.meta ?? undefined,
          },
        });
      }

      const resourceId = createBundleResourceId("operation_profile", `${profile.name}-${profile.profileId}`);
      resources.push({
        resourceId,
        kind: "operation_profile",
        schemaVersion: 1,
        role,
        title: profile.name,
        payload: {
          name: profile.name,
          description: profile.description,
          enabled: profile.enabled,
          executionMode: profile.executionMode,
          operationProfileSessionId: profile.operationProfileSessionId,
          blockRefs: profile.blockRefs
            .filter((ref) => ref.enabled)
            .map((ref) => ({
              resourceId: exportedBlockResources.find((item) => item.blockId === ref.blockId)?.resourceId ?? ref.blockId,
              enabled: ref.enabled,
              order: ref.order,
            }))
            .filter((ref) => exportedBlockResources.some((item) => item.resourceId === ref.resourceId)),
          meta: profile.meta ?? undefined,
        },
      });
      if (handle.kind === params.source.kind && handle.id === params.source.id) sourceResourceId = resourceId;
      return;
    }

    if (handle.kind === "world_info_book") {
      const book = await getWorldInfoBookById(handle.id);
      if (!book) throw new Error(`World info book not found: ${handle.id}`);
      const resourceId = createBundleResourceId("world_info_book", `${book.slug}-${book.id}`);
      resources.push({
        resourceId,
        kind: "world_info_book",
        schemaVersion: 1,
        role,
        title: book.name,
        payload: {
          name: book.name,
          slug: book.slug,
          description: book.description,
          data: book.data,
          extensions: book.extensions,
          source: book.source,
        },
      });
      if (handle.kind === params.source.kind && handle.id === params.source.id) sourceResourceId = resourceId;
      return;
    }

    if (handle.kind === "entity_profile") {
      const profile = await getEntityProfileById(handle.id);
      if (!profile) throw new Error(`Entity profile not found: ${handle.id}`);
      const resourceId = createBundleResourceId("entity_profile", `${profile.name}-${profile.id}`);
      const avatar = await readEntityProfileAvatarFile(profile.avatarAssetId);
      const avatarPath = avatar ? `files/${safeFileBaseName(profile.name)}/${avatar.fileName}` : undefined;
      if (avatar && avatarPath) {
        files[avatarPath] = avatar;
      }
      resources.push({
        resourceId,
        kind: "entity_profile",
        schemaVersion: 1,
        role,
        title: profile.name,
        payload: {
          name: profile.name,
          kind: "CharSpec",
          spec: profile.spec,
          meta: profile.meta ?? undefined,
          isFavorite: profile.isFavorite,
          ...(avatar && avatarPath
            ? {
                avatarFile: {
                  path: avatarPath,
                  fileName: avatar.fileName,
                  mediaType: avatar.mediaType,
                },
              }
            : {}),
        },
      });
      if (handle.kind === params.source.kind && handle.id === params.source.id) sourceResourceId = resourceId;
      return;
    }

    if (handle.kind === "ui_theme_preset") {
      const preset = await getUiThemePresetById({ ownerId: params.ownerId, presetId: handle.id });
      if (!preset) throw new Error(`UI theme preset not found: ${handle.id}`);
      const resourceId = createBundleResourceId("ui_theme_preset", `${preset.name}-${preset.presetId}`);
      resources.push({
        resourceId,
        kind: "ui_theme_preset",
        schemaVersion: 1,
        role,
        title: preset.name,
        payload: {
          name: preset.name,
          description: preset.description,
          payload: preset.payload,
        },
      });
      if (handle.kind === params.source.kind && handle.id === params.source.id) sourceResourceId = resourceId;
      return;
    }

    if (handle.kind === "sampler_preset") {
      const preset = await samplersService.samplers.getById(handle.id);
      if (!preset) throw new Error(`Sampler preset not found: ${handle.id}`);
      const resourceId = createBundleResourceId("sampler_preset", `${preset.name}-${preset.id}`);
      resources.push({
        resourceId,
        kind: "sampler_preset",
        schemaVersion: 1,
        role,
        title: preset.name,
        payload: {
          name: preset.name,
          settings: preset.settings,
        },
      });
      if (handle.kind === params.source.kind && handle.id === params.source.id) sourceResourceId = resourceId;
    }
  };

  await include(params.source, "primary");
  for (const selection of params.selections) {
    const role = selection.kind === params.source.kind && selection.id === params.source.id ? "primary" : "related";
    await include(selection, role);
  }

  const container =
    params.format === "archive" || (params.format !== "json" && Object.keys(files).length > 0)
      ? "archive"
      : "json";
  const bundle = parseTaleSpinnerBundle({
    type: "talespinner.bundle",
    version: 1,
    bundleId: randomUUID(),
    createdAt: new Date().toISOString(),
    container,
    sourceResourceId,
    resources,
  });

  if (container === "archive") {
    const buffer = await encodeBundleArchive({ manifest: bundle, files });
    return {
      fileName: `talespinner-bundle-${safeFileBaseName(params.source.kind)}${TALESPINNER_BUNDLE_ARCHIVE_EXTENSION}`,
      contentType: TALESPINNER_BUNDLE_ARCHIVE_MEDIA_TYPE,
      buffer,
      bundle,
    };
  }

  return {
    fileName: `talespinner-bundle-${safeFileBaseName(params.source.kind)}.json`,
    contentType: "application/json; charset=utf-8",
    buffer: Buffer.from(JSON.stringify(bundle, null, 2), "utf8"),
    bundle,
  };
}
