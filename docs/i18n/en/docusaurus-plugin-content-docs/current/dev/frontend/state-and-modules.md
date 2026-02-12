---
title: State And Modules
sidebar_position: 2
description: Main frontend state models and module boundaries.
---

# State And Modules

## State stack

Frontend state is built with Effector.

Key files:

- `web/src/model/chat-core/index.ts`
- `web/src/model/chat-entry-parts/index.ts`
- `web/src/model/provider/index.ts`
- `web/src/model/world-info/index.ts`
- `web/src/model/app-init.ts`

## Model responsibilities

- `chat-core`: profiles, chats, branches.
- `chat-entry-parts`: entries loading, streaming, variants, edit/delete.
- `provider`: llm runtime, tokens, models, presets.
- `world-info`: books, bindings, settings.
- `app-init`: startup orchestration.

## Practical rule

Before changing UI behavior, inspect the corresponding `web/src/model/*` module first, then matching `server/src/api/*` endpoint.
