---
title: World Info
sidebar_position: 3
description: Что такое World Info и как оно подключается к генерации.
---

# World Info

World Info добавляет в prompt структурированные знания (книги и записи), которые активируются по контексту диалога.

## Что доступно пользователю

- список книг,
- создание/дублирование/удаление,
- импорт/экспорт,
- настройки движка world info,
- привязки книг к scope (global/chat/entity_profile/persona).

Frontend модель: `web/src/model/world-info/index.ts`.

## Как это обрабатывается на backend

- API: `server/src/api/world-info.core.api.ts`
- Runtime-resolve: `server/src/services/world-info/world-info-runtime.ts`
- Типы: `server/src/services/world-info/world-info-types.ts`

## Scope и роли привязки

- Scope: `global`, `chat`, `entity_profile`, `persona`
- Binding role: `primary`, `additional`

См. `server/src/services/world-info/world-info-types.ts`.
