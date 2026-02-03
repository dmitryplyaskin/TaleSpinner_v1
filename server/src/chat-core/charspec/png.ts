import sharp from "sharp";

type PngTextChunk = { keyword: string; text: string };

function isTextChunk(val: unknown): val is PngTextChunk {
  return (
    typeof val === "object" &&
    val !== null &&
    "keyword" in val &&
    "text" in val &&
    typeof (val as { keyword?: unknown }).keyword === "string" &&
    typeof (val as { text?: unknown }).text === "string"
  );
}

function findEmbeddedCardText(metadata: sharp.Metadata): string | null {
  const comments = metadata.comments;
  if (!Array.isArray(comments)) return null;

  for (const entry of comments) {
    if (!isTextChunk(entry)) continue;
    const keyword = entry.keyword.toLowerCase();
    if (keyword !== "chara" && keyword !== "ccv3") continue;
    if (!entry.text) continue;
    return entry.text;
  }

  return null;
}

/**
 * Extracts embedded character card JSON from a PNG buffer.
 * SillyTavern-style cards use tEXt chunks with keyword "chara" (and sometimes "ccv3"),
 * where the text payload is base64-encoded JSON.
 */
export async function extractCharSpecFromPngBuffer(buffer: Buffer): Promise<unknown> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const payloadBase64 = findEmbeddedCardText(metadata);
  if (!payloadBase64) {
    throw new Error("PNG файл не содержит данных character-карточки (tEXt:chara/ccv3).");
  }

  let decoded: string;
  try {
    decoded = Buffer.from(payloadBase64, "base64").toString("utf-8");
  } catch {
    throw new Error("Не удалось декодировать base64 payload из PNG character-карточки.");
  }

  try {
    return JSON.parse(decoded) as unknown;
  } catch {
    throw new Error("Не удалось распарсить JSON из PNG character-карточки.");
  }
}

