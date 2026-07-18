import { describe, expect, test } from "vitest";

import { RunArtifactStore } from "./run-artifact-store";

describe("RunArtifactStore", () => {
  test("rejects artifact values larger than 256 KiB", () => {
    const store = new RunArtifactStore();

    expect(() =>
      store.upsert({
        artifactId: "oversized",
        format: "text",
        semantics: "intermediate",
        writeMode: "replace",
        history: { enabled: true, maxItems: 20 },
        value: "x".repeat(256 * 1024 + 1),
      })
    ).toThrow(/artifact value exceeds/i);
  });

  test("rejects runtime history limits above 100 items", () => {
    const store = new RunArtifactStore();
    expect(() =>
      store.upsert({
        artifactId: "history",
        format: "text",
        semantics: "intermediate",
        writeMode: "replace",
        history: { enabled: true, maxItems: 101 },
        value: "ok",
      })
    ).toThrow(/history maxItems/i);
  });

  test("returns null for unknown tag", () => {
    const store = new RunArtifactStore();
    expect(store.get("missing")).toBeNull();
  });

  test("creates run_only artifact on first upsert", () => {
    const store = new RunArtifactStore();

    const artifact = store.upsert({
      artifactId: "world_state",
      format: "markdown",
      semantics: "intermediate",
      writeMode: "replace",
      history: { enabled: true, maxItems: 20 },
      value: "v1",
    });

    expect(artifact).toEqual({
      format: "markdown",
      semantics: "intermediate",
      persistence: "run_only",
      writeMode: "replace",
      value: "v1",
      history: ["v1"],
    });
    expect(store.get("world_state")).toEqual(artifact);
  });

  test("updates value and appends history on repeated upsert", () => {
    const store = new RunArtifactStore();

    store.upsert({
      artifactId: "memory",
      format: "markdown",
      semantics: "intermediate",
      writeMode: "replace",
      history: { enabled: true, maxItems: 20 },
      value: "first",
    });
    const second = store.upsert({
      artifactId: "memory",
      format: "json",
      semantics: "state",
      writeMode: "append",
      history: { enabled: true, maxItems: 20 },
      value: "second",
    });

    expect(second).toEqual({
      format: "json",
      semantics: "state",
      persistence: "run_only",
      writeMode: "append",
      value: "second",
      history: ["first", "second"],
    });
  });

  test("snapshot returns record with all tags", () => {
    const store = new RunArtifactStore();
    store.upsert({
      artifactId: "a",
      format: "markdown",
      semantics: "intermediate",
      writeMode: "replace",
      history: { enabled: true, maxItems: 20 },
      value: "1",
    });
    store.upsert({
      artifactId: "b",
      format: "text",
      semantics: "log/feed",
      writeMode: "append",
      history: { enabled: true, maxItems: 20 },
      value: "2",
    });

    expect(store.snapshot()).toEqual({
      a: {
        format: "markdown",
        semantics: "intermediate",
        persistence: "run_only",
        writeMode: "replace",
        value: "1",
        history: ["1"],
      },
      b: {
        format: "text",
        semantics: "log/feed",
        persistence: "run_only",
        writeMode: "append",
        value: "2",
        history: ["2"],
      },
    });
  });
});
