---
title: Введение
sidebar_position: 1
description: Документация TaleSpinner, основанная на текущем коде проекта.
slug: /
---

# Введение

Это официальная документация проекта TaleSpinner.

Ключевое правило: источник правды только код в репозитории.

- Backend: `server/src`
- Frontend: `web/src`
- Общие типы: `shared`

## Для кого этот сайт

- User Guide: сценарии использования интерфейса.
- Developer Guide: архитектура, модули, API и правила развития проекта.

## Быстрые ссылки

- Пользовательский старт: `User Guide -> Getting Started`
- Архитектура: `Developer Guide -> Architecture Overview`
- API обзор: `API Reference -> API Overview`

## Как проверять актуальность

При любом спорном моменте сверяйтесь с файлами:

- Точка входа backend: `server/src/index.ts`
- Реестр API роутов: `server/src/api/_routes_.ts`
- Точка входа frontend: `web/src/App.tsx`
- Базовые frontend API маршруты: `web/src/api-routes.ts`
