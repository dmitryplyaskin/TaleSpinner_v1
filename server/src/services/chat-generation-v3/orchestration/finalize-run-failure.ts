import { structuredLogger } from "@core/logging/structured-logger";

import { defaultGenerationPersistencePort } from "../persist/generation-persistence-port";

import { buildRunResult, markRunPhase } from "./run-state-helpers";

import type { RunContext, RunRequest, RunResult, RunState } from "../contracts";

export async function finalizeRunFailure(params: {
  requestId: RunRequest["requestId"];
  context: RunContext;
  runState: RunState;
  errorMessage: string;
  aborted: boolean;
  prepareStartedAt: number;
}): Promise<RunResult> {
  params.runState.finishedStatus = params.aborted ? "aborted" : "error";
  params.runState.errorMessage = params.errorMessage;

  const hasPrepareReport = params.runState.phaseReports.some(
    (report) => report.phase === "prepare_run_context"
  );
  if (!hasPrepareReport) {
    markRunPhase(
      params.runState,
      "prepare_run_context",
      params.aborted ? "aborted" : "failed",
      params.prepareStartedAt,
      params.errorMessage
    );
  }

  const result = buildRunResult({
    context: params.context,
    runState: params.runState,
  });
  await defaultGenerationPersistencePort.finalize({
    context: params.context,
    result,
  });

  structuredLogger.error("generation.finished_with_error", {
    event: "generation.finished_with_error",
    requestId: params.requestId ?? null,
    generationId: params.context.generationId,
    runId: params.context.runId,
    chatId: params.context.chatId,
    branchId: params.context.branchId,
    profileId: params.context.profileSnapshot?.profileId ?? null,
    status: result.status,
    failedType: result.failedType,
    errorMessage: params.errorMessage,
  });

  return result;
}
