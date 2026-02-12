import { describe, expect, test } from "vitest";

import { buildDefaultWorldInfoSettings } from "./world-info-defaults";
import {
  normalizeWorldInfoEntry,
  normalizeWorldInfoSettingsPatch,
} from "./world-info-normalizer";

describe("world-info normalizer", () => {
  test("normalizes legacy trigger names to ST trigger set", () => {
    const normalized = normalizeWorldInfoEntry(
      {
        uid: 0,
        content: "x",
        triggers: ["generate", "regenerate", "continue_generation", "unknown"],
      },
      0
    );

    expect(normalized.triggers).toEqual(["normal", "regenerate", "continue"]);
  });

  test("enforces minActivations/maxRecursionSteps mutual exclusion", () => {
    const defaults = {
      ...buildDefaultWorldInfoSettings(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const minActivationsWins = normalizeWorldInfoSettingsPatch({
      patch: { minActivations: 2, maxRecursionSteps: 3 },
      current: defaults,
    });
    expect(minActivationsWins.minActivations).toBe(2);
    expect(minActivationsWins.maxRecursionSteps).toBe(0);

    const recursionWins = normalizeWorldInfoSettingsPatch({
      patch: { minActivations: 0, maxRecursionSteps: 4 },
      current: defaults,
    });
    expect(recursionWins.minActivations).toBe(0);
    expect(recursionWins.maxRecursionSteps).toBe(4);
  });
});
