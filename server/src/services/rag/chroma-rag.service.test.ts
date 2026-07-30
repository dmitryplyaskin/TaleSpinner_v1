import { afterEach, describe, expect, test, vi } from "vitest";

import { HttpError } from "../../core/middleware/error-handler";
import { runWithOwnerScope } from "../../core/request-context/owner-scope-storage";

import { chromaClient } from "./chroma-client";
import {
  bootstrapChroma,
  createChromaRagService,
} from "./chroma-rag.service";

afterEach(() => {
  vi.restoreAllMocks();
});

function createCollectionStub() {
  return {
    upsert: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    query: vi.fn(async () => ({
      ids: [["doc-1"]],
      documents: [["dragon lore"]],
      metadatas: [[{ source: "world_info" }]],
      distances: [[0.42]],
    })),
    peek: vi.fn(async () => ({
      ids: ["doc-1"],
      documents: ["dragon lore"],
      metadatas: [{ source: "world_info" }],
    })),
  };
}

describe("chroma-rag.service", () => {
  test("upsertDocuments computes embeddings and writes to collection", async () => {
    const collection = createCollectionStub();
    const service = createChromaRagService({
      chroma: {
        heartbeat: async () => "ok",
        listCollections: async () => [{ name: "world-info" }],
        getOrCreateCollection: async () => collection,
        deleteCollection: async () => undefined,
      },
      generateEmbedding: async () => ({
        embeddings: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
      }),
      listBooksForIndexing: async () => [],
    });

    const result = await service.upsertDocuments({
      collectionName: "world-info",
      items: [
        { id: "1", document: "dragon" },
        { id: "2", document: "phoenix" },
      ],
    });

    expect(result).toEqual({
      collectionName: "world-info",
      upserted: 2,
    });
    expect(collection.upsert).toHaveBeenCalledWith({
      ids: ["1", "2"],
      documents: ["dragon", "phoenix"],
      metadatas: [{}, {}],
      embeddings: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
    });
  });

  test("query returns normalized hits", async () => {
    const collection = createCollectionStub();
    const service = createChromaRagService({
      chroma: {
        heartbeat: async () => "ok",
        listCollections: async () => [{ name: "world-info" }],
        getOrCreateCollection: async () => collection,
        deleteCollection: async () => undefined,
      },
      generateEmbedding: async () => ({
        data: [{ embedding: [1, 2, 3] }],
      }),
      listBooksForIndexing: async () => [],
    });

    const result = await service.query({
      collectionName: "world-info",
      query: "dragon",
      limit: 5,
    });

    expect(result.collectionName).toBe("world-info");
    expect(result.hits).toEqual([
      {
        id: "doc-1",
        document: "dragon lore",
        metadata: { source: "world_info" },
        distance: 0.42,
      },
    ]);
  });

  test("deleteDocuments supports ids and where", async () => {
    const collection = createCollectionStub();
    const service = createChromaRagService({
      chroma: {
        heartbeat: async () => "ok",
        listCollections: async () => [{ name: "world-info" }],
        getOrCreateCollection: async () => collection,
        deleteCollection: async () => undefined,
      },
      generateEmbedding: async () => ({ embeddings: [[1]] }),
      listBooksForIndexing: async () => [],
    });

    const byIds = await service.deleteDocuments({
      collectionName: "world-info",
      ids: ["a", "b"],
    });
    expect(byIds.deletedIds).toEqual(["a", "b"]);
    expect(byIds.deletedByWhere).toBe(false);

    const byWhere = await service.deleteDocuments({
      collectionName: "world-info",
      where: { source: "world_info" },
    });
    expect(byWhere.deletedIds).toBeUndefined();
    expect(byWhere.deletedByWhere).toBe(true);
  });

  test("namespaces collections and only lists the active owner's names", async () => {
    const ownerId = "11111111-1111-4111-8111-111111111111";
    const otherOwnerId = "22222222-2222-4222-8222-222222222222";
    const collection = createCollectionStub();
    const getOrCreateCollection = vi.fn(async () => collection);
    const deleteCollection = vi.fn(async () => undefined);
    const service = createChromaRagService({
      chroma: {
        heartbeat: async () => "ok",
        listCollections: async () => [
          { name: "world-info" },
          { name: `${ownerId}__world-info` },
          { name: `${otherOwnerId}__world-info` },
        ],
        getOrCreateCollection,
        deleteCollection,
      },
      generateEmbedding: async () => ({ embeddings: [[1]] }),
      listBooksForIndexing: async () => [],
    });

    await runWithOwnerScope(ownerId, async () => {
      await expect(service.listCollections()).resolves.toEqual([
        { name: "world-info" },
      ]);
      await service.createCollection({ name: "notes" });
      await service.deleteCollection("notes");
    });

    expect(getOrCreateCollection).toHaveBeenCalledWith({
      name: `${ownerId}__notes`,
      metadata: {},
    });
    expect(deleteCollection).toHaveBeenCalledWith(`${ownerId}__notes`);
  });

  test("propagates mapped chroma errors", async () => {
    const service = createChromaRagService({
      chroma: {
        heartbeat: async () => "ok",
        listCollections: async () => [],
        getOrCreateCollection: async () => {
          throw new HttpError(503, "unavailable", "CHROMA_UNAVAILABLE");
        },
        deleteCollection: async () => undefined,
      },
      generateEmbedding: async () => ({ embeddings: [[1]] }),
      listBooksForIndexing: async () => [],
    });

    await expect(
      service.upsertDocuments({
        collectionName: "world-info",
        items: [{ id: "1", document: "text" }],
      })
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "CHROMA_UNAVAILABLE",
    });
  });

  test("reindexWorldInfoFullReplace filters disabled/empty and uses deterministic ids", async () => {
    const collection = createCollectionStub();
    const listCollections = vi.fn(async () => [{ name: "world-info" }]);
    const deleteCollection = vi.fn(async () => undefined);
    const getOrCreateCollection = vi.fn(async () => collection);

    const service = createChromaRagService({
      chroma: {
        heartbeat: async () => "ok",
        listCollections,
        getOrCreateCollection,
        deleteCollection,
      },
      generateEmbedding: async () => ({ embeddings: [[0.11, 0.22]] }),
      listBooksForIndexing: async () => [
        {
          id: "book-1",
          ownerId: "global",
          slug: "book-1",
          name: "Book 1",
          description: null,
          data: {
            entries: {
              first: {
                uid: 1,
                content: "dragon lore",
                disable: false,
                key: ["dragon"],
                constant: true,
                vectorized: false,
              },
              second: {
                uid: 2,
                content: "   ",
                disable: false,
              },
              third: {
                uid: 3,
                content: "should be skipped",
                disable: true,
              },
            },
          },
          extensions: null,
          source: "native",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
    });

    const report = await service.reindexWorldInfoFullReplace({
      ownerId: "global",
      collectionName: "world-info",
    });

    expect(listCollections).toHaveBeenCalledTimes(1);
    expect(deleteCollection).toHaveBeenCalledWith("world-info");
    expect(getOrCreateCollection).toHaveBeenCalledWith({ name: "world-info" });
    expect(collection.upsert).toHaveBeenCalledTimes(1);
    expect(collection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        ids: ["wi:book-1:1"],
        documents: ["dragon lore"],
      })
    );
    expect(report.collectionName).toBe("world-info");
    expect(report.booksProcessed).toBe(1);
    expect(report.entriesSeen).toBe(3);
    expect(report.entriesIndexed).toBe(1);
    expect(report.batches).toBe(1);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("bootstrapChroma soft-fails when heartbeat throws", async () => {
    const heartbeatSpy = vi
      .spyOn(chromaClient, "heartbeat")
      .mockRejectedValueOnce(new Error("down"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(bootstrapChroma()).resolves.toBeUndefined();
    expect(heartbeatSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });
});
