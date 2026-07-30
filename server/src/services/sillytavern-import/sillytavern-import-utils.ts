import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type {
  SillyTavernImportKind,
  SillyTavernImportSourceMeta,
} from "@shared/types/sillytavern-import";

export const ST_IMPORT_META_KEY = "sillytavernImport";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function asStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

export function sha256Text(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function sha256File(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function createImportItemId(params: {
  kind: SillyTavernImportKind;
  profileHandle: string;
  relativePath: string;
}): string {
  return sha256Text(`${params.kind}:${params.profileHandle}:${params.relativePath}`).slice(0, 24);
}

export function normalizePathForMeta(input: string): string {
  return input.split(path.sep).join("/");
}

export function sourceMatches(a: unknown, b: SillyTavernImportSourceMeta): boolean {
  const meta = isRecord(a) && isRecord(a[ST_IMPORT_META_KEY]) ? a[ST_IMPORT_META_KEY] : a;
  if (!isRecord(meta)) return false;
  return (
    meta.source === "sillytavern" &&
    meta.kind === b.kind &&
    meta.profileHandle === b.profileHandle &&
    meta.relativePath === b.relativePath &&
    meta.contentHash === b.contentHash
  );
}

export function withImportedAt(meta: SillyTavernImportSourceMeta): SillyTavernImportSourceMeta {
  return { ...meta, importedAt: new Date().toISOString() };
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
}
