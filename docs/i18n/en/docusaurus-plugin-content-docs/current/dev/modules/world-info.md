---
title: World Info Module
sidebar_position: 3
description: Technical overview of the world info module.
---

# World Info Module

## Backend

- API layer: `server/src/api/world-info.core.api.ts`
- Types: `server/src/services/world-info/world-info-types.ts`
- Runtime: `server/src/services/world-info/world-info-runtime.ts`
- Repositories: `server/src/services/world-info/world-info-repositories.ts`

## Frontend

- Main model: `web/src/model/world-info/index.ts`
- UI integration: `web/src/features/sidebars/world-info`

## Change checklist

- Keep backend/frontend DTOs aligned.
- Validate resolve and bindings behavior across all scopes.
- Ignore legacy documents, verify against current code.
