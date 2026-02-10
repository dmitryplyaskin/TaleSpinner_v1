import { inflateSync } from "zlib";

import { normalizeWorldInfoBookPayload } from "./world-info-normalizer";
import type { WorldInfoBookData } from "./world-info-types";

export const worldInfoImportFormats = [
  "auto",
  "st_native",
  "character_book",
  "agnai",
  "risu",
  "novel",
] as const;

export type WorldInfoImportFormat = (typeof worldInfoImportFormats)[number];
type ConcreteWorldInfoImportFormat = Exclude<WorldInfoImportFormat, "auto">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is string => typeof item === "string");
}

function getTextChunkEntriesFromPng(buffer: Buffer): Array<{ keyword: string; value: string }> {
  const PNG_SIGNATURE = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Not a PNG file.");
  }

  const chunks: Array<{ keyword: string; value: string }> = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) break;
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === "tEXt") {
      const separator = data.indexOf(0x00);
      if (separator > 0) {
        const keyword = data.subarray(0, separator).toString("latin1");
        const value = data.subarray(separator + 1).toString("utf8");
        chunks.push({ keyword, value });
      }
    } else if (type === "zTXt") {
      const separator = data.indexOf(0x00);
      if (separator > 0 && separator + 2 <= data.length) {
        const keyword = data.subarray(0, separator).toString("latin1");
        const compressionMethod = data[separator + 1];
        if (compressionMethod === 0) {
          try {
            const inflated = inflateSync(data.subarray(separator + 2));
            chunks.push({ keyword, value: inflated.toString("utf8") });
          } catch {
            // ignore invalid zTXt
          }
        }
      }
    } else if (type === "iTXt") {
      // keyword\0 compression_flag\0 compression_method\0 language_tag\0 translated_keyword\0 text
      const firstNull = data.indexOf(0x00);
      if (firstNull > 0 && firstNull + 5 <= data.length) {
        const keyword = data.subarray(0, firstNull).toString("latin1");
        let cursor = firstNull + 1;
        const compressionFlag = data[cursor];
        cursor += 1;
        const compressionMethod = data[cursor];
        cursor += 1;
        const langEnd = data.indexOf(0x00, cursor);
        if (langEnd < 0) {
          offset = dataEnd + 4;
          continue;
        }
        cursor = langEnd + 1;
        const translatedEnd = data.indexOf(0x00, cursor);
        if (translatedEnd < 0) {
          offset = dataEnd + 4;
          continue;
        }
        cursor = translatedEnd + 1;
        const payload = data.subarray(cursor);
        try {
          if (compressionFlag === 1 && compressionMethod === 0) {
            chunks.push({ keyword, value: inflateSync(payload).toString("utf8") });
          } else {
            chunks.push({ keyword, value: payload.toString("utf8") });
          }
        } catch {
          // ignore invalid iTXt
        }
      }
    }

    offset = dataEnd + 4;
  }

  return chunks;
}

function parseUnknownJson(input: string): unknown {
  return JSON.parse(input) as unknown;
}

function parsePossibleJsonPayload(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const directCandidates = [trimmed];
  try {
    directCandidates.push(decodeURIComponent(trimmed));
  } catch {
    // ignore URI decode errors
  }

  for (const candidate of directCandidates) {
    try {
      return parseUnknownJson(candidate);
    } catch {
      // continue
    }
  }

  const b64Candidates = [trimmed, trimmed.replace(/\s+/g, "")];
  for (const candidate of b64Candidates) {
    try {
      const decoded = Buffer.from(candidate, "base64").toString("utf8");
      return parseUnknownJson(decoded);
    } catch {
      // continue
    }
  }

  return null;
}

function pullEntryRecord(entries: unknown): Record<string, unknown> {
  if (isRecord(entries)) return entries;
  if (Array.isArray(entries)) {
    return Object.fromEntries(entries.map((item, idx) => [String(idx), item]));
  }
  return {};
}

