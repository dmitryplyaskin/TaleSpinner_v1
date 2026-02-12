---
title: LLM Setup
sidebar_position: 4
description: Configure provider, token, model, and presets.
---

# LLM Setup

## Configurable parts

- active provider,
- active token,
- active model,
- provider config,
- LLM presets.

Frontend model: `web/src/model/provider/index.ts`.

## Backend API

- `server/src/api/llm.api.ts`
- `server/src/api/llm-presets.api.ts`

## Providers

Current providers come from `server/src/services/llm/llm-definitions.ts`.

Note: `/config/openrouter` is intentionally marked as legacy-removed in `server/src/api/llm.api.ts`.
