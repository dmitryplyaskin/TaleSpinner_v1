import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { resolveTrustedOwnerId } from "@core/request-context/owner-scope-storage";

import { normalizeCharSpec } from "../../chat-core/charspec/normalize";
import { extractCharSpecFromPngBuffer } from "../../chat-core/charspec/png";
import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { chats, messageVariants } from "../../db/schema";
import { createDataPath } from "../../utils";
import {
  createChat,
  createChatMessage,
  createImportedAssistantMessage,
} from "../chat-core/chats-repository";
import { createEntityProfile, listEntityProfiles } from "../chat-core/entity-profiles-repository";
import {
  createStBaseConfigFromPreset,
  detectStChatCompletionPreset,
} from "../chat-core/instruction-st-base";
import { createInstruction, listInstructions } from "../chat-core/instructions-repository";
import { createUserPerson, listUserPersons, updateUserPerson } from "../chat-core/user-persons-repository";
import { resolveImportedSamplerPresetName, samplersService } from "../samplers.service";
import {
  convertWorldInfoImport,
  type WorldInfoImportFormat,
} from "../world-info/world-info-converters";
import {
  createWorldInfoBook,
  listWorldInfoBooksForIndexing,
  replaceWorldInfoBindings,
} from "../world-info/world-info-repositories";

import { scanSillyTavernImportRoot } from "./sillytavern-import-scanner";
import {
  asString,
  isRecord,
  readJsonFile,
  sourceMatches,
  ST_IMPORT_META_KEY,
  toErrorMessage,
  withImportedAt,
} from "./sillytavern-import-utils";

import type { NormalizedCharSpec } from "../../chat-core/charspec/types";
import type { SamplerItemSettingsType, SamplersItemType } from "@shared/types/samplers";
import type {
  SillyTavernImportCreatedItem,
  SillyTavernImportFailedItem,
  SillyTavernImportRequest,
  SillyTavernImportResult,
  SillyTavernImportScanItem,
  SillyTavernImportSourceMeta,
} from "@shared/types/sillytavern-import";

type ImportContext = {
  rootPath: string;
  ownerId: string;
  selectedIds: Set<string>;
  itemById: Map<string, SillyTavernImportScanItem>;
  profileRootByHandle: Map<string, string>;
  created: SillyTavernImportCreatedItem[];
  skipped: SillyTavernImportResult["skipped"];
  failed: SillyTavernImportFailedItem[];
  entityProfileByItemId: Map<string, string>;
};

type ChatMessageInput = {
  name: string;
  is_user: boolean;
  is_system: boolean;
  mes: string;
  swipes?: string[];
  swipe_id?: number;
};

function toSourceMeta(item: SillyTavernImportScanItem): SillyTavernImportSourceMeta {
  const { id: _id, name: _name, details: _details, dependencyIds: _dependencyIds, ...meta } = item;
  return meta;
}

function getProfileRoot(ctx: ImportContext, item: SillyTavernImportScanItem): string {
  const root = ctx.profileRootByHandle.get(item.profileHandle);
  if (!root) throw new Error(`Profile not found: ${item.profileHandle}`);
  return root;
}

function getFilePath(ctx: ImportContext, item: SillyTavernImportScanItem): string {
  return path.join(getProfileRoot(ctx, item), item.relativePath);
}

async function readCharacter(filePath: string): Promise<{
  raw: unknown;
  normalized: NormalizedCharSpec;
}> {
  const ext = path.extname(filePath).toLowerCase();
  const raw =
    ext === ".png"
      ? await extractCharSpecFromPngBuffer(await fs.readFile(filePath))
      : await readJsonFile(filePath);
  return { raw, normalized: normalizeCharSpec(raw) };
}

