---
title: LLM Setup
sidebar_position: 5
description: Configure provider, tokens, models, and presets for your workflow.
---

# LLM Setup

This page focuses on practical setup with minimal manual config.

## Minimal working path

1. Open `LLM Settings` -> `API Provider`.
2. Select provider.
3. Add token.
4. Load model list.
5. Select model.
6. Send test chat message.

## What is configurable

- active provider,
- active token,
- active model,
- provider config,
- LLM presets.

## Why presets matter

Presets are useful when you switch between modes:

- creative writing,
- stricter deterministic output,
- short technical responses,
- long narrative responses.

Instead of manual re-tuning each time, apply one preset.

## Common issues

## Models do not load

Check:

- token is selected for the current provider,
- provider base URL is valid,
- token is active and has required permissions.

## Responses are too unstable

Create/use a stricter preset and keep it as default for that scenario.
