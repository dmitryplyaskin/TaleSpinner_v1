import type { PipelineStepType } from "./pipeline-execution";

export type PipelineProfileSpecVersion = 1;

export type PipelineProfileSpecV1 = {
  spec_version: PipelineProfileSpecVersion;
  pipelines: PipelineDefinitionV1[];
};

export type PipelineDefinitionV1 = {
  id: string;
  name: string;
  enabled: boolean;
  steps: PipelineStepDefinitionV1[];
};

export type PipelineStepDefinitionV1 = {
  id: string;
  stepName: string;
  stepType: PipelineStepType;
  enabled: boolean;
  /**
   * v1: step-specific configuration.
   * This is intentionally opaque for now; UI can store draft fields here until Phase 2–4 execution is implemented.
   */
  params: Record<string, unknown>;
};

