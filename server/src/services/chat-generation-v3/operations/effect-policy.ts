import type { OperationHook } from "@shared/types/operation-profiles";

import type { RuntimeEffect } from "../contracts";

type PolicyResult = { ok: true } | { ok: false; code: string; message: string };

export function validateEffectForHook(params: {
  hook: OperationHook;
  effect: RuntimeEffect;
}): PolicyResult {
  const { hook, effect } = params;

  if (hook === "before_main_llm") {
    if (effect.type === "turn.assistant.replace_text") {
      return {
        ok: false,
        code: "EFFECT_POLICY_VIOLATION",
        message: "turn.assistant.* is forbidden in before_main_llm",
      };
    }
    return { ok: true };
  }

  if (
    effect.type === "prompt.system_update" ||
    effect.type === "prompt.append_after_last_user" ||
    effect.type === "prompt.insert_at_depth"
  ) {
    return {
      ok: false,
      code: "EFFECT_POLICY_VIOLATION",
      message: "prompt.* is forbidden in after_main_llm",
    };
  }

  return { ok: true };
}
