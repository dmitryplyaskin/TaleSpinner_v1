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

## Network boundary

By default, the backend binds only to `127.0.0.1`. `TALESPINNER_HOST` is ignored
until LAN mode is explicitly enabled:

```bash
TALESPINNER_LAN_MODE=true
TALESPINNER_HOST=0.0.0.0
TALESPINNER_CORS_ORIGINS=http://192.168.1.20:5173
```

`TALESPINNER_CORS_ORIGINS` is a comma-separated origin allowlist. Without this
setting, only the development origins `http://localhost:5173` and
`http://127.0.0.1:5173` are allowed; requests without an `Origin` header remain
available to local native clients. Requests from other origins receive `403`.

LAN mode exposes the API to other devices on the network. The current local model
does not provide full authentication, so enable it only on a trusted network and
protect the port with the system firewall.

## Main API groups

- chats / branches
- chat entries / variants / streaming
- entity profiles
- llm providers / tokens / runtime / presets
- rag chroma (collections / documents / query / world-info reindex)
- operation profiles
- instructions
- ui themes
- world info
- files

## ChromaDB connection modes

Backend supports two modes:

1. `CHROMA_URL` is set: use direct remote/external Chroma URL.
2. `CHROMA_URL` is empty: URL is built from `CHROMA_HOST` + `CHROMA_PORT` + `CHROMA_SSL`.

Main env vars:

- `CHROMA_URL`
- `CHROMA_HOST`, `CHROMA_PORT`, `CHROMA_SSL`
- `CHROMA_TENANT`, `CHROMA_DATABASE`
- `CHROMA_COLLECTION_WORLD_INFO`
- `CHROMA_DATA_DIR`
- `CHROMA_TIMEOUT_MS`

## ChromaDB local docker run

Quick local run with persisted data:

```bash
docker run --name talespinner-chroma -p 8000:8000 \
  -v ./data/chroma:/data \
  chromadb/chroma:latest
```

Or with `docker compose`:

```yaml
services:
  chroma:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - ./data/chroma:/data
```

Then use default backend config:

- `CHROMA_HOST=127.0.0.1`
- `CHROMA_PORT=8000`
