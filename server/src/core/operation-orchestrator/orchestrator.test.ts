import { expect, test } from "vitest";

import type { OrchestratorEvent, OrchestratorTask } from "./types";
import { runOrchestrator } from "./orchestrator";

test("filters disabled and filtered_out tasks", async () => {
  const calls: string[] = [];

  const tasks: OrchestratorTask[] = [
    {
      taskId: "A",
      enabled: false,
      required: false,
      order: 1,
      run: async () => {
        calls.push("A");
        return "A";
      },
    },
    {
      taskId: "B",
      enabled: true,
      required: false,
      order: 2,
      run: async () => {
        calls.push("B");
        return "B";
      },
    },
    {
      taskId: "C",
      enabled: true,
      required: false,
      order: 3,
      run: async () => {
        calls.push("C");
        return "C";
      },
    },
  ];

  const result = await runOrchestrator(
    {
      runId: "run-1",
      hook: "before_main_llm",
      trigger: "generate",
      executionMode: "sequential",
      tasks,
      filter: { includeTaskIds: ["B"] },
    },
    { now: () => 1000 }
  );

  expect(calls).toEqual(["B"]);

  const byId = new Map(result.tasks.map((t) => [t.taskId, t]));
  expect(byId.get("A")).toEqual({
    taskId: "A",
    status: "skipped",
    finishedAt: 1000,
    reason: "disabled",
  });
  expect(byId.get("C")).toEqual({
    taskId: "C",
    status: "skipped",
    finishedAt: 1000,
    reason: "filtered_out",
  });
  expect(byId.get("B")?.status).toBe("done");
});

test("skips tasks with missing dependencies and blocks dependents", async () => {
  const calls: string[] = [];

  const tasks: OrchestratorTask[] = [
    {
      taskId: "A",
      enabled: true,
      required: false,
      order: 1,
      dependsOn: ["MISSING"],
      run: async () => {
        calls.push("A");
        return "A";
      },
    },
    {
      taskId: "B",
      enabled: true,
      required: false,
      order: 2,
      dependsOn: ["A"],
      run: async () => {
        calls.push("B");
        return "B";
      },
    },
  ];

  const result = await runOrchestrator(
    {
      runId: "run-2",
      hook: "before_main_llm",
      trigger: "generate",
      executionMode: "concurrent",
      tasks,
    },
    { now: () => 2000 }
  );

  expect(calls).toEqual([]);

  const byId = new Map(result.tasks.map((t) => [t.taskId, t]));
  expect(byId.get("A")).toEqual({
    taskId: "A",
    status: "skipped",
    finishedAt: 2000,
    reason: "dependency_missing",
    blockedByTaskIds: ["MISSING"],
  });
  expect(byId.get("B")).toEqual({
    taskId: "B",
    status: "skipped",
    finishedAt: 2000,
    reason: "dependency_not_done",
    blockedByTaskIds: ["A"],
  });
});

test("deterministic start order in concurrent mode (order, then taskId)", async () => {
  const events: OrchestratorEvent[] = [];

  let releaseC: (() => void) | undefined;
  const cGate = new Promise<void>((resolve) => {
    releaseC = resolve;
  });

  const tasks: OrchestratorTask[] = [
    {
      taskId: "B",
      enabled: true,
      required: false,
      order: 1,
      run: async () => "B",
    },
    {
      taskId: "C",
      enabled: true,
      required: false,
      order: 1,
      run: async () => {
        await cGate;
        return "C";
      },
    },
    {
      taskId: "D",
      enabled: true,
      required: false,
      order: 2,
      run: async () => "D",
    },
  ];

  const runPromise = runOrchestrator(
    {
      runId: "run-3",
      hook: "before_main_llm",
      trigger: "generate",
      executionMode: "concurrent",
      concurrency: 2,
      tasks,
    },
    {
      onEvent: (e) => events.push(e),
    }
  );

  await Promise.resolve();
  releaseC?.();
  await runPromise;

  const started = events
    .filter((e) => e.type === "orch.task.started")
    .map((e) => (e.type === "orch.task.started" ? e.data.taskId : ""));

  expect(started).toEqual(["B", "C", "D"]);
});

test("aborted before start skips all plan tasks", async () => {
  const ac = new AbortController();
  ac.abort("user_cancel");

  const tasks: OrchestratorTask[] = [
    {
      taskId: "A",
      enabled: true,
      required: false,
      order: 1,
      run: async () => "A",
    },
    {
      taskId: "B",
      enabled: true,
      required: false,
      order: 2,
      dependsOn: ["A"],
      run: async () => "B",
    },
  ];

  const result = await runOrchestrator(
    {
      runId: "run-4",
      hook: "before_main_llm",
      trigger: "generate",
      executionMode: "sequential",
      tasks,
      signal: ac.signal,
    },
    { now: () => 4000 }
  );

  const byId = new Map(result.tasks.map((t) => [t.taskId, t]));
  expect(byId.get("A")).toEqual({
    taskId: "A",
    status: "skipped",
    finishedAt: 4000,
    reason: "orchestrator_aborted",
  });
  expect(byId.get("B")).toEqual({
    taskId: "B",
    status: "skipped",
    finishedAt: 4000,
    reason: "orchestrator_aborted",
  });
});

