import type { OrchestratorPlan, OrchestratorPlanningResult } from "./planner";
import { buildOrchestratorPlan } from "./planner";
import { executeOrchestratorPlan } from "./executor";
import type {
  OrchestratorEvent,
  OrchestratorRunOptions,
  OrchestratorRunParams,
  OrchestratorRunResult,
  TaskId,
  TaskResult,
} from "./types";
import { compareTaskIdsByOrderThenId, createSafeEventEmitter } from "./utils";

export async function runOrchestrator(
  params: OrchestratorRunParams,
  options: OrchestratorRunOptions = {}
): Promise<OrchestratorRunResult> {
  const now = options.now ?? Date.now;
  const emit = createSafeEventEmitter(options.onEvent);

  const startedAt = now();
  emit({
    type: "orch.run.started",
    data: { runId: params.runId, hook: params.hook, trigger: params.trigger },
  });

  const planning = buildOrchestratorPlan(params, { now });
  emit({
    type: "orch.plan.built",
    data: { runId: params.runId, taskIds: planning.plan.planTaskIds },
  });

  const resultsByTaskId = new Map<TaskId, TaskResult>();
  for (const [taskId, result] of planning.skippedByTaskId) {
    resultsByTaskId.set(taskId, result);
  }

  if (params.signal?.aborted) {
    finalizeAbortedBeforeStart({
      planning,
      now,
      resultsByTaskId,
      runId: params.runId,
      emit,
    });
  } else {
    emitPlanningSkips({ planning, runId: params.runId, emit });
    await executeOrchestratorPlan({
      plan: planning.plan,
      params,
      options: { now, emit, classifyAbortError: options.classifyAbortError },
      resultsByTaskId,
    });
  }

  // Ensure every input task has a terminal result (planner should cover non-plan tasks).
  for (const task of params.tasks) {
    if (resultsByTaskId.has(task.taskId)) continue;
    resultsByTaskId.set(task.taskId, {
      taskId: task.taskId,
      status: "skipped",
      finishedAt: now(),
      reason: "filtered_out",
    });
  }

  const orderedTasks = params.tasks.slice().sort(compareTaskIdsByOrderThenId);
  const tasks: TaskResult[] = orderedTasks.map((t) => {
    const result = resultsByTaskId.get(t.taskId);
    if (!result) {
      return {
        taskId: t.taskId,
        status: "skipped",
        finishedAt: now(),
        reason: "filtered_out",
      };
    }
    return result;
  });

  const finishedAt = now();
  emit({ type: "orch.run.finished", data: { runId: params.runId } });

  return {
    runId: params.runId,
    hook: params.hook,
    trigger: params.trigger,
    executionMode: params.executionMode,
    startedAt,
    finishedAt,
    tasks,
  };
}

function emitPlanningSkips(args: {
  planning: OrchestratorPlanningResult;
  runId: string;
  emit: (event: OrchestratorEvent) => void;
}): void {
  for (const [taskId, result] of args.planning.skippedByTaskId) {
    if (result.status !== "skipped") continue;
    args.emit({
      type: "orch.task.skipped",
      data: { runId: args.runId, taskId, reason: result.reason },
    });
    args.emit({
      type: "orch.task.finished",
      data: { runId: args.runId, taskId, status: "skipped" },
    });
  }
}

function finalizeAbortedBeforeStart(args: {
  planning: { plan: OrchestratorPlan; skippedByTaskId: ReadonlyMap<TaskId, TaskResult> };
  now: () => number;
  runId: string;
  emit: (event: OrchestratorEvent) => void;
  resultsByTaskId: Map<TaskId, TaskResult>;
}): void {
  // Emit non-plan skips first (disabled/filtered_out).
  for (const [taskId, result] of args.planning.skippedByTaskId) {
    if (args.planning.plan.tasksById.has(taskId)) continue;
    if (result.status !== "skipped") continue;
    args.emit({
      type: "orch.task.skipped",
      data: { runId: args.runId, taskId, reason: result.reason },
    });
    args.emit({
      type: "orch.task.finished",
      data: { runId: args.runId, taskId, status: "skipped" },
    });
  }

  const finishedAt = args.now();
  for (const taskId of args.planning.plan.planTaskIds) {
    args.resultsByTaskId.set(taskId, {
      taskId,
      status: "skipped",
      finishedAt,
      reason: "orchestrator_aborted",
    });

    args.emit({
      type: "orch.task.skipped",
      data: { runId: args.runId, taskId, reason: "orchestrator_aborted" },
    });
    args.emit({
      type: "orch.task.finished",
      data: { runId: args.runId, taskId, status: "skipped" },
    });
  }
}
