# TaleSpinner

**TaleSpinner** is a local web app for AI chats, storytelling, and roleplay workflows.
It is designed not just for “talking to a model”, but for building a controlled scenario: separating contexts by profile, keeping lore in dedicated knowledge layers, attaching instructions, and automating generation with built-in operations.

In short, TaleSpinner is for people who need a reproducible workflow around LLMs instead of one giant prompt string.

## What the project is about

TaleSpinner focuses on an **integrated and predictable way to work with LLMs**:

- a separate profile for each character, role, or scenario;
- separate chats and branches for story forks;
- separate knowledge layers through World Info;
- separate instructions, personas, and presets for different interaction styles;
- a separate generation pipeline before and after the main model response.

This makes the project well suited for long-running scenarios, complex roleplay chats, lore-heavy worlds, and creative work where clean context and repeatable output matter.

## What TaleSpinner can do

- **Profiles and character cards** — isolated context for a character, role, task, or story setup.
- **Chats and branches** — alternative story paths, regeneration, editing, and manual history cleanup.
- **LLM settings** — connect `openrouter` and `openai_compatible` providers, choose token, model, and presets.
- **World Info** — lorebooks and reference knowledge with bindings across `global`, `chat`, `entity_profile`, and `persona` scopes.
- **Instructions and user personas** — extra behavior templates and user personas for tighter control over conversation style.
- **Operations** — built-in multi-step generation pipelines made of blocks and profiles, with dependencies, required steps, and a Node Editor.
- **Import existing data** — migrate compatible entities from ST-oriented formats (`st_native`, `character_book`, `agnai`, `risu`, `novel`).
- **RAG/ChromaDB** — a foundation for retrieval workflows and indexed knowledge in advanced setups.
- **Local data storage** — app data lives in `./data`, and the backend uses SQLite by default.

## Who it is for

TaleSpinner is especially useful if you:

- write stories, scenes, or dialogues with LLM support;
- run roleplay chats and want isolated contexts;
- work with large worlds, lore, and recurring rules;
- want a stable workflow around models without rebuilding prompts manually every turn;
- prefer an integrated setup over a workflow assembled from many external extensions.

## Repository structure

| Folder | Purpose |
| --- | --- |
| `server` | Backend built with Node.js, Express, and TypeScript |
| `web` | Frontend built with React, Vite, and TypeScript |
| `shared` | Shared types and contracts between backend and frontend |
| `docs` | Docusaurus documentation (RU/EN) |
| `data` | Local runtime data for the app |

## Tech stack

- **Backend:** Node.js, Express, TypeScript
- **Frontend:** React, Vite, TypeScript, Effector, Mantine
- **Docs:** Docusaurus
- **Storage:** SQLite
- **Additional service:** ChromaDB for RAG workflows

## Quick start

### Requirements

- Node.js 22.22.2+
- Yarn Classic 1.x

> Use `yarn` for this repository, not `npm` or `pnpm`.

### Install dependencies

```bash
yarn install:all
yarn install:docs
```

### Configure environment

Create the root `.env` from the template:

```powershell
Copy-Item .\env.example .\.env
```

At minimum, you should review these values before regular use:

- `TALESPINNER_ACCESS_MODE` — keep `local` for a trusted machine or use
  `public` with the complete hardened configuration;
- `TOKENS_MASTER_KEY` — master key used to encrypt stored tokens;
- `PORT`, `DATA_DIR`, `DB_PATH` if you need custom runtime paths;
- `CHROMA_*` only if you plan to use RAG/ChromaDB.

### Run the app

```bash
yarn dev
```

By default:

- the backend starts on `http://localhost:5000`;
- the frontend runs via Vite in dev mode and targets `http://localhost:5000/api`.

Vite prints the exact frontend URL in the terminal after startup.

### First working flow

1. Open the app in your browser.
2. Create the first user account. In local mode its password may be empty.
3. Create your first character profile.
4. Connect an LLM provider in `LLM Settings`.
5. Select a token and model.
6. Create or open a chat.
7. Configure `World Info` and `Operations` if needed.

## Useful commands

```bash
yarn dev
yarn build
yarn docs:dev
yarn docs:build
yarn typecheck:server
yarn typecheck:web
yarn --cwd server test
```

## Documentation

The repository includes separate documentation for users and developers.

- User onboarding: `docs/docs/user/getting-started.md`
- Accounts and secure hosting: `docs/docs/user/accounts-and-security.md`
- Everyday chat workflow: `docs/docs/user/chat-basics.md`
- World Info: `docs/docs/user/world-info.md`
- Operations: `docs/docs/user/operations.md`
- Architecture overview: `docs/docs/dev/architecture/overview.md`
- Backend API registry: `server/src/api/_routes_.ts`

For the English docs site, use the mirrored structure in `docs/i18n/en/docusaurus-plugin-content-docs/current`.

## Migrating old data

If you still have data in the old `server/data` layout, you can move it into the root `data` folder once:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\copy-server-data-to-root.ps1
```

## License

The project is distributed under **GNU AGPLv3**. See `LICENSE` for details.
