import { describe, expect, test } from "vitest";

import { applyPromptEffect } from "./prompt-effects";

describe("applyPromptEffect", () => {
  test("applies prompt.system_update prepend/append/replace", () => {
    const base = [
      { role: "system" as const, content: "SYS" },
      { role: "user" as const, content: "U" },
    ];

    const prepended = applyPromptEffect(base, {
      type: "prompt.system_update",
      opId: "op",
      mode: "prepend",
      payload: "P-",
    });
    const appended = applyPromptEffect(base, {
      type: "prompt.system_update",
      opId: "op",
      mode: "append",
      payload: "-A",
    });
    const replaced = applyPromptEffect(base, {
      type: "prompt.system_update",
      opId: "op",
      mode: "replace",
      payload: "R",
    });

    expect(prepended[0]).toEqual({ role: "system", content: "P-SYS" });
    expect(appended[0]).toEqual({ role: "system", content: "SYS-A" });
    expect(replaced[0]).toEqual({ role: "system", content: "R" });
  });

  test("inserts system message when absent for prompt.system_update", () => {
    const out = applyPromptEffect([{ role: "user", content: "hello" }], {
      type: "prompt.system_update",
      opId: "op",
      mode: "replace",
      payload: "SYS",
    });

    expect(out).toEqual([
      { role: "system", content: "SYS" },
      { role: "user", content: "hello" },
    ]);
  });

  test("appends after last user and falls back to tail when user missing", () => {
    const withUser = applyPromptEffect(
      [
        { role: "system", content: "S" },
        { role: "user", content: "U1" },
        { role: "assistant", content: "A" },
        { role: "user", content: "U2" },
      ],
      {
        type: "prompt.append_after_last_user",
        opId: "op",
        role: "developer",
        payload: "DEV",
      }
    );
    const noUser = applyPromptEffect([{ role: "system", content: "S" }], {
      type: "prompt.append_after_last_user",
      opId: "op",
      role: "assistant",
      payload: "TAIL",
    });

    expect(withUser.map((m) => m.content)).toEqual(["S", "U1", "A", "U2", "DEV"]);
    expect(noUser.map((m) => m.content)).toEqual(["S", "TAIL"]);
  });

  test("inserts at bounded depth for prompt.insert_at_depth", () => {
    const base = [
      { role: "system" as const, content: "S" },
      { role: "user" as const, content: "U" },
      { role: "assistant" as const, content: "A" },
    ];

    const tail = applyPromptEffect(base, {
      type: "prompt.insert_at_depth",
      opId: "op",
      role: "developer",
      depthFromEnd: 0,
      payload: "TAIL",
    });
    const beforeTail = applyPromptEffect(base, {
      type: "prompt.insert_at_depth",
      opId: "op",
      role: "developer",
      depthFromEnd: -1,
      payload: "BEFORE_TAIL",
    });
    const clampedHead = applyPromptEffect(base, {
      type: "prompt.insert_at_depth",
      opId: "op",
      role: "developer",
      depthFromEnd: -999,
      payload: "HEAD",
    });

    expect(tail.map((m) => m.content)).toEqual(["S", "U", "A", "TAIL"]);
    expect(beforeTail.map((m) => m.content)).toEqual(["S", "U", "BEFORE_TAIL", "A"]);
    expect(clampedHead.map((m) => m.content)).toEqual(["HEAD", "S", "U", "A"]);
  });

  test("does not mutate input messages array", () => {
    const base = [
      { role: "system" as const, content: "S" },
      { role: "user" as const, content: "U" },
    ];

    const out = applyPromptEffect(base, {
      type: "prompt.append_after_last_user",
      opId: "op",
      role: "developer",
      payload: "X",
    });

    expect(base).toEqual([
      { role: "system", content: "S" },
      { role: "user", content: "U" },
    ]);
    expect(out).not.toBe(base);
  });
});
