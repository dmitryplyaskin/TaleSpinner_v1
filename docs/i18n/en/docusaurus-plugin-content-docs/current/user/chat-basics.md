---
title: Chat Basics
sidebar_position: 2
description: Core user actions in chat flow.
---

# Chat Basics

The following user flow is based on the current implementation.

## 1. Select or create a profile

- Main shell is rendered in `web/src/App.tsx`.
- If no profile is selected, UI offers profile creation.
- Profile and chat logic lives in `web/src/model/chat-core/index.ts`.

## 2. Chat and branch management

Supported operations:

- create/delete chats,
- create/activate/rename/delete branches,
- bind prompt template to chat.

See `web/src/model/chat-core/index.ts` and backend API in `server/src/api/chats.core.api.ts`.

## 3. Send message and stream response

- Sending and streaming are implemented in `web/src/model/chat-entry-parts/index.ts`.
- SSE events are handled via `llm.stream.*`.
- Supported modes: `send`, `continue`, `regenerate`, `abort`.

## 4. Variants and manual edits

Supported actions:

- select response variant,
- delete variant,
- manual edit,
- soft-delete entries/parts.

See `web/src/model/chat-entry-parts/index.ts`.
