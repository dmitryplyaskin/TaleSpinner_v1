import { OrchestratorError } from "./errors";
import type {
  OrchestratorRunParams,
  OrchestratorTask,
  TaskId,
  TaskResult,
} from "./types";
import {
  compareTaskIdsByOrderThenId,
  compareTaskIdByOrderThenId,
  uniqueStrings,
} from "./utils";

export type OrchestratorPlan = {
  planTaskIds: TaskId[];
  tasksById: ReadonlyMap<TaskId, OrchestratorTask>;
  dependenciesByTaskId: ReadonlyMap<TaskId, readonly TaskId[]>;
  dependentsByTaskId: ReadonlyMap<TaskId, readonly TaskId[]>;
};

export type OrchestratorPlanningResult = {
  plan: OrchestratorPlan;
  skippedByTaskId: ReadonlyMap<TaskId, TaskResult>;
};

export type BuildOrchestratorPlanOptions = {
  now: () => number;
};

export function buildOrchestratorPlan(
  params: OrchestratorRunParams,
  options: BuildOrchestratorPlanOptions
): OrchestratorPlanningResult {
  const now = options.now;

  // Validate uniqueness early: otherwise maps/graphs become ambiguous.
  const seenIds = new Set<string>();
  for (const task of params.tasks) {
    if (seenIds.has(task.taskId)) {
      throw new OrchestratorError(
        "DUPLICATE_TASK_ID",
        `Duplicate taskId: "${task.taskId}"`,
        { taskId: task.taskId }
      );
    }
    seenIds.add(task.taskId);

    if (!Number.isFinite(task.order)) {
      throw new OrchestratorError(
        "INVALID_TASK_ORDER",
        `Invalid task.order for taskId "${task.taskId}"`,
        { taskId: task.taskId, order: task.order }
      );
    }
  }

  const include = new Set<string>(params.filter?.includeTaskIds ?? []);
  const hasInclude = include.size > 0;
  const exclude = new Set<string>(params.filter?.excludeTaskIds ?? []);

  const skippedByTaskId = new Map<TaskId, TaskResult>();
  const planTasks: OrchestratorTask[] = [];

  for (const task of params.tasks) {
    if (!task.enabled) {
      skippedByTaskId.set(task.taskId, {
        taskId: task.taskId,
        status: "skipped",
        finishedAt: now(),
        reason: "disabled",
      });
      continue;
    }

    if (hasInclude && !include.has(task.taskId)) {
      skippedByTaskId.set(task.taskId, {
        taskId: task.taskId,
        status: "skipped",
        finishedAt: now(),
        reason: "filtered_out",
      });
      continue;
    }

    if (exclude.has(task.taskId)) {
      skippedByTaskId.set(task.taskId, {
        taskId: task.taskId,
        status: "skipped",
        finishedAt: now(),
        reason: "filtered_out",
      });
      continue;
    }

    planTasks.push(task);
  }

  // Sort plan tasks deterministically for plan output and stable iteration.
  planTasks.sort(compareTaskIdsByOrderThenId);

  const tasksById = new Map<TaskId, OrchestratorTask>();
  for (const task of planTasks) tasksById.set(task.taskId, task);

  const dependenciesByTaskId = new Map<TaskId, readonly TaskId[]>();
  const dependentsByTaskId = new Map<TaskId, TaskId[]>();

  for (const task of planTasks) dependentsByTaskId.set(task.taskId, []);

  // Normalize deps and apply dependency_missing policy.
  for (const task of planTasks) {
    const normalized = uniqueStrings(task.dependsOn);
    const presentDeps: TaskId[] = [];
    const missingDeps: TaskId[] = [];

    for (const depId of normalized) {
      if (tasksById.has(depId)) presentDeps.push(depId);
      else missingDeps.push(depId);
    }

    dependenciesByTaskId.set(task.taskId, presentDeps);

    if (missingDeps.length > 0) {
      missingDeps.sort();
      skippedByTaskId.set(task.taskId, {
        taskId: task.taskId,
        status: "skipped",
        finishedAt: now(),
        reason: "dependency_missing",
        blockedByTaskIds: missingDeps,
      });
    }

    for (const depId of presentDeps) {
      dependentsByTaskId.get(depId)?.push(task.taskId);
    }
  }

  // Deterministic iteration order for dependents.
  for (const [depId, dependents] of dependentsByTaskId) {
    dependents.sort((a, b) => compareTaskIdByOrderThenId(a, b, tasksById));
    dependentsByTaskId.set(depId, dependents);
  }

  // Cycle detection on the normalized graph (present deps only).
  assertAcyclic({ planTaskIds: planTasks.map((t) => t.taskId), dependenciesByTaskId });

  return {
    plan: {
      planTaskIds: planTasks.map((t) => t.taskId),
      tasksById,
      dependenciesByTaskId,
      dependentsByTaskId,
    },
    skippedByTaskId,
  };
}

function assertAcyclic(args: {
  planTaskIds: TaskId[];
  dependenciesByTaskId: ReadonlyMap<TaskId, readonly TaskId[]>;
}): void {
  const indegree = new Map<TaskId, number>();
  const dependentsByTaskId = new Map<TaskId, TaskId[]>();

  for (const id of args.planTaskIds) {
    indegree.set(id, 0);
    dependentsByTaskId.set(id, []);
  }

  for (const id of args.planTaskIds) {
    const deps = args.dependenciesByTaskId.get(id) ?? [];
    indegree.set(id, deps.length);
    for (const depId of deps) {
      dependentsByTaskId.get(depId)?.push(id);
    }
  }

  const queue = args.planTaskIds.filter((id) => (indegree.get(id) ?? 0) === 0);
  const visited: TaskId[] = [];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    visited.push(id);

    for (const dep of dependentsByTaskId.get(id) ?? []) {
      const next = (indegree.get(dep) ?? 0) - 1;
      indegree.set(dep, next);
      if (next === 0) queue.push(dep);
    }
  }

  if (visited.length === args.planTaskIds.length) return;

  const remaining = args.planTaskIds.filter((id) => (indegree.get(id) ?? 0) > 0);
  remaining.sort();

  throw new OrchestratorError("CYCLE_DETECTED", "Cycle detected in DAG", {
    taskIds: remaining,
  });
}
