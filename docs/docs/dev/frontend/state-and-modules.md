---
title: State And Modules
sidebar_position: 2
description: Основные frontend модели и потоки состояния.
---

# State And Modules

## Стек состояния

Frontend использует Effector.

Ключевые файлы:

- `web/src/model/chat-core/index.ts`
- `web/src/model/chat-entry-parts/index.ts`
- `web/src/model/provider/index.ts`
- `web/src/model/world-info/index.ts`
- `web/src/model/app-init.ts`

## Роли основных моделей

- `chat-core`: профили, чаты, ветки.
- `chat-entry-parts`: загрузка сообщений, стриминг, варианты, edit/delete.
- `provider`: llm runtime, токены, модели, пресеты.
- `world-info`: книги, привязки, настройки world info.
- `app-init`: orchestration загрузки при старте.

## Практический принцип

Перед изменением UI-поведения сначала проверьте соответствующую модель в `web/src/model/*`, затем endpoint в `server/src/api/*`.
