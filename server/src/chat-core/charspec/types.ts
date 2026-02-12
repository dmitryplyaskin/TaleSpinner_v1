export type NormalizedCharSpecSource = {
  spec: string | null;
  spec_version: string | null;
};

/**
 * Normalized CharSpec v3 (project-internal).
 *
 * Notes:
 * - This is intentionally a "best-effort" flattening of SillyTavern V1/V2/V3 into a stable shape.
 * - Keep `name` at top-level because templates expect `{{char.name}}` (knowledge-base/chat-core-spec.md).
 */
export type NormalizedCharSpec = {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;

  alternate_greetings: string[];
  tags: string[];

  system_prompt?: string;
  post_history_instructions?: string;
  creator_notes?: string;
  creator?: string;
  character_version?: string;

  // V2/V3 often carry additional information here; we keep it as-is.
  extensions?: unknown;
  character_book?: unknown;

  source: NormalizedCharSpecSource;
};

