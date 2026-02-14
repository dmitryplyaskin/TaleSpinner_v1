---
title: Operations
sidebar_position: 4
description: Automate generation steps with Operation Profiles.
---

# Operations

Operations are built-in pipeline steps around main generation, now composed from reusable **blocks**.

In practice: build reusable operation blocks, then compose profiles for specific workflows.

## What can be automated

- actions before main LLM (`before_main_llm`),
- actions after main LLM (`after_main_llm`),
- execution order and dependencies,
- critical-step enforcement via `required`.

## New model: Profiles + Blocks

- `Blocks`: independent operation sets you can edit, export, and import.
- `Profiles`: composition of `blockRefs` with per-link `enabled` and `order`.

Profiles do not store operations directly. At runtime, backend flattens enabled blocks into one operations array and passes it to the orchestrator.

## Quick scenario

1. Open `Operations` and switch to `Blocks`.
2. Create a block and add operations.
3. Use `Node Editor` if you need dependency graph editing inside the block.
4. Switch to `Profiles`.
5. Create a profile and attach required blocks.
6. Configure block order and enable/disable flags.
7. Save and run a test prompt in chat.

## When to use Node Editor

Use `Node Editor` when:

- you have more than 3-5 operations,
- operations depend on each other,
- you need visual control over flow order.

Important: `dependsOn` is defined within a block. Cross-block dependencies are not used.

## Current runtime support

Operation kinds currently executed in runtime:

- `template`
- `llm`

Other kinds are visible in UI as draft but skipped at execution.

## Practical advantage over manual prompt assembly

- less repetitive setup,
- more stable turn-to-turn behavior,
- easier workflow assembly from reusable blocks,
- easier transfer via block/profile import-export.
