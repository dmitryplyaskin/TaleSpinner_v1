---
title: LLM Setup
sidebar_position: 4
description: Настройка провайдера, токена и модели.
---

# LLM Setup

## Что можно настроить

- активный провайдер,
- активный токен,
- активная модель,
- конфиг провайдера,
- пресеты LLM.

Frontend модель: `web/src/model/provider/index.ts`.

## Backend API

- `server/src/api/llm.api.ts`
- `server/src/api/llm-presets.api.ts`

## Провайдеры

Сейчас поддерживаются провайдеры из `server/src/services/llm/llm-definitions.ts`.

Примечание: endpoint `/config/openrouter` помечен как legacy-removed (см. `server/src/api/llm.api.ts`).
