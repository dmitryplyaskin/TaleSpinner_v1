import type { OrchestratorEventHandler, OrchestratorTask, TaskId } from "./types";

export function uniqueStrings(items: readonly string[] | undefined): string[] {
  if (!items || items.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function compareTaskIdsByOrderThenId(
  aTask: OrchestratorTask,
  bTask: OrchestratorTask
): number {
  if (aTask.order !== bTask.order) return aTask.order - bTask.order;
  return aTask.taskId.localeCompare(bTask.taskId);
}

export function compareTaskIdByOrderThenId(
  aId: TaskId,
  bId: TaskId,
  tasksById: ReadonlyMap<TaskId, OrchestratorTask>
): number {
  const aTask = tasksById.get(aId);
  const bTask = tasksById.get(bId);
  if (!aTask || !bTask) return aId.localeCompare(bId);
  return compareTaskIdsByOrderThenId(aTask, bTask);
}

export function popNextRunnableTaskId(
  runnableTaskIds: TaskId[],
  tasksById: ReadonlyMap<TaskId, OrchestratorTask>
): TaskId | undefined {
  if (runnableTaskIds.length === 0) return undefined;

  let bestIndex = 0;
  for (let i = 1; i < runnableTaskIds.length; i++) {
    const cmp = compareTaskIdByOrderThenId(
      runnableTaskIds[i],
      runnableTaskIds[bestIndex],
      tasksById
    );
    if (cmp < 0) bestIndex = i;
  }

  const [best] = runnableTaskIds.splice(bestIndex, 1);
  return best;
}

export function createSafeEventEmitter(
  onEvent?: OrchestratorEventHandler
): OrchestratorEventHandler {
  if (!onEvent) return () => undefined;
  return (event) => {
    try {
      onEvent(event);
    } catch {
      // Observers must not be able to break orchestration.
    }
  };
}

export function toErrorInfo(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    const anyError = error as unknown as { code?: unknown };
    const code = typeof anyError.code === "string" ? anyError.code : undefined;
    return { message: error.message, code };
  }

  if (typeof error === "string") return { message: error };

  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

export function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error) return error.name === "AbortError";
  const maybe = error as { name?: unknown };
  return typeof maybe.name === "string" && maybe.name === "AbortError";
}

export function abortReasonToString(signal: AbortSignal): string | undefined {
  const anySignal = signal as unknown as { reason?: unknown };
  const reason = anySignal.reason;
  if (typeof reason === "string") return reason;
  if (reason instanceof Error) return reason.message;
  if (reason === undefined || reason === null) return undefined;
  return String(reason);
}

