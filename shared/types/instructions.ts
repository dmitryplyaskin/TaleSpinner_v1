export type InstructionMode = "basic" | "st_advanced";

export type StPromptRole = "system" | "user" | "assistant";

export type StPrompt = {
  identifier: string;
  name?: string;
  role?: StPromptRole;
  content?: string;
  system_prompt?: boolean;
};

export type StPromptOrderEntry = {
  identifier: string;
  enabled: boolean;
};

export type StPromptOrder = {
  character_id: number;
  order: StPromptOrderEntry[];
};

export type StAdvancedResponseConfig = {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  top_a?: number;
  min_p?: number;
  repetition_penalty?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  openai_max_tokens?: number;
  seed?: number;
  n?: number;
  reasoning_effort?: string;
  verbosity?: string;
  enable_web_search?: boolean;
  stream_openai?: boolean;
};

export type StAdvancedImportInfo = {
  source: "sillytavern";
  fileName: string;
  importedAt: string;
};

export type StAdvancedConfig = {
  rawPreset: Record<string, unknown>;
  prompts: StPrompt[];
  promptOrder: StPromptOrder[];
  responseConfig: StAdvancedResponseConfig;
  importInfo: StAdvancedImportInfo;
};

export type TsInstructionMetaV1 = {
  version: 1;
  mode: InstructionMode;
  stAdvanced?: StAdvancedConfig | null;
};

export type InstructionMeta = {
  tsInstruction?: TsInstructionMetaV1;
  [key: string]: unknown;
};
