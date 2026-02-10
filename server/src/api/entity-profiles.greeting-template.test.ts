import { describe, expect, test } from "vitest";

import { renderGreetingTemplateSinglePass } from "./entity-profiles.core.api";

describe("renderGreetingTemplateSinglePass", () => {
  const context = {
    char: {},
    user: { id: "user-1", name: "Alice" },
    chat: {},
    messages: [],
    rag: {},
    art: {},
    now: new Date("2026-02-10T00:00:00.000Z").toISOString(),
  };

  test("renders greeting template and returns templateSeed metadata", async () => {
    const result = await renderGreetingTemplateSinglePass({
      rawTemplate: "Hi {{user.name}}",
      context,
    });

    expect(result.rendered).toBe("Hi Alice");
    expect(result.seed).toEqual(
      expect.objectContaining({
        engine: "liquidjs",
        rawTemplate: "Hi {{user.name}}",
        renderedForUserPersonId: "user-1",
      })
    );
    expect(result.seed.renderError).toBeUndefined();
  });

  test("falls back to raw template and stores renderError on syntax failure", async () => {
    const result = await renderGreetingTemplateSinglePass({
      rawTemplate: "Hi {{",
      context,
    });

    expect(result.rendered).toBe("Hi {{");
    expect(result.seed).toEqual(
      expect.objectContaining({
        engine: "liquidjs",
        rawTemplate: "Hi {{",
        renderedForUserPersonId: "user-1",
      })
    );
    expect(typeof result.seed.renderError).toBe("string");
    expect(result.seed.renderError?.length).toBeGreaterThan(0);
  });

  test("renders nested greeting template values recursively up to depth 3", async () => {
    const result = await renderGreetingTemplateSinglePass({
      rawTemplate: "{{user.description}}",
      context: {
        ...context,
        user: {
          ...context.user,
          alias: "{{user.name}}",
          description: "{{user.alias}}",
        },
      },
    });

    expect(result.rendered).toBe("Alice");
    expect(result.seed.renderError).toBeUndefined();
  });
});