async function saveCharacterAvatar(filePath: string): Promise<string | undefined> {
  if (path.extname(filePath).toLowerCase() !== ".png") return undefined;
  const dir = createDataPath("media", "images", "entity-profiles");
  await fs.mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.png`;
  await fs.copyFile(filePath, path.join(dir, filename));
  return `/media/images/entity-profiles/${filename}`;
}

async function savePersonaAvatar(profileRoot: string, avatarFile: string): Promise<string | undefined> {
  const safeName = path.basename(avatarFile);
  if (!safeName) return undefined;
  const sourcePath = path.join(profileRoot, "User Avatars", safeName);
  const ext = path.extname(safeName).toLowerCase();
  const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
  if (!allowedExtensions.has(ext)) return undefined;
  try {
    await fs.access(sourcePath);
  } catch {
    return undefined;
  }
  const dir = createDataPath("media", "images", "user-persons");
  await fs.mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await fs.copyFile(sourcePath, path.join(dir, filename));
  return `/media/images/user-persons/${filename}`;
}

async function findExistingEntityId(ownerId: string, source: SillyTavernImportSourceMeta): Promise<string | null> {
  const profiles = await listEntityProfiles({ ownerId });
  return profiles.find((profile) => sourceMatches(profile.meta, source))?.id ?? null;
}

async function importEmbeddedCharacterBook(
  ctx: ImportContext,
  item: SillyTavernImportScanItem,
  profileId: string,
  characterBook: unknown
): Promise<void> {
  if (!isRecord(characterBook)) return;
  const meta = {
    ...toSourceMeta(item),
    kind: "world_info" as const,
    relativePath: `${item.relativePath}#character_book`,
  };
  const existing = await listWorldInfoBooksForIndexing({ ownerId: ctx.ownerId });
  const found = existing.find((book) =>
    sourceMatches(isRecord(book.extensions) ? book.extensions[ST_IMPORT_META_KEY] : null, meta)
  );
  if (found) {
    await replaceWorldInfoBindings({
      ownerId: ctx.ownerId,
      scope: "entity_profile",
      scopeId: profileId,
      items: [{ bookId: found.id, bindingRole: "primary", meta }],
    });
    return;
  }
  const converted = convertWorldInfoImport({
    raw: characterBook,
    format: "character_book",
    fallbackName: `${item.name} lorebook`,
  });
  const book = await createWorldInfoBook({
    ownerId: ctx.ownerId,
    name: converted.name,
    data: converted.data,
    extensions: { [ST_IMPORT_META_KEY]: withImportedAt(meta) },
    source: "imported",
  });
  await replaceWorldInfoBindings({
    ownerId: ctx.ownerId,
    scope: "entity_profile",
    scopeId: profileId,
    items: [{ bookId: book.id, bindingRole: "primary", meta }],
  });
  ctx.created.push({ kind: "world_info", itemId: `${item.id}:character_book`, targetId: book.id, name: book.name });
}

async function importCharacter(ctx: ImportContext, item: SillyTavernImportScanItem, dependency = false): Promise<string | null> {
  const source = toSourceMeta(item);
  const existingId = await findExistingEntityId(ctx.ownerId, source);
  if (existingId) {
    ctx.entityProfileByItemId.set(item.id, existingId);
    if (!dependency) ctx.skipped.push({ kind: item.kind, itemId: item.id, name: item.name, reason: "duplicate" });
    return existingId;
  }
  const filePath = getFilePath(ctx, item);
  const { normalized } = await readCharacter(filePath);
  const name = normalized.name.trim() || item.name;
  const avatarAssetId = await saveCharacterAvatar(filePath);
  const profile = await createEntityProfile({
    ownerId: ctx.ownerId,
    name,
    kind: "CharSpec",
    spec: { ...normalized, name },
    avatarAssetId,
    meta: { [ST_IMPORT_META_KEY]: withImportedAt(source) },
  });
  ctx.entityProfileByItemId.set(item.id, profile.id);
  ctx.created.push({ kind: "character", itemId: item.id, targetId: profile.id, name: profile.name });
  await importEmbeddedCharacterBook(ctx, item, profile.id, normalized.character_book);
  return profile.id;
}

