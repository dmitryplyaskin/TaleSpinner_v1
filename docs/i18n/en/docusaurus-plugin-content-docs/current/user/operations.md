---
title: Operations
sidebar_position: 4
description: Automate generation steps with Operation Profiles.
---

# Operations

Operations are built-in pipeline steps around main generation.

In practice: define automation once, then reuse it every turn without manual prompt routine.

## What can be automated

- actions before main LLM (`before_main_llm`),
- actions after main LLM (`after_main_llm`),
- execution order and dependencies,
- critical-step enforcement via `required`.

## Quick scenario: first Operation Profile

1. Open left menu `Operations`.
2. Create a new operation profile.
3. Add a `template` operation.
4. Set hook to `before_main_llm`.
5. Configure output effect.
6. Save profile.
7. Run a test prompt in chat.

Expected result: operation runs automatically in the selected phase.

## When to use Node Editor

Use `Node Editor` when:

- you have more than 3-5 operations,
- operations depend on each other,
- you need visual control over flow order.

## Current runtime support

Operation kinds currently executed in runtime:

- `template`
- `llm`

Other kinds are visible in UI as draft but skipped at execution.

## Practical advantage over manual prompt assembly

- less repetitive setup,
- more stable turn-to-turn behavior,
- easier workflow reuse via profile export/import.
