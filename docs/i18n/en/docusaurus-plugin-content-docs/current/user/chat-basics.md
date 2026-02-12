---
title: Chat Basics
sidebar_position: 2
description: Daily chat workflow with less manual cleanup.
---

# Chat Basics

This guide focuses on everyday workflow: keep dialogs clean, controllable, and reproducible.

## Recommended workflow

## 1. One profile = one context

Use separate profile per role/character/scenario.

Why: less accidental context leakage between tasks.

## 2. One storyline = one branch

For alternate paths, create a new branch instead of rewriting current one.

Why: easier comparison and rollback.

## 3. Use generation modes intentionally

- `Send` - standard turn.
- `Continue` - continue from the latest user turn.
- `Regenerate` - regenerate selected assistant response.
- `Abort` - stop current stream immediately.

## 4. Keep history clean

- remove weak variants,
- edit messages surgically,
- hide messages from prompt if they should not affect next outputs.

This reduces noise and improves predictability.

## Practical scenario

1. Create chat `Scene 1`.
2. Reach a key story fork.
3. Create branch `Scene 1A`.
4. Explore alternative route in that branch.
5. If response is weak: `Regenerate`.
6. If history gets noisy: delete/hide irrelevant items.

## Common mistakes

## Everything stays in one branch

Result: hard to explain quality drift.

## Heavy manual rewriting instead of using variants

Result: unnecessary effort. Usually faster to switch/regenerate variants first.
