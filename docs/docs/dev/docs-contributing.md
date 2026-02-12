---
title: Docs Contributing
sidebar_position: 4
description: Правила поддержки документации в актуальном состоянии.
---

# Docs Contributing

## Главный принцип

Документация обновляется по коду, а не наоборот.

## Локальный цикл

```bash
yarn docs:generate:api
yarn docs:check
yarn docs:dev
```

## Что проверять перед merge

- страница отражает текущее поведение кода,
- RU/EN имеют одинаковый набор doc IDs,
- `yarn docs:check` проходит.

## Где править

- RU docs: `docs/docs/**`
- EN docs: `docs/i18n/en/docusaurus-plugin-content-docs/current/**`
- API генератор: `docs/scripts/generate-api-reference.mjs`
- i18n parity: `docs/scripts/check-i18n-parity.mjs`
