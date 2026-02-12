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
  outlet?: Record<string, string>;
  outletEntries?: Record<string, string[]>;
  anTop?: string[];
  anBottom?: string[];
  emTop?: string[];
  emBottom?: string[];
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
const TRIM_SENTINEL = "__TS_LIQUID_TRIM_SENTINEL__";
const MACRO_TAG_RE = /{{\s*([^{}]*?)\s*}}/g;

function sanitizeOutletKey(value: string): string {
  // Keep keys printable and stable for object lookup.
  return value.trim().replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function clampRngValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 0.999_999_999_999;
  return value;
}

function pickRandomOption(options: string[], rng: () => number): string {
  const idx = Math.floor(clampRngValue(rng()) * options.length);
  return options[idx] ?? options[0] ?? "";
}

function resolveRandomMacro(rawMacroBody: string, rng: () => number): string | null {
  const prefix = "random::";
  if (!rawMacroBody.startsWith(prefix)) return null;
  const tail = rawMacroBody.slice(prefix.length);
  if (!tail) return null;

  const options = tail
    .split("::")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (options.length === 0) return null;

  return pickRandomOption(options, rng);
}

function preprocessSillyTavernTemplateSyntax(
  templateText: string,
  options?: { rng?: () => number }
): {
  text: string;
  hasTrimSentinel: boolean;
} {
  const rng = options?.rng ?? Math.random;
  let hasTrimSentinel = false;
  const text = templateText.replace(MACRO_TAG_RE, (full: string, rawMacroBody: string) => {
    const macroBody = rawMacroBody.trim();
    if (!macroBody) return full;

    if (macroBody === "trim") {
      hasTrimSentinel = true;
      return TRIM_SENTINEL;
    }

    if (macroBody.startsWith("outlet::")) {
      const rawKey = macroBody.slice("outlet::".length);
      if (!rawKey.trim()) return full;
      const key = sanitizeOutletKey(rawKey);
      return `{{ outlet['${key}'] }}`;
    }

    if (macroBody.startsWith("random::")) {
      const selected = resolveRandomMacro(macroBody, rng);
      if (selected !== null) return selected;
      // Keep malformed random macro literal in output.
      return `{% raw %}${full}{% endraw %}`;
    }

    return full;
  });

  return { text, hasTrimSentinel };
}

function isBlankLine(line: string): boolean {
  return line.trim().length === 0;
}

function stripTrimSentinel(text: string): string {
  if (!text.includes(TRIM_SENTINEL)) return text;

  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const out: string[] = [];
  let skipLeadingBlankLines = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === TRIM_SENTINEL) {
      while (out.length > 0 && isBlankLine(out[out.length - 1] ?? "")) out.pop();
      skipLeadingBlankLines = true;
      continue;
    }

    if (line.includes(TRIM_SENTINEL)) {
      const replaced = line.split(TRIM_SENTINEL).join("");
      if (!(skipLeadingBlankLines && isBlankLine(replaced))) {
        out.push(replaced);
      }
      if (!isBlankLine(replaced)) skipLeadingBlankLines = false;
      continue;
    }

    if (skipLeadingBlankLines && isBlankLine(line)) continue;
    out.push(line);
    if (!isBlankLine(line)) skipLeadingBlankLines = false;
  }

  return out.join("\n");
}

function normalizeToString(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}

function mightContainLiquidSyntax(text: string): boolean {
  // Fast heuristic: detect potential Liquid markers.
  return text.includes("{{") || text.includes("{%");
}

export function validateLiquidTemplate(templateText: string): void {
  // Throws on syntax errors. Variables/filters are not strict in v1.
  const preprocessed = preprocessSillyTavernTemplateSyntax(templateText, {
    rng: () => 0,
  });
  engine.parse(preprocessed.text);
}

export async function renderLiquidTemplate(params: {
  templateText: string;
  context: PromptTemplateRenderContext;
  options?: {
    strictVariables?: boolean;
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
    /**
     * Optional RNG used by ST-compatible random macros like `{{random::A::B}}`.
     * Useful for deterministic tests.
     */
    rng?: () => number;
  };
}): Promise<string> {
  const renderEngine = params.options?.strictVariables
    ? new Liquid({ cache: true, strictFilters: false, strictVariables: true })
    : engine;
  const maxPasses = params.options?.maxPasses ?? DEFAULT_MAX_PASSES;
  const maxOutputChars = params.options?.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;
  let sawTrimSentinel = false;

  const firstPassPreprocessed = preprocessSillyTavernTemplateSyntax(params.templateText, {
    rng: params.options?.rng,
  });
  sawTrimSentinel = sawTrimSentinel || firstPassPreprocessed.hasTrimSentinel;

  // Pass 1: render the original template (syntax has typically been validated earlier).
  let current = normalizeToString(
    await renderEngine.parseAndRender(firstPassPreprocessed.text, params.context)
  );

  // Additional passes: render again only if the output still looks like a template.
  // Important: if the output contains `{{` for non-template reasons (e.g. docs/code),
  // the next parse may throw — in that case we stop and return the previous output.
  for (let pass = 2; pass <= maxPasses; pass++) {
    if (!mightContainLiquidSyntax(current)) break;
    if (current.length > maxOutputChars) break;

    try {
      const passPreprocessed = preprocessSillyTavernTemplateSyntax(current, {
        rng: params.options?.rng,
      });
      sawTrimSentinel = sawTrimSentinel || passPreprocessed.hasTrimSentinel;
      const next = normalizeToString(
        await renderEngine.parseAndRender(passPreprocessed.text, params.context)
      );
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }

  if (sawTrimSentinel) {
    return stripTrimSentinel(current);
  }

  return current;
}
