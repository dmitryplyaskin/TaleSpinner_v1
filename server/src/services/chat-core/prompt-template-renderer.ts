import { Liquid } from "liquidjs";

export interface PromptTemplateRenderContext {
  char: unknown;
  user: unknown;
  chat: unknown;
  messages: Array<{ role: string; content: string }>;
  rag: unknown;
  // Persisted pipeline artifacts materialized as `art.<tag>.value/history`.
  // v1: chat-scoped session only.
  art?: Record<string, unknown>;
  now: string;

  // --- SillyTavern-like convenience variables (compat layer).
  // These do not replace `char` / `user` objects; they are additional top-level aliases.
  anchorBefore?: string;
  anchorAfter?: string;
  description?: string;
  scenario?: string;
  personality?: string;
  system?: string;
  persona?: string;
  wiBefore?: string;
  wiAfter?: string;
  loreBefore?: string;
  loreAfter?: string;
  mesExamples?: string;
  mesExamplesRaw?: string;
}

const engine = new Liquid({
  cache: true,
  strictFilters: false,
  strictVariables: false,
});

const DEFAULT_MAX_PASSES = 5;
const DEFAULT_MAX_OUTPUT_CHARS = 200_000;

function normalizeToString(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}

function mightContainLiquidSyntax(text: string): boolean {
  // Fast heuristic: detect potential Liquid markers.
  return text.includes("{{") || text.includes("{%");
}

export function validateLiquidTemplate(templateText: string): void {
  // Throws on syntax errors. Variables/filters are not strict in v1.
  engine.parse(templateText);
}

export async function renderLiquidTemplate(params: {
  templateText: string;
  context: PromptTemplateRenderContext;
  options?: {
    /**
     * Multi-pass rendering enables "templates inside values".
     * Example: if `user.contentTypeDefault` contains `{{ user.name }}` and
     * you output it via `{{ user.contentTypeDefault }}`, additional passes
     * will resolve the nested tags.
     */
    maxPasses?: number;
    /**
     * Safety valve to avoid runaway memory/CPU on huge outputs.
     * If the rendered output exceeds this limit, recursion stops.
     */
    maxOutputChars?: number;
  };
}): Promise<string> {
  const maxPasses = params.options?.maxPasses ?? DEFAULT_MAX_PASSES;
  const maxOutputChars = params.options?.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;

  // Pass 1: render the original template (syntax has typically been validated earlier).
  let current = normalizeToString(
    await engine.parseAndRender(params.templateText, params.context)
  );

  // Additional passes: render again only if the output still looks like a template.
  // Important: if the output contains `{{` for non-template reasons (e.g. docs/code),
  // the next parse may throw — in that case we stop and return the previous output.
  for (let pass = 2; pass <= maxPasses; pass++) {
    if (!mightContainLiquidSyntax(current)) break;
    if (current.length > maxOutputChars) break;

    try {
      const next = normalizeToString(
        await engine.parseAndRender(current, params.context)
      );
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }

  return current;
}
