import {
  finishGeneration,
  updateGenerationRunReports,
} from "../../chat-core/generations-repository";

import type { RunContext, RunResult } from "../contracts";

export async function finalizeRun(params: {
  context: RunContext;
  result: RunResult;
}): Promise<void> {
  await updateGenerationRunReports({
    id: params.context.generationId,
    phaseReport: params.result.phaseReports,
    commitReport: params.result.commitReportsByHook,
  });

  await finishGeneration({
    id: params.context.generationId,
    status:
      params.result.status === "done"
        ? "done"
        : params.result.status === "aborted"
          ? "aborted"
          : "error",
    error: params.result.errorMessage,
  });
}
