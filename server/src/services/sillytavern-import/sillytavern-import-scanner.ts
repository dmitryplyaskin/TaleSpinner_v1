import fs from "node:fs/promises";
import path from "node:path";

import { isSillyTavernPreset } from "@shared/utils/sillytavern-preset";

import { normalizeCharSpec } from "../../chat-core/charspec/normalize";
import { extractCharSpecFromPngBuffer } from "../../chat-core/charspec/png";

import {
  asString,
  asStringRecord,
  createImportItemId,
  isRecord,
  normalizePathForMeta,
  readJsonFile,
  sha256File,
  sha256Text,
  toErrorMessage,
} from "./sillytavern-import-utils";

import type {
  SillyTavernImportKind,
  SillyTavernImportScanItem,
  SillyTavernImportScanProfile,
  SillyTavernImportScanResult,
} from "@shared/types/sillytavern-import";

const PROFILE_EXCLUDE = new Set(["_cache", "_storage", "_uploads", "_webpack"]);
const IMPORT_KINDS: SillyTavernImportKind[] = [
  "character",
  "persona",
  "world_info",
  "instruction",
  "sampler",
  "chat",
];

const SAMPLER_KEYS = [
  "temperature",
  "temp",
  "top_p",
  "top_k",
  "top_a",
  "min_p",
  "rep_pen",
  "repetition_penalty",
  "frequency_penalty",
  "presence_penalty",
  "openai_max_tokens",
  "max_new_tokens",
  "seed",
];

