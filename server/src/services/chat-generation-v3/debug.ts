export const CHAT_GENERATION_DEBUG_SETTING_KEY = "__chatGenerationDebug";

export function isChatGenerationDebugEnabled(settings: Record<string, unknown> | undefined): boolean {
  if (!settings) return false;
  const raw = settings[CHAT_GENERATION_DEBUG_SETTING_KEY];
  if (raw === true) return true;
  if (typeof raw === "string") {
    const value = raw.trim().toLowerCase();
    return value === "1" || value === "true" || value === "yes" || value === "on";
  }
  return false;
}

export function stripChatGenerationDebugSettings(
  settings: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!settings) return {};
  const next = { ...settings };
  delete next[CHAT_GENERATION_DEBUG_SETTING_KEY];
  return next;
}

