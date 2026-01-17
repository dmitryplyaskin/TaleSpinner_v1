import { ensureDefaultProviders, ensureDefaultRuntimeGlobal } from "./llm-repository";

export async function bootstrapLlm(): Promise<void> {
  await ensureDefaultProviders();
  await ensureDefaultRuntimeGlobal();
}

