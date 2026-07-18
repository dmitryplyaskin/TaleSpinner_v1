import { describe, expect, test } from "vitest";

import { getRequestOwnerId } from "./request-context";

import type { Request } from "express";

describe("request owner context", () => {
  test("does not let request input override the trusted owner scope", () => {
    const request = {
      context: {
        requestId: "request-1",
        ownerScope: { ownerId: "trusted-owner", source: "explicit" },
        actor: { type: "system", id: null },
        tenant: { id: null },
      },
    } as Request;

    expect(getRequestOwnerId(request, "attacker-owner")).toBe("trusted-owner");
  });
});
