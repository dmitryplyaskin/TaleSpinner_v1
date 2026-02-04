import type {
  OperationExecutionMode,
  OperationHook,
  OperationTrigger,
} from "@shared/types/operation-profiles";

export type TaskId = string;

export type ExecutionMode = OperationExecutionMode;
export type Trigger = OperationTrigger;
export type Hook = OperationHook;

export type TaskStatus = "done" | "error" | "aborted" | "skipped";

export type TaskSkipReason =
  | "disabled"
  | "filtered_out"
  | "dependency_missing"
  | "dependency_not_done"
  | "orchestrator_aborted";

export type OrchestratorTask<TResult = unknown> = {
  taskId: TaskId;
  name?: string;

  // Planning/validation
  enabled: boolean;
  required: boolean;
  order: number;
  dependsOn?: TaskId[];

  // Execution (blackbox)
  run: (ctx: TaskContext) => Promise<TResult>;
};

export type OrchestratorEvent =
  | {
      type: "orch.run.started";
      data: { runId: string; hook: Hook; trigger: Trigger };
    }
  | {
      type: "orch.plan.built";
      data: { runId: string; taskIds: string[] };
    }
  | { type: "orch.task.started"; data: { runId: string; taskId: string } }
  | {
      type: "orch.task.finished";
      data: { runId: string; taskId: string; status: TaskStatus };
    }
  | {
      type: "orch.task.skipped";
      data: { runId: string; taskId: string; reason: TaskSkipReason };
    }
  | {
      type: "orch.task.progress";
      data: { runId: string; taskId: string; payload: unknown };
    }
  | { type: "orch.run.finished"; data: { runId: string } };

export type OrchestratorEventHandler = (event: OrchestratorEvent) => void;

export type TaskContext = {
  runId: string;
  hook: Hook;
  trigger: Trigger;

  signal: AbortSignal;
  state: Record<string, unknown>;

  emit: (event: OrchestratorEvent) => void;
};

export type OrchestratorRunParams = {
  runId: string;
  hook: Hook;
  trigger: Trigger;
  executionMode: ExecutionMode;

  tasks: OrchestratorTask[];

  filter?: {
    includeTaskIds?: string[];
    excludeTaskIds?: string[];
  };

  state?: Record<string, unknown>;
  signal?: AbortSignal;

  concurrency?: number; // default: Infinity (for concurrent mode)
};

export type TaskResult<TResult = unknown> =
  | {
      taskId: string;
      status: "done";
      startedAt: number;
      finishedAt: number;
      result: TResult;
    }
  | {
      taskId: string;
      status: "error";
      startedAt: number;
      finishedAt: number;
      error: { message: string; code?: string };
    }
  | {
      taskId: string;
      status: "aborted";
      startedAt: number;
      finishedAt: number;
      reason?: string;
    }
  | {
      taskId: string;
      status: "skipped";
      startedAt?: number;
      finishedAt: number;
      reason: TaskSkipReason;
      blockedByTaskIds?: string[];
    };

export type OrchestratorRunResult = {
  runId: string;
  hook: Hook;
  trigger: Trigger;
  executionMode: ExecutionMode;
  startedAt: number;
  finishedAt: number;
  tasks: TaskResult[];
};

export type OrchestratorRunOptions = {
  onEvent?: OrchestratorEventHandler;
  now?: () => number;
  classifyAbortError?: (error: unknown, ctx: { signal: AbortSignal }) => boolean;
};

