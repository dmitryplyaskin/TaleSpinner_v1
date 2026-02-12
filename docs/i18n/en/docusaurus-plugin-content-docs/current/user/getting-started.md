---
title: Getting Started
sidebar_position: 1
description: Quick local setup and run guide for TaleSpinner.
---

# Getting Started

## Requirements

- Node.js 20+
- Yarn 1.x

## Install

From repository root:

```bash
yarn install:server
yarn install:web
yarn install:docs
```

## Run app

```bash
yarn dev
```

This starts:

- backend: `server` (default port `5000`, see `server/src/index.ts`)
- frontend: `web`

Frontend default backend target is `http://localhost:5000/api` (see `web/src/const.ts`).

## Run docs

```bash
yarn docs:dev
```

## Build docs

```bash
yarn docs:build
yarn docs:serve
```
