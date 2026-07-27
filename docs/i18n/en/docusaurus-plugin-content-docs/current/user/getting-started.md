---
title: Getting Started
sidebar_position: 1
description: First working TaleSpinner run in 10 minutes.
---

# Getting Started

## What you will have in 10 minutes

After this guide you will have:

- a TaleSpinner account,
- a created profile,
- connected LLM provider,
- first working chat,
- clear next steps (World Info and Operations).

## Before you start

Requirements:

- Node.js 20+
- Yarn 1.x

## Step 1. Install dependencies

```bash
yarn install:server
yarn install:web
yarn install:docs
```

## Step 2. Run the app

```bash
yarn dev
```

By default backend runs on `http://localhost:5000`, frontend targets `http://localhost:5000/api`.

## Step 3. Create your first account

On first open, TaleSpinner asks you to create an administrator. In the default
`local` mode the password may be empty. When this is the only passwordless
account, the app signs in automatically. The account owns its chats, profiles,
settings, provider tokens, and uploaded files.

## Step 4. Create your first profile

1. Open the app in browser.
2. Click `Create new profile` on the initial screen.
3. Select the new profile in the left menu `Profiles`.

## Step 5. Connect LLM

1. Open `LLM Settings` in the left menu.
2. Go to `API Provider`.
3. Select provider (`openrouter` or `openai_compatible`).
4. Add a token.
5. Load and select a model.

## Step 6. Send first message

1. Open or create a chat.
2. Type a message and click `Send`.
3. Verify the answer is streaming.

## What to read next

1. `Chat Basics` - reliable daily chat workflow.
2. `World Info` - lore-context management.
3. `Operations` - generation automation before/after main LLM.
4. `LLM Setup` - presets and provider tuning.
5. `TaleSpinner vs SillyTavern` - where TaleSpinner has practical advantages.
6. `Accounts and Security` - local accounts and secure public hosting.

## Common issues

## No model response

Check:

- token is selected for active provider,
- model is selected,
- provider did not return auth/rate-limit error.

## App opens but no chat is visible

Expected behavior: first select or create a profile, then create/open a chat.
