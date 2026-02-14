import { describe, expect, test } from "vitest";

import {
  createUserPersonBodySchema,
  updateUserPersonBodySchema,
} from "./schemas";

describe("user person schemas", () => {
  test("create schema accepts contentTypeExtended object", () => {
    const parsed = createUserPersonBodySchema.safeParse({
      name: "Alice",
      contentTypeDefault: "Base",
      contentTypeExtended: {
        version: 2,
        baseDescription: "Base",
        settings: {
          additionalJoiner: "\\n\\n",
          wrapperEnabled: true,
          wrapperTemplate: "<tag>{{PROMPT}}</tag>",
        },
        blocks: [],
      },
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.type).toBe("default");
  });

  test("update schema accepts contentTypeExtended array", () => {
    const parsed = updateUserPersonBodySchema.safeParse({
      contentTypeExtended: [
        {
          id: "x1",
          name: "Legacy",
          value: "Text",
          isEnabled: true,
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });
});

