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

## Основные группы API

- chats / branches
- chat entries / variants / streaming
- entity profiles
- llm providers / tokens / runtime / presets
- operation profiles
- prompt templates
- ui themes
- world info
- files
