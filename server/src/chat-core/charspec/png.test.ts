import { describe, expect, test } from "vitest";

import { extractCharSpecFromPngBuffer } from "./png";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function makeChunk(type: string, data: Buffer): Buffer {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 4, "ascii");
  data.copy(chunk, 8);
  return chunk;
}

function makeTextPng(keyword: string, value: string): Buffer {
  return Buffer.concat([
    PNG_SIGNATURE,
    makeChunk("tEXt", Buffer.concat([Buffer.from(keyword, "latin1"), Buffer.from([0]), Buffer.from(value, "utf8")])),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("extractCharSpecFromPngBuffer", () => {
  test("extracts SillyTavern chara tEXt payload", async () => {
    const card = { spec: "chara_card_v2", data: { name: "Alice" }, name: "Alice" };
    const png = makeTextPng("chara", Buffer.from(JSON.stringify(card), "utf8").toString("base64"));

    await expect(extractCharSpecFromPngBuffer(png)).resolves.toEqual(card);
  });
});
