---
title: Docs Contributing
sidebar_position: 4
description: Rules for keeping docs aligned with code.
---

# Docs Contributing

## Core rule

Documentation must follow the codebase, not vice versa.

## Local workflow

```bash
yarn docs:generate:api
yarn docs:check
yarn docs:dev
```

## Pre-merge checks

- page content matches current implementation,
- RU/EN have identical doc ID set,
- `yarn docs:check` passes.

## Where to edit

- RU docs: `docs/docs/**`
- EN docs: `docs/i18n/en/docusaurus-plugin-content-docs/current/**`
- API generator: `docs/scripts/generate-api-reference.mjs`
- i18n parity check: `docs/scripts/check-i18n-parity.mjs`
