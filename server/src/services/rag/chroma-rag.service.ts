import { getChromaConfig } from "../../config/chroma-config";
import { HttpError } from "../../core/middleware/error-handler";
import { resolveTrustedOwnerId } from "../../core/request-context/owner-scope-storage";
import { generateRagEmbedding } from "../rag.service";
import { normalizeWorldInfoBookEntries } from "../world-info/world-info-normalizer";
import {
  getBookDataEntries,
  listWorldInfoBooksForIndexing,
} from "../world-info/world-info-repositories";


import {
  chromaClient,
  type ChromaCollection,
  type ChromaCollectionListItem,
  type ChromaMetadata,
  type ChromaWhere,
} from "./chroma-client";
import { extractEmbeddings } from "./rag-embeddings-normalizer";

import type { WorldInfoBookDto } from "../world-info/world-info-types";


type ChromaMetadataValue = string | number | boolean | null;

type ChromaDocInput = {
  id: string;
  document: string;
  metadata?: Record<string, ChromaMetadataValue>;
};

type ChromaQueryHit = {
  id: string;
  document?: string;
  metadata?: Record<string, unknown>;
  distance?: number;
};

type ChromaPeekItem = {
  id: string;
  document?: string;
  metadata?: Record<string, unknown>;
};

type ChromaRagServiceDeps = {
  chroma: {
    heartbeat: () => Promise<unknown>;
    listCollections: () => Promise<ChromaCollectionListItem[]>;
    getOrCreateCollection: (params: {
      name: string;
      metadata?: ChromaMetadata;
    }) => Promise<ChromaCollection>;
    deleteCollection: (name: string) => Promise<void>;
  };
  generateEmbedding: (params: { input: string | string[] }) => Promise<unknown>;
  listBooksForIndexing: (params?: { ownerId?: string }) => Promise<WorldInfoBookDto[]>;
};

const REINDEX_BATCH_SIZE = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveCollectionName(collectionName?: string): string {
  const fallback = getChromaConfig().worldInfoCollection;
  const normalized = toNonEmptyString(collectionName);
  const logicalName = normalized ?? fallback;
  const ownerId = resolveTrustedOwnerId();
  if (ownerId === "global") {
    return looksOwnerNamespaced(logicalName) ? `global__${logicalName}` : logicalName;
  }
  return `${ownerId}__${logicalName}`;
}

function looksOwnerNamespaced(name: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}__/i.test(name);
}

function isVisibleCollectionName(name: string): boolean {
  const ownerId = resolveTrustedOwnerId();
  if (ownerId === "global") return !looksOwnerNamespaced(name);
  return name.startsWith(`${ownerId}__`);
}

function toVisibleCollectionName(name: string): string {
  const ownerId = resolveTrustedOwnerId();
  if (ownerId === "global") return name;
  return name.slice(`${ownerId}__`.length);
}

function normalizePeekResult(raw: unknown): ChromaPeekItem[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item): ChromaPeekItem | null => {
        if (!isRecord(item)) return null;
        const id = toNonEmptyString(item.id);
        if (!id) return null;
        const document = typeof item.document === "string" ? item.document : undefined;
        const metadata = isRecord(item.metadata) ? item.metadata : undefined;
        return { id, document, metadata };
      })
      .filter((item): item is ChromaPeekItem => Boolean(item));
  }

  if (!isRecord(raw) || !Array.isArray(raw.ids)) {
    return [];
  }

  const ids = raw.ids as unknown[];
  const docs = Array.isArray(raw.documents) ? (raw.documents as unknown[]) : [];
  const metas = Array.isArray(raw.metadatas) ? (raw.metadatas as unknown[]) : [];

  const items: ChromaPeekItem[] = [];
  for (let idx = 0; idx < ids.length; idx += 1) {
    const id = toNonEmptyString(ids[idx]);
    if (!id) continue;
    const document = typeof docs[idx] === "string" ? (docs[idx] as string) : undefined;
    const metadata = isRecord(metas[idx]) ? (metas[idx] as Record<string, unknown>) : undefined;
    items.push({ id, document, metadata });
  }
  return items;
}

function firstQueryLevel(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  if (value.length > 0 && Array.isArray(value[0])) {
    return value[0] as unknown[];
  }
  return value as unknown[];
}

