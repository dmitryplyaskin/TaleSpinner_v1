import { OrchestratorError } from "./errors";
import type { OrchestratorPlan } from "./planner";
import type {
  OrchestratorEventHandler,
  OrchestratorRunOptions,
  OrchestratorRunParams,
  OrchestratorTask,
  TaskContext,
  TaskId,
  TaskResult,
} from "./types";
import {
  abortReasonToString,
  createSafeEventEmitter,
  isAbortError,
  popNextRunnableTaskId,
  toErrorInfo,
} from "./utils";

type ExecutePlanArgs = {
  plan: OrchestratorPlan;
  params: OrchestratorRunParams;
  options: Required<Pick<OrchestratorRunOptions, "now">> &
    Pick<OrchestratorRunOptions, "classifyAbortError"> & {
      emit: OrchestratorEventHandler;
    };
  resultsByTaskId: Map<TaskId, TaskResult>;
};

type TaskCompletion =
  | { taskId: TaskId; status: "done"; startedAt: number; finishedAt: number; result: unknown }
  | {
      taskId: TaskId;
      status: "error";
      startedAt: number;
      finishedAt: number;
      error: { message: string; code?: string };
    }
  | {
      taskId: TaskId;
      status: "aborted";
      startedAt: number;
      finishedAt: number;
      reason?: string;
    };

