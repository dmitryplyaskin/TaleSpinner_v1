import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { assertSafeFilenameOrThrow, resolveSafePath } from "@core/files/safe-path";
import { resolveTrustedOwnerId } from "@core/request-context/owner-scope-storage";

import { createDataPath } from "../../utils";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function getEntityProfileImagesRoot(): string {
  return createDataPath("media", "images", "entity-profiles");
}

export function resolveEntityProfileMediaPath(avatarAssetId: string | null): string | null {
  const prefix = "/media/images/entity-profiles/";
  if (!avatarAssetId?.startsWith(prefix)) return null;

  try {
    const ownerId = resolveTrustedOwnerId();
    const segments = avatarAssetId.slice(prefix.length).split("/").filter(Boolean);
    if (segments.length === 1 && ownerId === "global") {
      return resolveSafePath(getEntityProfileImagesRoot(), segments[0]);
    }
    if (segments.length !== 2 || segments[0] !== ownerId) return null;

    const ownerFolder = resolveSafePath(
      getEntityProfileImagesRoot(),
      assertSafeFilenameOrThrow(ownerId)
    );
    return resolveSafePath(ownerFolder, segments[1]);
  } catch {
    return null;
  }
}

export async function readEntityProfileAvatarFile(avatarAssetId: string | null): Promise<{
  data: Buffer;
  fileName: string;
  mediaType: "image/png";
} | null> {
  const filePath = resolveEntityProfileMediaPath(avatarAssetId);
  if (!filePath) return null;

  try {
    const data = await fs.readFile(filePath);
    if (!data.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
    return {
      data,
      fileName: path.basename(filePath),
      mediaType: "image/png",
    };
  } catch {
    return null;
  }
}

export async function saveEntityProfileAvatarPng(fileBuffer: Buffer): Promise<string> {
  if (!fileBuffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Entity profile avatar must be a PNG image.");
  }

  const ownerId = assertSafeFilenameOrThrow(resolveTrustedOwnerId());
  const dir = resolveSafePath(getEntityProfileImagesRoot(), ownerId);
  await fs.mkdir(dir, { recursive: true });

  const fileName = `${randomUUID()}.png`;
  await fs.writeFile(path.join(dir, fileName), fileBuffer);
  return `/media/images/entity-profiles/${ownerId}/${fileName}`;
}
