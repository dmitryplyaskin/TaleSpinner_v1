export type UiThemeColorScheme = "light" | "dark" | "auto";

export type UiThemeTokenMap = Record<string, string>;

export interface UiThemeTypography {
  uiFontFamily: string;
  chatFontFamily: string;
  uiBaseFontSize: string;
  chatBaseFontSize: string;
  radiusXs: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
}

export interface UiThemeMarkdown {
  fontSize: string;
  lineHeight: string;
  codeFontSize: string;
  codePadding: string;
  quoteBorderWidth: string;
}

export interface UiThemePresetPayload {
  lightTokens: UiThemeTokenMap;
  darkTokens: UiThemeTokenMap;
  typography: UiThemeTypography;
  markdown: UiThemeMarkdown;
  customCss: string;
}

export interface UiThemePreset {
  presetId: string;
  ownerId: string;
  name: string;
  description?: string;
  builtIn: boolean;
  version: number;
  payload: UiThemePresetPayload;
  createdAt: Date;
  updatedAt: Date;
}

export interface UiThemeSettings {
  ownerId: string;
  activePresetId: string | null;
  colorScheme: UiThemeColorScheme;
  updatedAt: Date;
}

export interface UiThemeExportPreset {
  name: string;
  description?: string;
  payload: UiThemePresetPayload;
}

export interface UiThemeExportV1 {
  type: "talespinner.uiThemePreset";
  version: 1;
  preset: UiThemeExportPreset;
}

export const UI_THEME_EXPORT_TYPE = "talespinner.uiThemePreset";
export const UI_THEME_EXPORT_VERSION = 1 as const;

export const UI_THEME_BUILT_IN_IDS = {
  default: "builtin-default-light-dark",
  highContrast: "builtin-high-contrast",
  softNight: "builtin-soft-night",
} as const;

const LIGHT_TOKENS_BASE: UiThemeTokenMap = {
  "--ts-surface": "#f2f5f7",
  "--ts-surface-elevated": "rgba(255, 255, 255, 0.86)",
  "--ts-border-soft": "rgba(16, 36, 48, 0.14)",
  "--ts-accent": "#0f8fa8",
  "--ts-accent-soft": "rgba(15, 143, 168, 0.14)",
  "--ts-overlay": "rgba(8, 20, 29, 0.44)",
  "--ts-shadow-soft": "0 10px 28px rgba(8, 26, 38, 0.14)",
  "--ts-shadow-strong": "0 18px 36px rgba(6, 23, 34, 0.28)",
  "--ts-body-bg-grad-a": "rgba(20, 69, 84, 0.18)",
  "--ts-body-bg-grad-b": "rgba(18, 56, 71, 0.22)",
  "--ts-left-rail-bg": "linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(245, 251, 255, 0.66))",
  "--ts-left-rail-inset-shadow": "inset -1px 0 0 rgba(255, 255, 255, 0.3)",
  "--ts-chat-window-overlay-top": "rgba(9, 24, 34, 0.56)",
  "--ts-chat-window-overlay-mid": "rgba(8, 18, 27, 0.36)",
  "--ts-chat-window-overlay-bottom": "rgba(6, 15, 22, 0.5)",
  "--ts-chat-window-radial-a": "rgba(76, 141, 161, 0.14)",
  "--ts-chat-window-radial-b": "rgba(31, 96, 114, 0.16)",
  "--ts-chat-scroll-bg-top": "rgba(255, 255, 255, 0.28)",
  "--ts-chat-scroll-bg-bottom": "rgba(255, 255, 255, 0.16)",
  "--ts-chat-header-border": "rgba(16, 36, 48, 0.16)",
  "--ts-message-assistant-bg": "rgba(250, 252, 253, 0.96)",
  "--ts-message-user-bg": "rgba(228, 241, 246, 0.94)",
  "--ts-message-user-border": "rgba(22, 88, 108, 0.28)",
  "--ts-message-assistant-name": "#185f70",
  "--ts-message-user-name": "#0e4f62",
  "--ts-chat-avatar-preview-bg": "rgba(250, 252, 253, 0.86)",
  "--ts-sidebar-card-bg": "rgba(255, 255, 255, 0.92)",
  "--ts-sidebar-card-hover-border": "rgba(18, 77, 95, 0.34)",
  "--ts-md-code-bg": "rgba(13, 32, 43, 0.08)",
  "--ts-md-quote-color": "#c05f1d",
  "--ts-md-link-decoration-color": "rgba(15, 143, 168, 0.35)",
  "--ts-scrollbar-thumb": "rgba(20, 101, 122, 0.45)",
  "--ts-input-bg": "#ffffff",
  "--ts-node-group-border": "rgba(26,53,89,0.28)",
  "--ts-node-group-border-active": "rgba(47,116,208,0.9)",
  "--ts-node-group-shadow-active": "rgba(47,116,208,0.16)",
  "--ts-node-group-badge-shadow": "rgba(19, 33, 54, 0.24)",
  "--ts-node-group-editor-border": "rgba(0,0,0,0.2)",
  "--op-surface": "#ffffff",
  "--op-surface-muted": "#f7f9fc",
  "--op-border": "#dbe3ee",
  "--op-border-strong": "#c5d1e2",
  "--op-muted": "#596b85",
  "--op-accent": "#2d6cb0",
  "--op-accent-soft": "#edf5ff",
  "--op-success": "#15803d",
  "--op-warn": "#d97706",
  "--op-danger": "#dc2626",
  "--op-shadow": "0 8px 18px rgba(18, 36, 60, 0.06)",
  "--op-bg-gradient-start": "#f8fbff",
  "--op-bg-gradient-end": "#f4f7fb",
  "--op-list-row-bg": "#fdfefe",
  "--op-node-surface": "#ffffff",
  "--op-node-border": "#d9e3f0",
  "--op-node-shadow": "0 12px 24px rgba(24, 43, 70, 0.08)",
  "--op-node-toolbar-bg": "rgba(255, 255, 255, 0.94)",
};