export async function executeOrchestratorPlan(args: ExecutePlanArgs): Promise<void> {
  const now = args.options.now;
  const signal = args.params.signal;

  const executionMode = args.params.executionMode;
  const concurrency =
    executionMode === "sequential"
      ? 1
      : args.params.concurrency === undefined
        ? Number.POSITIVE_INFINITY
        : args.params.concurrency;

  const isValidConcurrency =
    concurrency === Number.POSITIVE_INFINITY ||
    (Number.isFinite(concurrency) && concurrency > 0);

  if (!isValidConcurrency) {
    throw new OrchestratorError("INVALID_CONCURRENCY", "Invalid concurrency", {
      concurrency,
    });
  }

  const planTaskIds = args.plan.planTaskIds;
  const tasksById = args.plan.tasksById;
  const dependenciesByTaskId = args.plan.dependenciesByTaskId;
  const dependentsByTaskId = args.plan.dependentsByTaskId;

  const pendingTaskIds = new Set<TaskId>();
  for (const taskId of planTaskIds) {
    if (args.resultsByTaskId.has(taskId)) continue;
    pendingTaskIds.add(taskId);
  }

  // 1) Propagate initial non-done tasks (e.g. dependency_missing) to their dependents.
  const initialNonDone = planTaskIds.filter((taskId) => {
    const r = args.resultsByTaskId.get(taskId);
    return !!r && r.status !== "done";
  });
  propagateDependencyNotDone({
    nonDoneTaskIds: initialNonDone,
    pendingTaskIds,
    dependentsByTaskId,
    now,
    runId: args.params.runId,
    emit: args.options.emit,
    resultsByTaskId: args.resultsByTaskId,
  });

  // 2) Track remaining deps for pending tasks.
  const remainingDepsByTaskId = new Map<TaskId, number>();
  for (const taskId of pendingTaskIds) {
    remainingDepsByTaskId.set(
      taskId,
      (dependenciesByTaskId.get(taskId) ?? []).length
    );
  }

  const runnableTaskIds: TaskId[] = [];
  for (const taskId of pendingTaskIds) {
    if ((remainingDepsByTaskId.get(taskId) ?? 0) === 0) runnableTaskIds.push(taskId);
  }

  const runningByTaskId = new Map<TaskId, Promise<TaskCompletion>>();

  const state = args.params.state ?? {};
  const emit = createSafeEventEmitter(args.options.emit);
  const classifyAbortError =
    args.options.classifyAbortError ??
    ((error, ctx) => ctx.signal.aborted || isAbortError(error));

  const makeCtx = (): Omit<TaskContext, "signal"> & { signal: AbortSignal } => ({
    runId: args.params.runId,
    hook: args.params.hook,
    trigger: args.params.trigger,
    signal: signal ?? new AbortController().signal,
    state,
    emit,
  });

  while (pendingTaskIds.size > 0 || runningByTaskId.size > 0) {
    if (signal?.aborted) break;

    while (
      runnableTaskIds.length > 0 &&
      runningByTaskId.size < concurrency &&
      !signal?.aborted
    ) {
      const taskId = popNextRunnableTaskId(runnableTaskIds, tasksById);
      if (!taskId) break;
      if (!pendingTaskIds.has(taskId)) continue;

      pendingTaskIds.delete(taskId);
      const task = tasksById.get(taskId);
      if (!task) continue;

      const completionPromise = runTask(task, makeCtx(), now, emit).then((c) => {
        // Ensure orchestration never throws from a task completion path.
        return c;
      });
      runningByTaskId.set(taskId, completionPromise);
    }

    if (runningByTaskId.size === 0) {
      if (pendingTaskIds.size === 0) break;
      throw new OrchestratorError("DEADLOCK", "No runnable tasks but pending remain", {
        pendingTaskIds: Array.from(pendingTaskIds),
      });
    }

    const completed = await Promise.race(Array.from(runningByTaskId.values()));
    runningByTaskId.delete(completed.taskId);

    args.resultsByTaskId.set(completed.taskId, completionToTaskResult(completed));

    if (completed.status === "done") {
      for (const dependentId of dependentsByTaskId.get(completed.taskId) ?? []) {
        if (!pendingTaskIds.has(dependentId)) continue;
        const next = (remainingDepsByTaskId.get(dependentId) ?? 0) - 1;
        remainingDepsByTaskId.set(dependentId, next);
        if (next === 0) runnableTaskIds.push(dependentId);
      }
      continue;
    }

    // Non-done completion blocks dependents.
    propagateDependencyNotDone({
      nonDoneTaskIds: [completed.taskId],
      pendingTaskIds,
      dependentsByTaskId,
      now,
      runId: args.params.runId,
      emit,
      resultsByTaskId: args.resultsByTaskId,
    });
  }

  // 3) If aborted mid-run, remaining pending tasks are skipped.
  if (signal?.aborted) {
    for (const taskId of Array.from(pendingTaskIds)) {
      pendingTaskIds.delete(taskId);
      args.resultsByTaskId.set(taskId, {
        taskId,
        status: "skipped",
        finishedAt: now(),
        reason: "orchestrator_aborted",
      });
      emit({
        type: "orch.task.skipped",
        data: { runId: args.params.runId, taskId, reason: "orchestrator_aborted" },
      });
      emit({
        type: "orch.task.finished",
        data: { runId: args.params.runId, taskId, status: "skipped" },
      });
    }

    // We still need to wait for in-flight tasks to settle (if any).
    const remaining = Array.from(runningByTaskId.values());
    if (remaining.length > 0) {
      const completions = await Promise.all(remaining);
      for (const completion of completions) {
        args.resultsByTaskId.set(completion.taskId, completionToTaskResult(completion));
      }
    }
  }

  // 4) Enrich dependency_not_done with deterministic blockedByTaskIds.
  for (const [taskId, result] of args.resultsByTaskId) {
    if (result.status !== "skipped") continue;
    if (result.reason !== "dependency_not_done") continue;
    if (result.blockedByTaskIds && result.blockedByTaskIds.length > 0) continue;

    const deps = dependenciesByTaskId.get(taskId) ?? [];
    const blockedBy = deps
      .filter((depId) => {
        const depRes = args.resultsByTaskId.get(depId);
        return depRes ? depRes.status !== "done" : true;
      })
      .slice()
      .sort();

    args.resultsByTaskId.set(taskId, { ...result, blockedByTaskIds: blockedBy });
  }

  // Sanity: executor must finalize all plan tasks.
  for (const taskId of planTaskIds) {
    if (!args.resultsByTaskId.has(taskId)) {
      throw new OrchestratorError("DEADLOCK", "Task left without a terminal result", {
        taskId,
      });
    }
  }

  function completionToTaskResult(completion: TaskCompletion): TaskResult {
    if (completion.status === "done") {
      return {
        taskId: completion.taskId,
        status: "done",
        startedAt: completion.startedAt,
        finishedAt: completion.finishedAt,
        result: completion.result,
      };
    }

    if (completion.status === "error") {
      return {
        taskId: completion.taskId,
        status: "error",
        startedAt: completion.startedAt,
        finishedAt: completion.finishedAt,
        error: completion.error,
      };
    }

    return {
      taskId: completion.taskId,
      status: "aborted",
      startedAt: completion.startedAt,
      finishedAt: completion.finishedAt,
      reason: completion.reason,
    };
  }

  async function runTask(
    task: OrchestratorTask,
    ctx: TaskContext,
    nowFn: () => number,
    emitEvent: OrchestratorEventHandler
  ): Promise<TaskCompletion> {
    const startedAt = nowFn();
    emitEvent({
      type: "orch.task.started",
      data: { runId: ctx.runId, taskId: task.taskId },
    });

    try {
      const result = await task.run(ctx);
      const finishedAt = nowFn();
      emitEvent({
        type: "orch.task.finished",
        data: { runId: ctx.runId, taskId: task.taskId, status: "done" },
      });
      return { taskId: task.taskId, status: "done", startedAt, finishedAt, result };
    } catch (error) {
      const finishedAt = nowFn();
      const aborted = classifyAbortError(error, { signal: ctx.signal });

      if (aborted) {
        const reason = abortReasonToString(ctx.signal) ?? toErrorInfo(error).message;
        emitEvent({
          type: "orch.task.finished",
          data: { runId: ctx.runId, taskId: task.taskId, status: "aborted" },
        });
        return { taskId: task.taskId, status: "aborted", startedAt, finishedAt, reason };
      }

      const info = toErrorInfo(error);
      emitEvent({
        type: "orch.task.finished",
        data: { runId: ctx.runId, taskId: task.taskId, status: "error" },
      });
      return {
        taskId: task.taskId,
        status: "error",
        startedAt,
        finishedAt,
        error: info,
      };
    }
  }
}

function propagateDependencyNotDone(args: {
  nonDoneTaskIds: TaskId[];
  pendingTaskIds: Set<TaskId>;
  dependentsByTaskId: ReadonlyMap<TaskId, readonly TaskId[]>;
  now: () => number;
  runId: string;
  emit: OrchestratorEventHandler;
  resultsByTaskId: Map<TaskId, TaskResult>;
}): void {
  const queue = [...args.nonDoneTaskIds];
  const now = args.now;

  while (queue.length > 0) {
    const notDoneId = queue.shift();
    if (!notDoneId) continue;

    for (const dependentId of args.dependentsByTaskId.get(notDoneId) ?? []) {
      if (!args.pendingTaskIds.has(dependentId)) continue;

      args.pendingTaskIds.delete(dependentId);
      args.resultsByTaskId.set(dependentId, {
        taskId: dependentId,
        status: "skipped",
        finishedAt: now(),
        reason: "dependency_not_done",
      });

      args.emit({
        type: "orch.task.skipped",
        data: { runId: args.runId, taskId: dependentId, reason: "dependency_not_done" },
      });
      args.emit({
        type: "orch.task.finished",
        data: { runId: args.runId, taskId: dependentId, status: "skipped" },
      });

      queue.push(dependentId);
    }
  }
}
