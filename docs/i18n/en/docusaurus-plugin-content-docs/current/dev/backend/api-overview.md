---
title: API Overview
sidebar_position: 1
description: Backend API structure and source-of-truth files.
---

# API Overview

## Source of truth

1. Route mounting: `server/src/index.ts`
2. Main API route aggregation: `server/src/api/_routes_.ts`
3. Endpoint handlers: `server/src/api/**/*.ts`

## Base prefix

Routers from `_routes_.ts` are mounted via:

```ts
app.use('/api', routes)
```

Therefore `/chats/:id` in router files becomes `/api/chats/:id`.

## Main API groups

- chats / branches
- chat entries / variants / streaming
- entity profiles
- llm providers / tokens / runtime / presets
- operation profiles
- instructions
- ui themes
- world info
- files