const DARK_TOKENS_BASE: UiThemeTokenMap = {
  "--ts-surface": "#121417",
  "--ts-surface-elevated": "rgba(24, 27, 32, 0.9)",
  "--ts-border-soft": "rgba(208, 218, 230, 0.16)",
  "--ts-accent": "#58b8d8",
  "--ts-accent-soft": "rgba(88, 184, 216, 0.2)",
  "--ts-overlay": "rgba(8, 10, 14, 0.62)",
  "--ts-shadow-soft": "0 12px 30px rgba(0, 0, 0, 0.34)",
  "--ts-shadow-strong": "0 18px 40px rgba(0, 0, 0, 0.46)",
  "--ts-body-bg-grad-a": "rgba(55, 68, 84, 0.18)",
  "--ts-body-bg-grad-b": "rgba(39, 52, 66, 0.2)",
  "--ts-left-rail-bg": "linear-gradient(180deg, rgba(24, 28, 34, 0.9), rgba(16, 20, 25, 0.88))",
  "--ts-left-rail-inset-shadow": "inset -1px 0 0 rgba(255, 255, 255, 0.05)",
  "--ts-chat-window-overlay-top": "rgba(10, 13, 18, 0.72)",
  "--ts-chat-window-overlay-mid": "rgba(9, 12, 17, 0.56)",
  "--ts-chat-window-overlay-bottom": "rgba(8, 11, 15, 0.72)",
  "--ts-chat-window-radial-a": "rgba(70, 96, 124, 0.16)",
  "--ts-chat-window-radial-b": "rgba(52, 72, 92, 0.18)",
  "--ts-chat-scroll-bg-top": "rgba(22, 27, 34, 0.56)",
  "--ts-chat-scroll-bg-bottom": "rgba(18, 22, 29, 0.44)",
  "--ts-chat-header-border": "rgba(182, 197, 212, 0.24)",
  "--ts-message-assistant-bg": "rgba(28, 32, 38, 0.94)",
  "--ts-message-user-bg": "rgba(33, 42, 52, 0.92)",
  "--ts-message-user-border": "rgba(112, 164, 191, 0.34)",
  "--ts-message-assistant-name": "#b6d9ea",
  "--ts-message-user-name": "#9fd0e6",
  "--ts-chat-avatar-preview-bg": "rgba(22, 26, 32, 0.9)",
  "--ts-sidebar-card-bg": "rgba(26, 31, 37, 0.92)",
  "--ts-sidebar-card-hover-border": "rgba(104, 160, 189, 0.36)",
  "--ts-md-code-bg": "rgba(140, 170, 195, 0.14)",
  "--ts-md-quote-color": "#f2b27a",
  "--ts-md-link-decoration-color": "rgba(88, 184, 216, 0.38)",
  "--ts-scrollbar-thumb": "rgba(102, 146, 174, 0.52)",
  "--ts-input-bg": "rgba(18, 22, 27, 0.94)",
  "--ts-node-group-border": "rgba(126, 154, 184, 0.34)",
  "--ts-node-group-border-active": "rgba(102, 184, 216, 0.95)",
  "--ts-node-group-shadow-active": "rgba(63, 142, 177, 0.24)",
  "--ts-node-group-badge-shadow": "rgba(0, 0, 0, 0.42)",
  "--ts-node-group-editor-border": "rgba(130, 156, 184, 0.42)",
  "--op-surface": "#1a2027",
  "--op-surface-muted": "#1e252d",
  "--op-border": "#33404d",
  "--op-border-strong": "#435464",
  "--op-muted": "#a5b5c6",
  "--op-accent": "#66b4d8",
  "--op-accent-soft": "rgba(102, 180, 216, 0.18)",
  "--op-success": "#49b87a",
  "--op-warn": "#e7ad5a",
  "--op-danger": "#eb7474",
  "--op-shadow": "0 10px 24px rgba(0, 0, 0, 0.38)",
  "--op-bg-gradient-start": "#1a222b",
  "--op-bg-gradient-end": "#151c24",
  "--op-list-row-bg": "#202932",
  "--op-node-surface": "#1d252e",
  "--op-node-border": "#354655",
  "--op-node-shadow": "0 12px 24px rgba(0, 0, 0, 0.36)",
  "--op-node-toolbar-bg": "rgba(28, 36, 45, 0.94)",
};

