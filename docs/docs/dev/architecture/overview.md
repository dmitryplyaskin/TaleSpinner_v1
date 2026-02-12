---
title: Architecture Overview
sidebar_position: 1
description: Общая архитектура TaleSpinner.
---

# Architecture Overview

## Высокоуровневая схема

- Frontend (React + Effector): `web/src`
- Backend (Express + сервисный слой): `server/src`
- Shared типы: `shared`

## Backend композиция

- Точка входа: `server/src/index.ts`
- API-роуты агрегируются в `server/src/api/_routes_.ts`
- Ошибки и middleware: `server/src/core/middleware`
- Доменные сервисы: `server/src/services/*`
- Схема БД: `server/src/db/schema`

## Frontend композиция

- Точка входа UI: `web/src/App.tsx`
- Бизнес-модели Effector: `web/src/model/*`
- Фичи UI: `web/src/features/*`
- API клиентские вызовы: `web/src/api/*` и `web/src/api-routes.ts`

## Инициализация приложения

При старте вызывается `appStarted -> appInitFx` в `web/src/model/app-init.ts`.

Загружаются:

- app settings,
- sidebars,
- entity profiles,
- world info,
- llm provider runtime,
- ui themes и другие базовые данные.
