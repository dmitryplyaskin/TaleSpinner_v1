import path from "node:path";

import { HttpError } from "@core/middleware/error-handler";

const SAFE_FILENAME_RE = /^[A-Za-z0-9._-]+$/;
const ENCODED_TRAVERSAL_RE = /%(2e|2f|5c)/i;

function decodePathInput(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

export function assertSafeFilenameOrThrow(filename: string): string {
  const raw = String(filename ?? "").trim();
  const decoded = decodePathInput(raw).trim();

  const invalid =
    !raw ||
    !decoded ||
    decoded === "." ||
    decoded === ".." ||
    path.isAbsolute(raw) ||
    path.isAbsolute(decoded) ||
    raw.includes("/") ||
    raw.includes("\\") ||
    decoded.includes("/") ||
    decoded.includes("\\") ||
    decoded.includes("..") ||
    ENCODED_TRAVERSAL_RE.test(raw) ||
    !SAFE_FILENAME_RE.test(decoded);

  if (invalid) {
    throw new HttpError(400, "Invalid filename", "INVALID_FILENAME", {
      filename,
    });
  }

  return decoded;
}

export function resolveSafePath(baseDir: string, filename: string): string {
  const safeFilename = assertSafeFilenameOrThrow(filename);
  const root = path.resolve(baseDir);
  const candidate = path.resolve(root, safeFilename);
  const insideRoot =
    candidate === root || candidate.startsWith(`${root}${path.sep}`);

  if (!insideRoot) {
    throw new HttpError(400, "Invalid filename", "INVALID_FILENAME", {
      filename,
    });
  }

  return candidate;
}
