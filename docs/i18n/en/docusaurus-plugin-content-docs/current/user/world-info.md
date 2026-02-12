---
title: World Info
sidebar_position: 3
description: World Info user-facing capabilities and runtime integration.
---

# World Info

World Info injects structured knowledge (books and entries) into prompt context based on conversation state.

## User-facing capabilities

- list books,
- create/duplicate/delete books,
- import/export,
- world info settings,
- bindings by scope (`global/chat/entity_profile/persona`).

Frontend model: `web/src/model/world-info/index.ts`.

## Backend processing

- API: `server/src/api/world-info.core.api.ts`
- Runtime resolve: `server/src/services/world-info/world-info-runtime.ts`
- Types: `server/src/services/world-info/world-info-types.ts`

## Binding scopes and roles

- Scope: `global`, `chat`, `entity_profile`, `persona`
- Binding role: `primary`, `additional`

See `server/src/services/world-info/world-info-types.ts`.
