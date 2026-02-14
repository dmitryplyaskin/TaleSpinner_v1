import path from "node:path";

import { describe, expect, test } from "vitest";

import { HttpError } from "@core/middleware/error-handler";

import { assertSafeFilenameOrThrow, resolveSafePath } from "./safe-path";

describe("safe path helpers", () => {
  test("accepts valid filename", () => {
    expect(assertSafeFilenameOrThrow("abc-123_file.png")).toBe("abc-123_file.png");
  });

  test("rejects traversal segments", () => {
    expect(() => assertSafeFilenameOrThrow("../a.txt")).toThrowError(
      expect.objectContaining({ code: "INVALID_FILENAME" })
    );
    expect(() => assertSafeFilenameOrThrow("%2e%2e%2fsecrets")).toThrowError(
      expect.objectContaining({ code: "INVALID_FILENAME" })
    );
  });

  test("rejects slashes and absolute paths", () => {
    expect(() => assertSafeFilenameOrThrow("folder/file.txt")).toThrow(HttpError);
    expect(() => assertSafeFilenameOrThrow("folder\\file.txt")).toThrow(HttpError);
    expect(() => assertSafeFilenameOrThrow("C:\\temp\\a.txt")).toThrow(HttpError);
  });

  test("resolveSafePath keeps path inside base dir", () => {
    const base = path.resolve(path.sep, "safe", "root");
    const resolved = resolveSafePath(base, "hello.txt");
    expect(resolved).toBe(path.resolve(base, "hello.txt"));
  });
});
