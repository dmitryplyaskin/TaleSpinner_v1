import {
  assertArtifactHistoryItemLimit,
  assertArtifactHistoryWithinLimits,
  assertArtifactValueWithinLimits,
} from "../../operations/operation-resource-limits";

import type { ArtifactValue } from "../contracts";
import type {
  ArtifactFormat,
  ArtifactSemantics,
  ArtifactWriteMode,
} from "@shared/types/operation-profiles";

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
    artifactId: string;
    format: ArtifactFormat;
    semantics: ArtifactSemantics;
    writeMode: ArtifactWriteMode;
    history: {
      enabled: boolean;
      maxItems: number;
    };
    value: unknown;
  }): ArtifactValue {
    assertArtifactValueWithinLimits(params.value);
    assertArtifactHistoryItemLimit(params.history.maxItems);
    const existing = this.byTag.get(params.artifactId);
    const nextHistory = existing
      ? [...existing.history, params.value]
      : [params.value];
    const history = params.history.enabled
      ? nextHistory.slice(-params.history.maxItems)
      : [];
    assertArtifactHistoryWithinLimits(history);

    if (existing) {
      const next: ArtifactValue = {
        ...existing,
        format: params.format,
        semantics: params.semantics,
        writeMode: params.writeMode,
        value: params.value,
        history,
      };
      this.byTag.set(params.artifactId, next);
      return next;
    }

    const created: ArtifactValue = {
      format: params.format,
      semantics: params.semantics,
      persistence: "run_only",
      writeMode: params.writeMode,
      value: params.value,
      history,
    };
    this.byTag.set(params.artifactId, created);
    return created;
  }
}
