import type { PromptDraftMessage, RuntimeEffect } from "../../contracts";

export function applyPromptEffect(
  messages: PromptDraftMessage[],
  effect:
    | Extract<RuntimeEffect, { type: "prompt.system_update" }>
    | Extract<RuntimeEffect, { type: "prompt.append_after_last_user" }>
    | Extract<RuntimeEffect, { type: "prompt.insert_at_depth" }>
): PromptDraftMessage[] {
  const next = messages.map((m) => ({ ...m }));

  if (effect.type === "prompt.system_update") {
    const idx = next.findIndex((m) => m.role === "system");
    const current = idx >= 0 ? next[idx]!.content : "";
    const payload = effect.payload;
    const updated =
      effect.mode === "replace"
        ? payload
        : effect.mode === "prepend"
          ? `${payload}${current}`
          : `${current}${payload}`;
    if (idx >= 0) next[idx] = { role: "system", content: updated };
    else next.unshift({ role: "system", content: updated });
    return next;
  }

  if (effect.type === "prompt.append_after_last_user") {
    const lastUserIdx = next.map((m) => m.role).lastIndexOf("user");
    const insertAt = lastUserIdx >= 0 ? lastUserIdx + 1 : next.length;
    next.splice(insertAt, 0, { role: effect.role, content: effect.payload });
    return next;
  }

  const raw = next.length + effect.depthFromEnd;
  const insertAt = Math.min(next.length, Math.max(0, raw));
  next.splice(insertAt, 0, { role: effect.role, content: effect.payload });
  return next;
}
