import { inflateSync } from "node:zlib";

type PngTextChunk = { keyword: string; value: string };

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function getTextChunks(buffer: Buffer): PngTextChunk[] {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Not a PNG file.");
  }

  const chunks: PngTextChunk[] = [];
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
        chunks.push({
          keyword: data.subarray(0, separator).toString("latin1"),
          value: data.subarray(separator + 1).toString("utf8"),
        });
      }
    } else if (type === "zTXt") {
      const separator = data.indexOf(0x00);
      if (separator > 0 && separator + 2 <= data.length && data[separator + 1] === 0) {
        try {
          chunks.push({
            keyword: data.subarray(0, separator).toString("latin1"),
            value: inflateSync(data.subarray(separator + 2)).toString("utf8"),
          });
        } catch {
          // Ignore invalid compressed text chunks.
        }
      }
    } else if (type === "iTXt") {
      const firstNull = data.indexOf(0x00);
      if (firstNull > 0 && firstNull + 5 <= data.length) {
        const keyword = data.subarray(0, firstNull).toString("latin1");
        let cursor = firstNull + 1;
        const compressionFlag = data[cursor];
        cursor += 1;
        const compressionMethod = data[cursor];
        cursor += 1;
        const langEnd = data.indexOf(0x00, cursor);
        if (langEnd >= 0) {
          cursor = langEnd + 1;
          const translatedEnd = data.indexOf(0x00, cursor);
          if (translatedEnd >= 0) {
            const payload = data.subarray(translatedEnd + 1);
            try {
              chunks.push({
                keyword,
                value:
                  compressionFlag === 1 && compressionMethod === 0
                    ? inflateSync(payload).toString("utf8")
                    : payload.toString("utf8"),
              });
            } catch {
              // Ignore invalid international text chunks.
            }
          }
        }
      }
    }

    offset = dataEnd + 4;
  }
  return chunks;
}

function parsePossibleJsonPayload(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  for (const candidate of [trimmed, trimmed.replace(/\s+/g, "")]) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try base64 below.
    }
    try {
      return JSON.parse(Buffer.from(candidate, "base64").toString("utf8")) as unknown;
    } catch {
      // Continue with next candidate.
    }
  }
  return null;
}

/**
 * Extracts embedded character card JSON from a PNG buffer.
 * SillyTavern-style cards use tEXt chunks with keyword "chara" (and sometimes "ccv3"),
 * where the text payload is base64-encoded JSON.
 */
export async function extractCharSpecFromPngBuffer(buffer: Buffer): Promise<unknown> {
  const chunks = getTextChunks(buffer);
  for (const key of ["chara", "ccv3"]) {
    const hit = chunks.find((entry) => entry.keyword.toLowerCase() === key);
    if (!hit) continue;
    const payload = parsePossibleJsonPayload(hit.value);
    if (payload !== null) return payload;
  }

  throw new Error("PNG файл не содержит данных character-карточки (tEXt:chara/ccv3).");
}