export const DEFAULT_UI_THEME_TYPOGRAPHY: UiThemeTypography = {
  uiFontFamily: "'Manrope', 'Segoe UI Variable Text', 'Trebuchet MS', sans-serif",
  chatFontFamily: "'Literata', Georgia, Cambria, serif",
  uiBaseFontSize: "16px",
  chatBaseFontSize: "1rem",
  radiusXs: "6px",
  radiusSm: "10px",
  radiusMd: "14px",
  radiusLg: "18px",
  radiusXl: "22px",
};

export const DEFAULT_UI_THEME_MARKDOWN: UiThemeMarkdown = {
  fontSize: "1rem",
  lineHeight: "1.66",
  codeFontSize: "0.86em",
  codePadding: "0.1em 0.32em",
  quoteBorderWidth: "3px",
};

export const DEFAULT_UI_THEME_PAYLOAD: UiThemePresetPayload = {
  lightTokens: LIGHT_TOKENS_BASE,
  darkTokens: DARK_TOKENS_BASE,
  typography: DEFAULT_UI_THEME_TYPOGRAPHY,
  markdown: DEFAULT_UI_THEME_MARKDOWN,
  customCss: "",
};

export const HIGH_CONTRAST_UI_THEME_PAYLOAD: UiThemePresetPayload = {
  lightTokens: {
    ...LIGHT_TOKENS_BASE,
    "--ts-surface": "#ffffff",
    "--ts-surface-elevated": "#ffffff",
    "--ts-border-soft": "rgba(0, 0, 0, 0.42)",
    "--ts-accent": "#005fcc",
    "--ts-accent-soft": "rgba(0, 95, 204, 0.14)",
    "--ts-message-assistant-bg": "#ffffff",
    "--ts-message-user-bg": "#eef5ff",
    "--ts-message-assistant-name": "#00326b",
    "--ts-message-user-name": "#003a7a",
    "--ts-md-quote-color": "#8a3900",
  },
  darkTokens: {
    ...DARK_TOKENS_BASE,
    "--ts-surface": "#05080c",
    "--ts-surface-elevated": "#0b131b",
    "--ts-border-soft": "rgba(199, 223, 242, 0.52)",
    "--ts-accent": "#63b1ff",
    "--ts-accent-soft": "rgba(99, 177, 255, 0.2)",
    "--ts-message-assistant-bg": "#0a1118",
    "--ts-message-user-bg": "#102537",
    "--ts-message-assistant-name": "#b0dcff",
    "--ts-message-user-name": "#8fd0ff",
  },
  typography: DEFAULT_UI_THEME_TYPOGRAPHY,
  markdown: {
    ...DEFAULT_UI_THEME_MARKDOWN,
    lineHeight: "1.7",
    quoteBorderWidth: "4px",
  },
  customCss: "",
};

export const SOFT_NIGHT_UI_THEME_PAYLOAD: UiThemePresetPayload = {
  lightTokens: {
    ...LIGHT_TOKENS_BASE,
    "--ts-surface": "#eef2f7",
    "--ts-accent": "#4078a8",
    "--ts-accent-soft": "rgba(64, 120, 168, 0.16)",
    "--ts-message-user-bg": "rgba(224, 235, 246, 0.96)",
  },
  darkTokens: {
    ...DARK_TOKENS_BASE,
    "--ts-surface": "#101722",
    "--ts-surface-elevated": "rgba(18, 29, 42, 0.88)",
    "--ts-accent": "#7fbad8",
    "--ts-accent-soft": "rgba(127, 186, 216, 0.2)",
    "--ts-message-assistant-bg": "rgba(20, 33, 48, 0.94)",
    "--ts-message-user-bg": "rgba(24, 50, 68, 0.9)",
    "--op-bg-gradient-start": "#132332",
    "--op-bg-gradient-end": "#10202d",
  },
  typography: {
    ...DEFAULT_UI_THEME_TYPOGRAPHY,
    chatFontFamily: "'Merriweather', Georgia, Cambria, serif",
  },
  markdown: {
    ...DEFAULT_UI_THEME_MARKDOWN,
    lineHeight: "1.72",
  },
  customCss: "",
};

export const BUILT_IN_UI_THEME_PRESETS: Array<{
  id: string;
  name: string;
  description: string;
  payload: UiThemePresetPayload;
}> = [
  {
    id: UI_THEME_BUILT_IN_IDS.default,
    name: "Default Light/Dark",
    description: "Default TaleSpinner balanced light and dark palette.",
    payload: DEFAULT_UI_THEME_PAYLOAD,
  },
  {
    id: UI_THEME_BUILT_IN_IDS.highContrast,
    name: "High Contrast",
    description: "Higher contrast preset for readability.",
    payload: HIGH_CONTRAST_UI_THEME_PAYLOAD,
  },
  {
    id: UI_THEME_BUILT_IN_IDS.softNight,
    name: "Soft Night",
    description: "Low-glare dark preset with softer accents.",
    payload: SOFT_NIGHT_UI_THEME_PAYLOAD,
  },
];