async function importWorldInfo(ctx: ImportContext, item: SillyTavernImportScanItem): Promise<void> {
  const source = toSourceMeta(item);
  const existing = await listWorldInfoBooksForIndexing({ ownerId: ctx.ownerId });
  if (existing.some((book) => sourceMatches(isRecord(book.extensions) ? book.extensions[ST_IMPORT_META_KEY] : null, source))) {
    ctx.skipped.push({ kind: item.kind, itemId: item.id, name: item.name, reason: "duplicate" });
    return;
  }
  const raw = await readJsonFile(getFilePath(ctx, item));
  const converted = convertWorldInfoImport({
    raw,
    format: "auto" satisfies WorldInfoImportFormat,
    fallbackName: item.name,
  });
  const book = await createWorldInfoBook({
    ownerId: ctx.ownerId,
    name: converted.name,
    data: converted.data,
    extensions: { [ST_IMPORT_META_KEY]: withImportedAt(source) },
    source: "imported",
  });
  ctx.created.push({ kind: "world_info", itemId: item.id, targetId: book.id, name: book.name });
}

async function importInstruction(ctx: ImportContext, item: SillyTavernImportScanItem): Promise<void> {
  const source = toSourceMeta(item);
  const existing = await listInstructions({ ownerId: ctx.ownerId });
  if (existing.some((instruction) => sourceMatches(instruction.meta, source))) {
    ctx.skipped.push({ kind: item.kind, itemId: item.id, name: item.name, reason: "duplicate" });
    return;
  }
  const preset = await readJsonFile(getFilePath(ctx, item));
  if (!detectStChatCompletionPreset(preset)) throw new Error("Not a SillyTavern chat-completion preset.");
  const instruction = await createInstruction({
    ownerId: ctx.ownerId,
    name: item.name,
    kind: "st_base",
    engine: "liquidjs",
    stBase: createStBaseConfigFromPreset({
      preset,
      fileName: path.basename(item.relativePath),
      sensitiveImportMode: "remove",
    }),
    meta: { [ST_IMPORT_META_KEY]: withImportedAt(source) },
  });
  ctx.created.push({ kind: "instruction", itemId: item.id, targetId: instruction.id, name: instruction.name });
}

function toSamplerSettings(raw: unknown): SamplerItemSettingsType {
  const src = isRecord(raw) ? raw : {};
  const settings: SamplerItemSettingsType = { sillytavernRaw: src };
  const numeric = (key: string): number | undefined => (typeof src[key] === "number" ? src[key] : undefined);
  settings.temperature = numeric("temperature") ?? numeric("temp");
  settings.topP = numeric("top_p");
  settings.topK = numeric("top_k");
  settings.topA = numeric("top_a");
  settings.minP = numeric("min_p");
  settings.frequencyPenalty = numeric("frequency_penalty");
  settings.presencePenalty = numeric("presence_penalty");
  settings.repetitionPenalty = numeric("repetition_penalty") ?? numeric("rep_pen");
  settings.maxTokens = numeric("openai_max_tokens") ?? numeric("max_new_tokens");
  settings.seed = numeric("seed");
  return Object.fromEntries(Object.entries(settings).filter(([, value]) => typeof value !== "undefined")) as SamplerItemSettingsType;
}

async function importSampler(ctx: ImportContext, item: SillyTavernImportScanItem): Promise<void> {
  const source = toSourceMeta(item);
  const existing = await samplersService.samplers.getAll();
  if (existing.some((sampler) => sourceMatches(sampler.settings?.[ST_IMPORT_META_KEY], source))) {
    ctx.skipped.push({ kind: item.kind, itemId: item.id, name: item.name, reason: "duplicate" });
    return;
  }
  const names = existing.map((sampler) => sampler.name);
  const now = new Date().toISOString();
  const raw = await readJsonFile(getFilePath(ctx, item));
  const sampler: SamplersItemType = {
    id: randomUUID(),
    name: resolveImportedSamplerPresetName(item.name, names),
    settings: { ...toSamplerSettings(raw), [ST_IMPORT_META_KEY]: withImportedAt(source) },
    createdAt: now,
    updatedAt: now,
  };
  await samplersService.samplers.create(sampler);
  ctx.created.push({ kind: "sampler", itemId: item.id, targetId: sampler.id, name: sampler.name });
}

function parseChatMessage(value: unknown): ChatMessageInput | null {
  if (!isRecord(value)) return null;
  return {
    name: asString(value.name),
    is_user: value.is_user === true,
    is_system: value.is_system === true,
    mes: asString(value.mes),
    swipes: Array.isArray(value.swipes) ? value.swipes.map(asString) : undefined,
    swipe_id: typeof value.swipe_id === "number" ? value.swipe_id : undefined,
  };
}

