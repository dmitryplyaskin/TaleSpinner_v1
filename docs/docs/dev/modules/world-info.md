---
title: World Info Module
sidebar_position: 3
description: Технический обзор world info модуля.
---

# World Info Module

## Backend

- API слой: `server/src/api/world-info.core.api.ts`
- Типы: `server/src/services/world-info/world-info-types.ts`
- Runtime: `server/src/services/world-info/world-info-runtime.ts`
- Репозитории: `server/src/services/world-info/world-info-repositories.ts`

## Frontend

- Основная модель: `web/src/model/world-info/index.ts`
- UI интеграции: `web/src/features/sidebars/world-info`

## Что важно при изменениях

- Согласовывать DTO между backend и frontend.
- Проверять поведение resolve и bindings для всех scope.
- Не полагаться на legacy документы; проверять только актуальный код.
