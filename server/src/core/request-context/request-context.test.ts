import { describe, expect, test } from "vitest";

import {
  getRequestContext,
  getRequestOwnerId,
  setAuthenticatedUserContext,
} from "./request-context";

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

  test("sets the authenticated user as the trusted owner", () => {
    const request = {} as Request;

    setAuthenticatedUserContext(request, {
      userId: "user-1",
      role: "admin",
    });

    expect(getRequestContext(request)).toMatchObject({
      ownerScope: {
        ownerId: "user-1",
        source: "authenticated-user",
      },
      actor: {
        type: "user",
        id: "user-1",
        role: "admin",
      },
    });
    expect(getRequestOwnerId(request, "attacker-owner")).toBe("user-1");
  });
});
