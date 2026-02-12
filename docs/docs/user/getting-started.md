---
title: Getting Started
sidebar_position: 1
description: Быстрый локальный запуск TaleSpinner.
---

# Getting Started

## Требования

- Node.js 20+
- Yarn 1.x

## Установка

В корне репозитория:

```bash
yarn install:server
yarn install:web
yarn install:docs
```

## Запуск приложения

```bash
yarn dev
```

Эта команда поднимает:

- backend: `server` (порт по умолчанию `5000`, см. `server/src/index.ts`)
- frontend: `web`

Frontend обращается к backend по `http://localhost:5000/api` (см. `web/src/const.ts`).

## Запуск документации

```bash
yarn docs:dev
```

## Сборка документации

```bash
yarn docs:build
yarn docs:serve
```
