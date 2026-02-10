import { DEFAULT_UI_THEME_PAYLOAD, type UiThemePresetPayload } from "@shared/types/ui-theme";

const TOKEN_STYLE_ID = "ts-ui-theme-runtime-tokens";
const CUSTOM_STYLE_ID = "ts-ui-theme-runtime-custom";
let lastTokenStyleText = "";
let lastCustomStyleText = "";

function upsertStyleTag(id: string): HTMLStyleElement {
  const existing = document.getElementById(id);
  if (existing && existing.tagName.toLowerCase() === "style") return existing as HTMLStyleElement;

  const style = document.createElement("style");
  style.id = id;
  document.head.appendChild(style);
  return style;
}

function removeStyleTag(id: string): void {
  const node = document.getElementById(id);
  if (node) node.remove();
}

function toVarLines(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");
}

function sanitizeCssUnsafeContent(css: string): string {
  const trimmed = css.trim();
  if (!trimmed) return "";
  return trimmed;
}

function scopeCustomCss(css: string): string {
  const trimmed = sanitizeCssUnsafeContent(css);
  if (!trimmed) return "";
  return `@scope (.ts-app-shell) {\n${trimmed}\n}`;
}

export function applyUiThemeRuntime(payload?: UiThemePresetPayload | null): void {
  if (typeof document === "undefined") return;

  const resolved = payload ?? DEFAULT_UI_THEME_PAYLOAD;
  const tokenStyleText = [
    ":root {",
    `  --ts-font-ui: ${resolved.typography.uiFontFamily};`,
    `  --ts-font-chat: ${resolved.typography.chatFontFamily};`,
    `  --ts-font-size-ui: ${resolved.typography.uiBaseFontSize};`,
    `  --ts-font-size-chat: ${resolved.typography.chatBaseFontSize};`,
    `  --ts-md-font-size: ${resolved.markdown.fontSize};`,
    `  --ts-md-line-height: ${resolved.markdown.lineHeight};`,
    `  --ts-md-code-font-size: ${resolved.markdown.codeFontSize};`,
    `  --ts-md-code-padding: ${resolved.markdown.codePadding};`,
    `  --ts-md-quote-border-width: ${resolved.markdown.quoteBorderWidth};`,
    toVarLines(resolved.lightTokens),
    "}",
    "[data-mantine-color-scheme='dark'] {",
    toVarLines(resolved.darkTokens),
    "}",
  ].join("\n");
  if (tokenStyleText !== lastTokenStyleText) {
    const tokenStyle = upsertStyleTag(TOKEN_STYLE_ID);
    tokenStyle.textContent = tokenStyleText;
    lastTokenStyleText = tokenStyleText;
  }

  const scopedCss = scopeCustomCss(resolved.customCss);
  if (!scopedCss) {
    removeStyleTag(CUSTOM_STYLE_ID);
    lastCustomStyleText = "";
    return;
  }

  if (scopedCss === lastCustomStyleText) return;
  const customStyle = upsertStyleTag(CUSTOM_STYLE_ID);
  customStyle.textContent = scopedCss;
  lastCustomStyleText = scopedCss;
}