function toCanonicalEntry(raw: unknown, idx: number): Record<string, unknown> {
  const src = isRecord(raw) ? raw : {};
  const uid =
    typeof src.uid === "number" && Number.isFinite(src.uid)
      ? src.uid
      : typeof src.id === "number" && Number.isFinite(src.id)
        ? src.id
        : idx;
  const key =
    asStringArray(src.key).length > 0
      ? asStringArray(src.key)
      : asStringArray(src.keys).length > 0
        ? asStringArray(src.keys)
        : asStringArray(src.keywords);
  const keysecondary =
    asStringArray(src.keysecondary).length > 0
      ? asStringArray(src.keysecondary)
      : asStringArray(src.secondary_keys).length > 0
        ? asStringArray(src.secondary_keys)
        : asStringArray(src.secondaryKeywords);

  const content =
    typeof src.content === "string"
      ? src.content
      : typeof src.text === "string"
        ? src.text
        : typeof src.value === "string"
          ? src.value
          : "";

  const comment =
    typeof src.comment === "string"
      ? src.comment
      : typeof src.name === "string"
        ? src.name
        : typeof src.title === "string"
          ? src.title
          : "";

  return {
    ...src,
    uid,
    key,
    keysecondary,
    content,
    comment,
  };
}

function normalizeEntriesRecord(rawEntries: unknown): Record<string, unknown> {
  const source = pullEntryRecord(rawEntries);
  const out: Record<string, unknown> = {};
  const keys = Object.keys(source);
  keys.forEach((key, idx) => {
    out[key] = toCanonicalEntry(source[key], idx);
  });
  return out;
}

function convertStNative(raw: unknown): {
  name: string | null;
  data: WorldInfoBookData;
  warnings: string[];
} {
  const root = isRecord(raw) ? raw : {};
  const name = typeof root.name === "string" ? root.name : null;
  const entries = normalizeEntriesRecord(root.entries);
  const extensions = isRecord(root.extensions) ? root.extensions : {};
  return { name, data: { name: name ?? undefined, entries, extensions }, warnings: [] };
}

function convertCharacterBook(raw: unknown): {
  name: string | null;
  data: WorldInfoBookData;
  warnings: string[];
} {
  const root = isRecord(raw) ? raw : {};
  const rootData = isRecord(root.data) ? root.data : {};
  const nestedCharacterBook = isRecord(rootData.character_book) ? rootData.character_book : null;
  const directCharacterBook = isRecord(root.character_book) ? root.character_book : null;
  const bookRoot = nestedCharacterBook ?? directCharacterBook ?? root;
  const entriesRaw = (bookRoot as { entries?: unknown }).entries;
  const entries = normalizeEntriesRecord(entriesRaw);
  const warnings: string[] = [];
  if (!entriesRaw) warnings.push("character_book.entries was missing; imported as empty.");
  const name =
    (typeof root.name === "string" ? root.name : null) ??
    (typeof bookRoot.name === "string" ? bookRoot.name : null);
  return { name, data: { name: name ?? undefined, entries, extensions: {} }, warnings };
}

function convertAgnai(raw: unknown): {
  name: string | null;
  data: WorldInfoBookData;
  warnings: string[];
} {
  const root = isRecord(raw) ? raw : {};
  const memory = isRecord(root.memory) ? root.memory : root;
  const entriesRaw =
    Array.isArray(memory.entries)
      ? memory.entries
      : Array.isArray(root.entries)
        ? root.entries
        : [];
  const entries = normalizeEntriesRecord(entriesRaw);
  return {
    name: typeof root.name === "string" ? root.name : "Agnai Import",
    data: { entries, extensions: {} },
    warnings: [],
  };
}