async function readChatMessages(filePath: string): Promise<{ meta: Record<string, unknown>; messages: ChatMessageInput[] }> {
  const text = await fs.readFile(filePath, "utf8");
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const meta = lines[0] ? safeJsonParse(lines[0], {}) : {};
  const messages = lines.slice(1).map((line) => parseChatMessage(safeJsonParse(line, null))).filter((item): item is ChatMessageInput => Boolean(item));
  return { meta: isRecord(meta) ? meta : {}, messages };
}

async function chatExists(ctx: ImportContext, source: SillyTavernImportSourceMeta): Promise<boolean> {
  const db = await initDb();
  const rows = await db.select({ metaJson: chats.metaJson }).from(chats);
  return rows.some((row) => sourceMatches(safeJsonParse(row.metaJson, null), source));
}

async function addSwipeVariants(params: {
  ownerId: string;
  messageId: string;
  swipes: string[];
  selectedIndex: number;
}): Promise<void> {
  if (params.swipes.length <= 1) return;
  const db = await initDb();
  const now = new Date();
  const extraVariants = params.swipes
    .map((text, idx) => ({ text, idx }))
    .filter((item) => item.idx !== params.selectedIndex)
    .map((item) => ({
      id: randomUUID(),
      ownerId: params.ownerId,
      messageId: params.messageId,
      createdAt: now,
      kind: "import" as const,
      promptText: item.text,
      blocksJson: "[]",
      metaJson: safeJsonStringify({ importedAt: now.toISOString(), swipeIndex: item.idx }),
      isSelected: false,
  }));
  if (extraVariants.length > 0) await db.insert(messageVariants).values(extraVariants);
}

async function importChat(ctx: ImportContext, item: SillyTavernImportScanItem): Promise<void> {
  const source = toSourceMeta(item);
  if (await chatExists(ctx, source)) {
    ctx.skipped.push({ kind: item.kind, itemId: item.id, name: item.name, reason: "duplicate" });
    return;
  }
  const dependencyId = item.dependencyIds?.[0];
  const dependency = dependencyId ? ctx.itemById.get(dependencyId) : null;
  if (!dependency) {
    ctx.skipped.push({ kind: item.kind, itemId: item.id, name: item.name, reason: "unsupported_dependency" });
    return;
  }
  const entityProfileId =
    ctx.entityProfileByItemId.get(dependency.id) ?? (await importCharacter(ctx, dependency, true));
  if (!entityProfileId) throw new Error("Unable to resolve imported entity profile for chat.");
  const { chat, mainBranch } = await createChat({
    ownerId: ctx.ownerId,
    entityProfileId,
    title: item.name,
    meta: { [ST_IMPORT_META_KEY]: withImportedAt(source) },
  });
  const { meta, messages } = await readChatMessages(getFilePath(ctx, item));
  void meta;
  for (const message of messages) {
    if (message.is_user) {
      await createChatMessage({
        ownerId: ctx.ownerId,
        chatId: chat.id,
        branchId: mainBranch.id,
        role: "user",
        promptText: message.mes,
        meta: { [ST_IMPORT_META_KEY]: withImportedAt(source), stName: message.name },
      });
      continue;
    }
    const selectedIndex = typeof message.swipe_id === "number" ? Math.max(0, message.swipe_id) : 0;
    const swipes = message.swipes && message.swipes.length > 0 ? message.swipes : [message.mes];
    const selectedText = swipes[selectedIndex] ?? swipes[0] ?? message.mes;
    const created = await createImportedAssistantMessage({
      ownerId: ctx.ownerId,
      chatId: chat.id,
      branchId: mainBranch.id,
      promptText: selectedText,
      meta: { [ST_IMPORT_META_KEY]: withImportedAt(source), stName: message.name },
    });
    if (swipes.length > 1) {
      await addSwipeVariants({
        ownerId: ctx.ownerId,
        messageId: created.assistantMessageId,
        swipes,
        selectedIndex,
      });
    }
  }
  ctx.created.push({ kind: "chat", itemId: item.id, targetId: chat.id, name: chat.title });
}

