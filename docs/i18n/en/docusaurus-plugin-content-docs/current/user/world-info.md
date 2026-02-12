---
title: World Info
sidebar_position: 3
description: Add lore context in a controlled way without prompt overload.
---

# World Info

World Info in TaleSpinner is used for controlled knowledge injection: lore, world rules, glossary, character facts.

## When to use World Info

Enable it when:

- model forgets important world facts,
- chat has many terms/entities,
- you need stable long-session consistency.

## Quick scenario: first World Info book

1. Open left menu `World Info`.
2. Create a book or import an existing one (`.json` / `.png`).
3. Select the book from list.
4. Enable binding to current chat (`Bind to chat`).
5. Save settings and send a test prompt.

Expected result: responses follow your lore more consistently.

## TaleSpinner strength

Books can be bound across multiple scopes:

- `global`
- `chat`
- `entity_profile`
- `persona`

This is more manageable than one monolithic lorebook.

## Import from other ecosystems

Supported formats:

- `st_native`
- `character_book`
- `agnai`
- `risu`
- `novel`
- `auto` (format auto-detect)

## Practical tips

- Start with small thematic books, not one huge dump.
- Use chat-binding for local scenarios instead of global binding.
- Keep only necessary books enabled.

## Common issue

## Too many active books

Symptom: responses become noisy or less precise.

Fix: disable extra bindings and keep only relevant lore.
