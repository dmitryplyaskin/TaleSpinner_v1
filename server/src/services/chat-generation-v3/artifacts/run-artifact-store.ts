import type { ArtifactUsage, ArtifactSemantics } from "@shared/types/operation-profiles";

import type { ArtifactValue } from "../contracts";

export class RunArtifactStore {
  private readonly byTag = new Map<string, ArtifactValue>();

  snapshot(): Record<string, ArtifactValue> {
    return Object.fromEntries(
      Array.from(this.byTag.entries()).map(([tag, value]) => [tag, { ...value }])
    );
  }

  get(tag: string): ArtifactValue | null {
    return this.byTag.get(tag) ?? null;
  }

  upsert(params: {
    tag: string;
    usage: ArtifactUsage;
    semantics: ArtifactSemantics;
    value: string;
  }): ArtifactValue {
    const existing = this.byTag.get(params.tag);
    if (existing) {
      const next: ArtifactValue = {
        ...existing,
        usage: params.usage,
        semantics: params.semantics,
        value: params.value,
        history: [...existing.history, params.value],
      };
      this.byTag.set(params.tag, next);
      return next;
    }

    const created: ArtifactValue = {
      usage: params.usage,
      semantics: params.semantics,
      persistence: "run_only",
      value: params.value,
      history: [params.value],
    };
    this.byTag.set(params.tag, created);
    return created;
  }
}