async function importPersona(ctx: ImportContext, item: SillyTavernImportScanItem): Promise<void> {
  const source = toSourceMeta(item);
  const existing = await listUserPersons({ ownerId: ctx.ownerId });
  const existingPerson = existing.find((person) => sourceMatches(person.contentTypeExtended, source));
  const profileRoot = getProfileRoot(ctx, item);
  const avatarFile = item.relativePath.split("#persona:")[1] ?? "";
  if (existingPerson) {
    if (avatarFile && !existingPerson.avatarUrl?.startsWith("/media/")) {
      const avatarUrl = await savePersonaAvatar(profileRoot, avatarFile);
      if (avatarUrl) await updateUserPerson({ id: existingPerson.id, avatarUrl });
    }
    ctx.skipped.push({ kind: item.kind, itemId: item.id, name: item.name, reason: "duplicate" });
    return;
  }
  const settings = await readJsonFile(path.join(profileRoot, "settings.json"));
  const powerUser = isRecord(settings) && isRecord(settings.power_user) ? settings.power_user : {};
  const descriptions = isRecord(powerUser.persona_descriptions) ? powerUser.persona_descriptions : {};
  const rawDescription = isRecord(descriptions[avatarFile]) ? asString(descriptions[avatarFile].description) : "";
  const avatarUrl = avatarFile ? await savePersonaAvatar(profileRoot, avatarFile) : undefined;
  const person = await createUserPerson({
    ownerId: ctx.ownerId,
    name: item.name,
    avatarUrl,
    type: "extended",
    contentTypeDefault: rawDescription,
    contentTypeExtended: {
      version: 2,
      baseDescription: rawDescription,
      settings: { additionalJoiner: "\n\n", wrapperEnabled: false, wrapperTemplate: "" },
      blocks: [],
      [ST_IMPORT_META_KEY]: withImportedAt(source),
    },
  });
  ctx.created.push({ kind: "persona", itemId: item.id, targetId: person.id, name: person.name });
}

async function runOne(ctx: ImportContext, item: SillyTavernImportScanItem): Promise<void> {
  if (!ctx.selectedIds.has(item.id)) {
    ctx.skipped.push({ kind: item.kind, itemId: item.id, name: item.name, reason: "not_selected" });
    return;
  }
  try {
    if (item.kind === "character") await importCharacter(ctx, item);
    else if (item.kind === "persona") await importPersona(ctx, item);
    else if (item.kind === "world_info") await importWorldInfo(ctx, item);
    else if (item.kind === "instruction") await importInstruction(ctx, item);
    else if (item.kind === "sampler") await importSampler(ctx, item);
    else await importChat(ctx, item);
  } catch (error) {
    ctx.failed.push({ kind: item.kind, itemId: item.id, name: item.name, error: toErrorMessage(error) });
  }
}

export async function importSillyTavernSelection(params: SillyTavernImportRequest): Promise<SillyTavernImportResult> {
  const scan = await scanSillyTavernImportRoot(params.rootPath);
  const itemById = new Map<string, SillyTavernImportScanItem>();
  const profileRootByHandle = new Map<string, string>();
  for (const profile of scan.profiles) {
    profileRootByHandle.set(profile.handle, path.join(scan.rootPath, profile.rootRelativePath));
    for (const items of Object.values(profile.items)) {
      for (const item of items) itemById.set(item.id, item);
    }
  }
  const ctx: ImportContext = {
    rootPath: scan.rootPath,
    ownerId: resolveTrustedOwnerId(params.ownerId),
    selectedIds: new Set(params.selection.itemIds),
    itemById,
    profileRootByHandle,
    created: [],
    skipped: [],
    failed: [],
    entityProfileByItemId: new Map(),
  };
  const orderedKinds = ["character", "persona", "world_info", "instruction", "sampler", "chat"] as const;
  for (const kind of orderedKinds) {
    for (const item of itemById.values()) {
      if (item.kind === kind && ctx.selectedIds.has(item.id)) await runOne(ctx, item);
    }
  }
  return { created: ctx.created, skipped: ctx.skipped, failed: ctx.failed };
}