function normalizeQueryResult(raw: unknown): ChromaQueryHit[] {
  if (!isRecord(raw)) return [];

  const ids = firstQueryLevel(raw.ids);
  const docs = firstQueryLevel(raw.documents);
  const metas = firstQueryLevel(raw.metadatas);
  const distances = firstQueryLevel(raw.distances);

  const hits: ChromaQueryHit[] = [];
  for (let idx = 0; idx < ids.length; idx += 1) {
    const id = toNonEmptyString(ids[idx]);
    if (!id) continue;
    hits.push({
      id,
      document: typeof docs[idx] === "string" ? (docs[idx] as string) : undefined,
      metadata: isRecord(metas[idx]) ? (metas[idx] as Record<string, unknown>) : undefined,
      distance:
        typeof distances[idx] === "number" && Number.isFinite(distances[idx])
          ? (distances[idx] as number)
          : undefined,
    });
  }

  return hits;
}

function ensureItems(items: ChromaDocInput[]): ChromaDocInput[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, "items must be a non-empty array", "VALIDATION_ERROR");
  }
  return items.map((item) => {
    const id = toNonEmptyString(item.id);
    const document = toNonEmptyString(item.document);
    if (!id || !document) {
      throw new HttpError(
        400,
        "Each item must contain non-empty id and document",
        "VALIDATION_ERROR"
      );
    }
    return {
      id,
      document,
      metadata: item.metadata,
    };
  });
}

function toMetadataRecord(input: Record<string, unknown> | undefined): ChromaMetadata {
  if (!input) return {};
  const out: ChromaMetadata = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    }
  }
  return out;
}

