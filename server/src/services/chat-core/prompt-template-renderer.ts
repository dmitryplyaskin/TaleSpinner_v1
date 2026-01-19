import { Liquid } from "liquidjs";

export interface PromptTemplateRenderContext {
  char: unknown;
  user: unknown;
  chat: unknown;
  messages: Array<{ role: string; content: string }>;
  rag: unknown;
  now: string;
}

const engine = new Liquid({
  cache: true,
  strictFilters: false,
  strictVariables: false,
});

export function validateLiquidTemplate(templateText: string): void {
  // Throws on syntax errors. Variables/filters are not strict in v1.
  engine.parse(templateText);
}

export async function renderLiquidTemplate(params: {
  templateText: string;
  context: PromptTemplateRenderContext;
}): Promise<string> {
  // LiquidJS may return non-string values; normalize to string for system prompt usage.
  const out = await engine.parseAndRender(params.templateText, params.context);
  return typeof out === "string" ? out : String(out);
}