function convertRisu(raw: unknown): {
  name: string | null;
  data: WorldInfoBookData;
  warnings: string[];
} {
  const root = isRecord(raw) ? raw : {};
  const sourceEntries =
    Array.isArray(root.data) ? root.data : Array.isArray(root.entries) ? root.entries : [];
  const entries = normalizeEntriesRecord(sourceEntries);
  return {
    name: typeof root.name === "string" ? root.name : "Risu Import",
    data: { entries, extensions: {} },
    warnings: [],
  };
}

function convertNovel(raw: unknown): {
  name: string | null;
  data: WorldInfoBookData;
  warnings: string[];
} {
  const root = isRecord(raw) ? raw : {};
  const sourceEntries = Array.isArray(root.entries) ? root.entries : [];
  const entries = normalizeEntriesRecord(sourceEntries);
  return {
    name: typeof root.name === "string" ? root.name : "Novel Import",
    data: { entries, extensions: {} },
    warnings: [],
  };
}

function detectFormat(raw: unknown): ConcreteWorldInfoImportFormat {
  const root = isRecord(raw) ? raw : {};
  const rootData = isRecord(root.data) ? root.data : {};
  if (isRecord(root.entries)) return "st_native";
  if (Array.isArray(root.entries) && typeof root.lorebookVersion === "number") return "novel";
  if (isRecord(root.character_book) || isRecord(rootData.character_book)) return "character_book";
  if (root.kind === "memory" || isRecord(root.memory)) return "agnai";
  if (root.type === "risu") return "risu";
  if (Array.isArray(root.entries)) return "st_native";
  return "st_native";
}

export function convertWorldInfoImport(params: {
  raw: unknown;
  format: WorldInfoImportFormat;
  fallbackName?: string;
}): { format: ConcreteWorldInfoImportFormat; name: string; data: WorldInfoBookData; warnings: string[] } {
  const format = params.format === "auto" ? detectFormat(params.raw) : params.format;
  const converted =
    format === "st_native"
      ? convertStNative(params.raw)
      : format === "character_book"
        ? convertCharacterBook(params.raw)
        : format === "agnai"
          ? convertAgnai(params.raw)
          : format === "risu"
            ? convertRisu(params.raw)
            : convertNovel(params.raw);

  const normalized = normalizeWorldInfoBookPayload(converted.data);
  const name =
    converted.name?.trim() ||
    params.fallbackName?.trim() ||
    "Imported World Info";

  return {
    format,
    name,
    data: normalized.data,
    warnings: converted.warnings,
  };
}

export function exportWorldInfoBookToStNative(params: {
  name: string;
  data: WorldInfoBookData;
  extensions?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const normalized = normalizeWorldInfoBookPayload(params.data);
  return {
    name: params.name,
    entries: normalized.data.entries,
    extensions: params.extensions ?? normalized.data.extensions ?? {},
  };
}

export function parseWorldInfoImportFile(params: {
  fileBuffer: Buffer;
  originalName: string;
}): { raw: unknown; warnings: string[] } {
  const ext = params.originalName.toLowerCase().split(".").pop() ?? "";
  if (ext === "json") {
    const raw = JSON.parse(params.fileBuffer.toString("utf8")) as unknown;
    return { raw, warnings: [] };
  }
  if (ext === "png") {
    const chunks = getTextChunkEntriesFromPng(params.fileBuffer);
    const candidates = ["naidata", "chara", "ccv3"];
    for (const key of candidates) {
      const hit = chunks.find((item) => item.keyword.toLowerCase() === key);
      if (!hit) continue;
      const payload = parsePossibleJsonPayload(hit.value);
      if (payload !== null) {
        return {
          raw: payload,
          warnings: key === "naidata" ? [] : [`PNG used '${key}' payload instead of 'naidata'.`],
        };
      }
    }
    throw new Error("PNG does not contain world info payload (naidata/chara/ccv3).");
  }

  // best-effort fallback
  const raw = JSON.parse(params.fileBuffer.toString("utf8")) as unknown;
  return { raw, warnings: ["Unknown extension, parsed as JSON."] };
}
