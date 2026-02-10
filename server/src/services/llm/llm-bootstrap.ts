import { ensureDefaultLlmPresetSettings } from "./llm-presets-repository";
import { ensureDefaultProviders, ensureDefaultRuntimeGlobal } from "./llm-repository";

export async function bootstrapLlm(): Promise<void> {
  await ensureDefaultProviders();
  await ensureDefaultRuntimeGlobal();
  await ensureDefaultLlmPresetSettings();
}

