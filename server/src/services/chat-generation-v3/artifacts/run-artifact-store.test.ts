import { describe, expect, test } from "vitest";

import { RunArtifactStore } from "./run-artifact-store";

describe("RunArtifactStore", () => {
  test("returns null for unknown tag", () => {
    const store = new RunArtifactStore();
    expect(store.get("missing")).toBeNull();
  });

  test("creates run_only artifact on first upsert", () => {
    const store = new RunArtifactStore();

    const artifact = store.upsert({
      tag: "world_state",
      usage: "internal",
      semantics: "intermediate",
      value: "v1",
    });

    expect(artifact).toEqual({
      usage: "internal",
      semantics: "intermediate",
      persistence: "run_only",
      value: "v1",
      history: ["v1"],
    });
    expect(store.get("world_state")).toEqual(artifact);
  });

  test("updates value and appends history on repeated upsert", () => {
    const store = new RunArtifactStore();

    store.upsert({
      tag: "memory",
      usage: "internal",
      semantics: "intermediate",
      value: "first",
    });
    const second = store.upsert({
      tag: "memory",
      usage: "prompt_only",
      semantics: "state",
      value: "second",
    });

    expect(second).toEqual({
      usage: "prompt_only",
      semantics: "state",
      persistence: "run_only",
      value: "second",
      history: ["first", "second"],
    });
  });

  test("snapshot returns record with all tags", () => {
    const store = new RunArtifactStore();
    store.upsert({
      tag: "a",
      usage: "internal",
      semantics: "intermediate",
      value: "1",
    });
    store.upsert({
      tag: "b",
      usage: "ui_only",
      semantics: "log/feed",
      value: "2",
    });

    expect(store.snapshot()).toEqual({
      a: {
        usage: "internal",
        semantics: "intermediate",
        persistence: "run_only",
        value: "1",
        history: ["1"],
      },
      b: {
        usage: "ui_only",
        semantics: "log/feed",
        persistence: "run_only",
        value: "2",
        history: ["2"],
      },
    });
  });
});