async function createCollectionWithReplace(params: {
  chroma: ChromaRagServiceDeps["chroma"];
  collectionName: string;
}): Promise<ChromaCollection> {
  const collections = await params.chroma.listCollections();
  if (collections.some((item) => item.name === params.collectionName)) {
    await params.chroma.deleteCollection(params.collectionName);
  }
  return params.chroma.getOrCreateCollection({ name: params.collectionName });
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function createChromaRagService(
  deps: ChromaRagServiceDeps = {
    chroma: chromaClient,
    generateEmbedding: generateRagEmbedding,
    listBooksForIndexing: listWorldInfoBooksForIndexing,
  }
) {
  return {
    async health(): Promise<{
      connected: boolean;
      heartbeat?: string;
      config: {
        url: string;
        tenant: string;
        database: string;
        defaultCollection: string;
      };
    }> {
      const config = getChromaConfig();
      try {
        const heartbeat = await deps.chroma.heartbeat();
        return {
          connected: true,
          heartbeat: String(heartbeat),
          config: {
            url: config.url,
            tenant: config.tenant,
            database: config.database,
            defaultCollection: config.worldInfoCollection,
          },
        };
      } catch {
        return {
          connected: false,
          config: {
            url: config.url,
            tenant: config.tenant,
            database: config.database,
            defaultCollection: config.worldInfoCollection,
          },
        };
      }
    },

    async listCollections(): Promise<ChromaCollectionListItem[]> {
      const collections = await deps.chroma.listCollections();
      return collections
        .filter((collection) => isVisibleCollectionName(collection.name))
        .map((collection) => ({
          ...collection,
          name: toVisibleCollectionName(collection.name),
        }));
    },

    async createCollection(params: {
      name: string;
      metadata?: Record<string, unknown>;
    }): Promise<{ name: string }> {
      const name = toNonEmptyString(params.name);
      if (!name) {
        throw new HttpError(400, "Collection name is required", "VALIDATION_ERROR");
      }
      const storedName = resolveCollectionName(name);
      await deps.chroma.getOrCreateCollection({
        name: storedName,
        metadata: toMetadataRecord(params.metadata),
      });
      return { name };
    },

    async deleteCollection(name: string): Promise<{ name: string }> {
      const normalized = toNonEmptyString(name);
      if (!normalized) {
        throw new HttpError(400, "Collection name is required", "VALIDATION_ERROR");
      }
      await deps.chroma.deleteCollection(resolveCollectionName(normalized));
      return { name: normalized };
    },

    async upsertDocuments(params: {
      collectionName?: string;
      items: ChromaDocInput[];
    }): Promise<{ collectionName: string; upserted: number }> {
      const collectionName = resolveCollectionName(params.collectionName);
      const items = ensureItems(params.items);
      const collection = await deps.chroma.getOrCreateCollection({
        name: collectionName,
      });

      const embeddingsRaw = await deps.generateEmbedding({
        input: items.map((item) => item.document),
      });
      const embeddings = extractEmbeddings(embeddingsRaw, {
        expectedCount: items.length,
      });

      await collection.upsert({
        ids: items.map((item) => item.id),
        documents: items.map((item) => item.document),
        metadatas: items.map((item) => (item.metadata ? item.metadata : {})),
        embeddings,
      });

      return {
        collectionName,
        upserted: items.length,
      };
    },

    async deleteDocuments(params: {
      collectionName?: string;
      ids?: string[];
      where?: ChromaWhere;
    }): Promise<{
      collectionName: string;
      deletedIds?: string[];
      deletedByWhere?: boolean;
    }> {
      const collectionName = resolveCollectionName(params.collectionName);
      const ids = Array.isArray(params.ids)
        ? params.ids.map((id) => toNonEmptyString(id)).filter((id): id is string => Boolean(id))
        : [];
      const where = isRecord(params.where) ? params.where : undefined;

      if (ids.length === 0 && !where) {
        throw new HttpError(
          400,
          "Either ids or where must be provided",
          "VALIDATION_ERROR"
        );
      }

      const collection = await deps.chroma.getOrCreateCollection({
        name: collectionName,
      });
      await collection.delete({
        ids: ids.length > 0 ? ids : undefined,
        where,
      });

      return {
        collectionName,
        deletedIds: ids.length > 0 ? ids : undefined,
        deletedByWhere: Boolean(where),
      };
    },

    async peek(params: {
      collectionName: string;
      limit: number;
    }): Promise<{ items: ChromaPeekItem[] }> {
      const collectionName = resolveCollectionName(params.collectionName);
      const collection = await deps.chroma.getOrCreateCollection({
        name: collectionName,
      });
      const raw = await collection.peek({
        limit: params.limit,
      });
      return {
        items: normalizePeekResult(raw),
      };
    },

    async query(params: {
      collectionName?: string;
      query: string;
      limit: number;
      where?: ChromaWhere;
    }): Promise<{ collectionName: string; hits: ChromaQueryHit[] }> {
      const collectionName = resolveCollectionName(params.collectionName);
      const queryText = toNonEmptyString(params.query);
      if (!queryText) {
        throw new HttpError(400, "query is required", "VALIDATION_ERROR");
      }

      const collection = await deps.chroma.getOrCreateCollection({
        name: collectionName,
      });

      const embeddingRaw = await deps.generateEmbedding({ input: queryText });
      const vectors = extractEmbeddings(embeddingRaw, { expectedCount: 1 });

      const raw = await collection.query({
        queryEmbeddings: vectors,
        nResults: params.limit,
        where: params.where,
        include: ["documents", "metadatas", "distances"],
      });

      return {
        collectionName,
        hits: normalizeQueryResult(raw),
      };
    },

    async reindexWorldInfoFullReplace(params: {
      ownerId?: string;
      collectionName?: string;
    }): Promise<{
      collectionName: string;
      booksProcessed: number;
      entriesSeen: number;
      entriesIndexed: number;
      batches: number;
      durationMs: number;
    }> {
      const startedAt = Date.now();
      const ownerId = resolveTrustedOwnerId(toNonEmptyString(params.ownerId) ?? undefined);
      const collectionName = resolveCollectionName(params.collectionName);
      const books = await deps.listBooksForIndexing({ ownerId });
      const docs: ChromaDocInput[] = [];
      let entriesSeen = 0;

      for (const book of books) {
        const normalizedEntries = normalizeWorldInfoBookEntries({
          ...(isRecord(book.data) ? book.data : {}),
          entries: getBookDataEntries(book),
        });

        for (const entry of Object.values(normalizedEntries)) {
          entriesSeen += 1;
          if (entry.disable) continue;
          const content = toNonEmptyString(entry.content);
          if (!content) continue;

          docs.push({
            id: `wi:${book.id}:${entry.uid}`,
            document: content,
            metadata: {
              source: "world_info",
              ownerId,
              bookId: book.id,
              bookName: book.name,
              entryUid: entry.uid,
              constant: entry.constant,
              vectorized: entry.vectorized,
              keys: entry.key.join(" | "),
            },
          });
        }
      }

      const collection = await createCollectionWithReplace({
        chroma: deps.chroma,
        collectionName,
      });

      let entriesIndexed = 0;
      let batches = 0;
      for (const part of chunk(docs, REINDEX_BATCH_SIZE)) {
        const embeddingsRaw = await deps.generateEmbedding({
          input: part.map((item) => item.document),
        });
        const embeddings = extractEmbeddings(embeddingsRaw, {
          expectedCount: part.length,
        });

        await collection.upsert({
          ids: part.map((item) => item.id),
          documents: part.map((item) => item.document),
          metadatas: part.map((item) => (item.metadata ? item.metadata : {})),
          embeddings,
        });
        entriesIndexed += part.length;
        batches += 1;
      }

      return {
        collectionName,
        booksProcessed: books.length,
        entriesSeen,
        entriesIndexed,
        batches,
        durationMs: Date.now() - startedAt,
      };
    },
  };
}

export const chromaRagService = createChromaRagService();

export async function bootstrapChroma(): Promise<void> {
  try {
    await chromaClient.heartbeat();
  } catch (error) {
    console.warn("Chroma bootstrap warning: backend started without active Chroma", {
      error,
    });
  }
}
