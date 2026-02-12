import { describe, expect, test } from "vitest";

import { isAllowedFileType } from "./routes";

describe("files upload type validation", () => {
  test("accepts known extension and mime", () => {
    expect(
      isAllowedFileType({
        originalName: "image.png",
        mimeType: "image/png",
      })
    ).toBe(true);

    expect(
      isAllowedFileType({
        originalName: "card.json",
        mimeType: "application/json; charset=utf-8",
      })
    ).toBe(true);
  });

  test("rejects mime mismatch", () => {
    expect(
      isAllowedFileType({
        originalName: "image.png",
        mimeType: "application/json",
      })
    ).toBe(false);
  });

  test("rejects unknown extension", () => {
    expect(
      isAllowedFileType({
        originalName: "payload.exe",
        mimeType: "application/octet-stream",
      })
    ).toBe(false);
  });
});