function emptyItems(): Record<SillyTavernImportKind, SillyTavernImportScanItem[]> {
  return {
    character: [],
    persona: [],
    world_info: [],
    instruction: [],
    sampler: [],
    chat: [],
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir: string, extensions?: string[]): Promise<string[]> {
  if (!(await pathExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !extensions || extensions.includes(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
}

async function listChatFiles(chatsDir: string): Promise<Array<{ characterBase: string; fileName: string }>> {
  if (!(await pathExists(chatsDir))) return [];
  const folders = await fs.readdir(chatsDir, { withFileTypes: true });
  const result: Array<{ characterBase: string; fileName: string }> = [];
  for (const folder of folders.filter((entry) => entry.isDirectory())) {
    const files = await listFiles(path.join(chatsDir, folder.name), [".jsonl"]);
    result.push(...files.map((fileName) => ({ characterBase: folder.name, fileName })));
  }
  return result.sort((a, b) => `${a.characterBase}/${a.fileName}`.localeCompare(`${b.characterBase}/${b.fileName}`));
}

async function makeFileItem(params: {
  kind: SillyTavernImportKind;
  profileHandle: string;
  profileRoot: string;
  relativePath: string;
  name: string;
  details?: string;
  dependencyIds?: string[];
}): Promise<SillyTavernImportScanItem> {
  const filePath = path.join(params.profileRoot, params.relativePath);
  const stat = await fs.stat(filePath);
  const normalizedRelativePath = normalizePathForMeta(params.relativePath);
  const contentHash = await sha256File(filePath);
  return {
    id: createImportItemId({
      kind: params.kind,
      profileHandle: params.profileHandle,
      relativePath: normalizedRelativePath,
    }),
    source: "sillytavern",
    kind: params.kind,
    profileHandle: params.profileHandle,
    relativePath: normalizedRelativePath,
    contentHash,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    name: params.name,
    details: params.details,
    dependencyIds: params.dependencyIds,
  };
}

async function scanCharacter(params: {
  profileHandle: string;
  profileRoot: string;
  fileName: string;
}): Promise<SillyTavernImportScanItem | null> {
  const relativePath = path.join("characters", params.fileName);
  const filePath = path.join(params.profileRoot, relativePath);
  try {
    const ext = path.extname(params.fileName).toLowerCase();
    const raw =
      ext === ".png"
        ? await extractCharSpecFromPngBuffer(await fs.readFile(filePath))
        : await readJsonFile(filePath);
    const normalized = normalizeCharSpec(raw);
    return makeFileItem({
      kind: "character",
      profileHandle: params.profileHandle,
      profileRoot: params.profileRoot,
      relativePath,
      name: normalized.name || path.parse(params.fileName).name || params.fileName,
      details: params.fileName,
    });
  } catch (error) {
    return makeFileItem({
      kind: "character",
      profileHandle: params.profileHandle,
      profileRoot: params.profileRoot,
      relativePath,
      name: path.parse(params.fileName).name || params.fileName,
      details: `Parse warning: ${toErrorMessage(error)}`,
    });
  }
}

function hasSamplerFields(raw: unknown): boolean {
  if (!isRecord(raw)) return false;
  return SAMPLER_KEYS.some((key) => typeof raw[key] === "number" || typeof raw[key] === "boolean");
}

function getJsonName(raw: unknown, fallback: string): string {
  if (isRecord(raw) && typeof raw.name === "string" && raw.name.trim()) return raw.name.trim();
  return path.parse(fallback).name || fallback;
}

async function scanSettingsJson(params: {
  kind: "instruction" | "sampler";
  profileHandle: string;
  profileRoot: string;
  directory: string;
  fileName: string;
}): Promise<SillyTavernImportScanItem | null> {
  const relativePath = path.join(params.directory, params.fileName);
  try {
    const raw = await readJsonFile(path.join(params.profileRoot, relativePath));
    if (params.kind === "instruction" && !isSillyTavernPreset(raw)) return null;
    if (params.kind === "sampler" && !hasSamplerFields(raw)) return null;
    return makeFileItem({
      kind: params.kind,
      profileHandle: params.profileHandle,
      profileRoot: params.profileRoot,
      relativePath,
      name: getJsonName(raw, params.fileName),
      details: params.directory,
    });
  } catch {
    return null;
  }
}

async function scanPersonas(params: {
  profileHandle: string;
  profileRoot: string;
}): Promise<SillyTavernImportScanItem[]> {
  const settingsPath = path.join(params.profileRoot, "settings.json");
  if (!(await pathExists(settingsPath))) return [];
  const settings = await readJsonFile(settingsPath);
  const powerUser = isRecord(settings) && isRecord(settings.power_user) ? settings.power_user : {};
  const personas = asStringRecord(powerUser.personas);
  const descriptions = isRecord(powerUser.persona_descriptions) ? powerUser.persona_descriptions : {};
  const stat = await fs.stat(settingsPath);
  return Object.entries(personas).map(([avatarFile, name]) => {
    const desc = isRecord(descriptions[avatarFile]) ? asString(descriptions[avatarFile].description) : "";
    const relativePath = normalizePathForMeta(`settings.json#persona:${avatarFile}`);
    const contentHash = sha256Text(JSON.stringify({ avatarFile, name, desc }));
    return {
      id: createImportItemId({ kind: "persona", profileHandle: params.profileHandle, relativePath }),
      source: "sillytavern",
      kind: "persona",
      profileHandle: params.profileHandle,
      relativePath,
      contentHash,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      name: name.trim() || path.parse(avatarFile).name || avatarFile,
      details: avatarFile,
    };
  });
}

function createTotals(profiles: SillyTavernImportScanProfile[]): Record<SillyTavernImportKind, number> {
  return Object.fromEntries(
    IMPORT_KINDS.map((kind) => [kind, profiles.reduce((sum, profile) => sum + profile.items[kind].length, 0)])
  ) as Record<SillyTavernImportKind, number>;
}

export async function scanSillyTavernImportRoot(rootPath: string): Promise<SillyTavernImportScanResult> {
  const root = path.resolve(rootPath.trim());
  const dataDir = path.join(root, "data");
  const dataEntries = await fs.readdir(dataDir, { withFileTypes: true });
  const profileNames = dataEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !PROFILE_EXCLUDE.has(name) && !name.startsWith("_"))
    .sort((a, b) => a.localeCompare(b));

  const profiles: SillyTavernImportScanProfile[] = [];
  for (const profileHandle of profileNames) {
    const profileRoot = path.join(dataDir, profileHandle);
    const items = emptyItems();

    for (const fileName of await listFiles(path.join(profileRoot, "characters"), [".png", ".json"])) {
      const item = await scanCharacter({ profileHandle, profileRoot, fileName });
      if (item) items.character.push(item);
    }
    items.persona.push(...(await scanPersonas({ profileHandle, profileRoot })));
    for (const fileName of await listFiles(path.join(profileRoot, "worlds"), [".json"])) {
      items.world_info.push(
        await makeFileItem({
          kind: "world_info",
          profileHandle,
          profileRoot,
          relativePath: path.join("worlds", fileName),
          name: path.parse(fileName).name || fileName,
          details: fileName,
        })
      );
    }
    for (const fileName of await listFiles(path.join(profileRoot, "OpenAI Settings"), [".json"])) {
      const instruction = await scanSettingsJson({
        kind: "instruction",
        profileHandle,
        profileRoot,
        directory: "OpenAI Settings",
        fileName,
      });
      if (instruction) items.instruction.push(instruction);
      const sampler = await scanSettingsJson({
        kind: "sampler",
        profileHandle,
        profileRoot,
        directory: "OpenAI Settings",
        fileName,
      });
      if (sampler) items.sampler.push(sampler);
    }
    for (const directory of ["TextGen Settings", "KoboldAI Settings"] as const) {
      for (const fileName of await listFiles(path.join(profileRoot, directory), [".json"])) {
        const sampler = await scanSettingsJson({ kind: "sampler", profileHandle, profileRoot, directory, fileName });
        if (sampler) items.sampler.push(sampler);
      }
    }
    const characterByBase = new Map(items.character.map((item) => [path.parse(item.relativePath).name, item.id]));
    for (const chat of await listChatFiles(path.join(profileRoot, "chats"))) {
      const relativePath = path.join("chats", chat.characterBase, chat.fileName);
      items.chat.push(
        await makeFileItem({
          kind: "chat",
          profileHandle,
          profileRoot,
          relativePath,
          name: path.parse(chat.fileName).name || chat.fileName,
          details: chat.characterBase,
          dependencyIds: characterByBase.get(chat.characterBase) ? [characterByBase.get(chat.characterBase)!] : [],
        })
      );
    }

    profiles.push({
      handle: profileHandle,
      rootRelativePath: normalizePathForMeta(path.join("data", profileHandle)),
      items,
      unsupported: {},
    });
  }

  return { rootPath: root, profiles, totals: createTotals(profiles) };
}
