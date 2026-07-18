---
title: API Overview
sidebar_position: 1
description: Как организован backend API и где искать source of truth.
---

# API Overview

## Где источник правды

1. Монтирование роутов: `server/src/index.ts`
2. Агрегатор основных API роутов: `server/src/api/_routes_.ts`
3. Конкретные обработчики: `server/src/api/**/*.ts`

## Базовый префикс

Основные роутеры из `_routes_.ts` подключаются через:

```ts
app.use('/api', routes)
```

Поэтому endpoint вида `/chats/:id` в router-файле становится `/api/chats/:id`.

## Сетевая граница

По умолчанию backend слушает только `127.0.0.1`. Значение `TALESPINNER_HOST`
игнорируется, пока явно не включён LAN-режим:

```bash
TALESPINNER_LAN_MODE=true
TALESPINNER_HOST=0.0.0.0
TALESPINNER_CORS_ORIGINS=http://192.168.1.20:5173
```

`TALESPINNER_CORS_ORIGINS` — список разрешённых origin через запятую. Без этой
настройки разрешены только dev-origin `http://localhost:5173` и
`http://127.0.0.1:5173`; запросы без `Origin` разрешены для локальных native-клиентов.
Запрос с другим origin отклоняется с `403`.

LAN-режим открывает API другим устройствам в сети. В текущей локальной модели
полноценной аутентификации нет, поэтому включайте его только в доверенной сети и
защищайте порт системным firewall.

## Основные группы API

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

## ChromaDB: режимы подключения

Backend поддерживает два режима:

1. `CHROMA_URL` задан: используется прямое подключение к удаленному/внешнему Chroma.
2. `CHROMA_URL` пустой: URL собирается из `CHROMA_HOST` + `CHROMA_PORT` + `CHROMA_SSL`.

Основные env:

- `CHROMA_URL`
- `CHROMA_HOST`, `CHROMA_PORT`, `CHROMA_SSL`
- `CHROMA_TENANT`, `CHROMA_DATABASE`
- `CHROMA_COLLECTION_WORLD_INFO`
- `CHROMA_DATA_DIR`
- `CHROMA_TIMEOUT_MS`

## ChromaDB: локальный docker запуск

Пример быстрого локального запуска с персистом данных:

```bash
docker run --name talespinner-chroma -p 8000:8000 \
  -v ./data/chroma:/data \
  chromadb/chroma:latest
```

Или через `docker compose`:

```yaml
services:
  chroma:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - ./data/chroma:/data
```

После этого можно использовать стандартный backend-конфиг:

- `CHROMA_HOST=127.0.0.1`
- `CHROMA_PORT=8000`
