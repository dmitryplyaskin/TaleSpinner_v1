---
title: Architecture Overview
sidebar_position: 1
description: High-level TaleSpinner architecture.
---

# Architecture Overview

## High-level map

- Frontend (React + Effector): `web/src`
- Backend (Express + service layer): `server/src`
- Shared types: `shared`

## Backend composition

- Entrypoint: `server/src/index.ts`
- API routers registry: `server/src/api/_routes_.ts`
- Error and middleware layer: `server/src/core/middleware`
- Domain services: `server/src/services/*`
- DB schema: `server/src/db/schema`

## Frontend composition

- App shell entrypoint: `web/src/App.tsx`
- Business models: `web/src/model/*`
- UI features: `web/src/features/*`
- API clients: `web/src/api/*` and `web/src/api-routes.ts`

## Startup flow

App bootstrap uses `appStarted -> appInitFx` in `web/src/model/app-init.ts`.

It loads:

- app settings,
- sidebars,
- entity profiles,
- world info,
- llm provider runtime,
- ui themes and other baseline data.
