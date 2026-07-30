---
title: API Endpoints
sidebar_position: 2
description: Автогенерируемый инвентарь backend endpoint-ов из server/src/api.
---

# API Endpoints

Этот файл генерируется скриптом `docs/scripts/generate-api-reference.mjs`.

Источники:

- `server/src/api/_routes_.ts`
- `server/src/api/**/*.ts`

## Endpoint inventory

| Method | Path | Source file | Handler section |
| --- | --- | --- | --- |
| GET | /api/app-backgrounds | `server/src/api/app-backgrounds.core.api.ts` | L68 |
| DELETE | /api/app-backgrounds/:id | `server/src/api/app-backgrounds.core.api.ts` | L102 |
| PUT | /api/app-backgrounds/active | `server/src/api/app-backgrounds.core.api.ts` | L92 |
| POST | /api/app-backgrounds/import | `server/src/api/app-backgrounds.core.api.ts` | L76 |
| USE | /api/app-settings | `server/src/api/app-settings.api.ts` | L7 |
| POST | /api/bundles/export | `server/src/api/bundles.core.api.ts` | L46 |
| POST | /api/bundles/import | `server/src/api/bundles.core.api.ts` | L69 |
| GET | /api/chat-knowledge/collections | `server/src/api/chat-knowledge.core.api.ts` | L182 |
| POST | /api/chat-knowledge/collections | `server/src/api/chat-knowledge.core.api.ts` | L196 |
| GET | /api/chat-knowledge/collections/:id | `server/src/api/chat-knowledge.core.api.ts` | L211 |
| GET | /api/chat-knowledge/collections/:id/export | `server/src/api/chat-knowledge.core.api.ts` | L221 |
| POST | /api/chat-knowledge/collections/import | `server/src/api/chat-knowledge.core.api.ts` | L241 |
| GET | /api/chat-knowledge/links | `server/src/api/chat-knowledge.core.api.ts` | L332 |
| POST | /api/chat-knowledge/links | `server/src/api/chat-knowledge.core.api.ts` | L347 |
| GET | /api/chat-knowledge/records | `server/src/api/chat-knowledge.core.api.ts` | L257 |
| POST | /api/chat-knowledge/records | `server/src/api/chat-knowledge.core.api.ts` | L274 |
| GET | /api/chat-knowledge/records/:id | `server/src/api/chat-knowledge.core.api.ts` | L306 |
| POST | /api/chat-knowledge/records/search | `server/src/api/chat-knowledge.core.api.ts` | L316 |
| POST | /api/chat-knowledge/reveal | `server/src/api/chat-knowledge.core.api.ts` | L363 |
| DELETE | /api/chats/:id | `server/src/api/chats.core.api.ts` | L91 |
| GET | /api/chats/:id | `server/src/api/chats.core.api.ts` | L29 |
| PUT | /api/chats/:id | `server/src/api/chats.core.api.ts` | L76 |
| GET | /api/chats/:id/branches | `server/src/api/chats.core.api.ts` | L103 |
| POST | /api/chats/:id/branches | `server/src/api/chats.core.api.ts` | L115 |
| DELETE | /api/chats/:id/branches/:branchId | `server/src/api/chats.core.api.ts` | L178 |
| PUT | /api/chats/:id/branches/:branchId | `server/src/api/chats.core.api.ts` | L159 |
| POST | /api/chats/:id/branches/:branchId/activate | `server/src/api/chats.core.api.ts` | L135 |
| GET | /api/chats/:id/entries | `server/src/api/chat-entries.api.ts` | L62 |
| POST | /api/chats/:id/entries | `server/src/api/chat-entries.api.ts` | L86 |
| POST | /api/chats/:id/entries/continue | `server/src/api/chat-entries.api.ts` | L114 |
| PUT | /api/chats/:id/instruction | `server/src/api/chats.core.api.ts` | L44 |
| GET | /api/chats/:id/operation-runtime-state | `server/src/api/chat-entries.api.ts` | L191 |
| GET | /api/chats/:id/world-info/latest-activations | `server/src/api/chat-entries.api.ts` | L206 |
| ALL | /api/config/openrouter | `server/src/api/llm.api.ts` | L288 |
| GET | /api/entity-profiles | `server/src/api/entity-profiles.core.api.ts` | L135 |
| POST | /api/entity-profiles | `server/src/api/entity-profiles.core.api.ts` | L143 |
| DELETE | /api/entity-profiles/:id | `server/src/api/entity-profiles.core.api.ts` | L251 |
| GET | /api/entity-profiles/:id | `server/src/api/entity-profiles.core.api.ts` | L160 |
| PUT | /api/entity-profiles/:id | `server/src/api/entity-profiles.core.api.ts` | L173 |
| GET | /api/entity-profiles/:id/chats | `server/src/api/entity-profiles.core.api.ts` | L267 |
| POST | /api/entity-profiles/:id/chats | `server/src/api/entity-profiles.core.api.ts` | L280 |
| GET | /api/entity-profiles/:id/export | `server/src/api/entity-profiles.core.api.ts` | L216 |
| POST | /api/entity-profiles/import | `server/src/api/entity-profiles.import.api.ts` | L38 |
| POST | /api/entries/:id/manual-edit | `server/src/api/chat-entries.api.ts` | L298 |
| POST | /api/entries/:id/parts/batch-update | `server/src/api/chat-entries.api.ts` | L313 |
| GET | /api/entries/:id/prompt-diagnostics | `server/src/api/chat-entries.api.ts` | L169 |
| POST | /api/entries/:id/prompt-visibility | `server/src/api/chat-entries.api.ts` | L384 |
| POST | /api/entries/:id/regenerate | `server/src/api/chat-entries.api.ts` | L143 |
| POST | /api/entries/:id/soft-delete | `server/src/api/chat-entries.api.ts` | L370 |
| GET | /api/entries/:id/variants | `server/src/api/chat-entries.api.ts` | L221 |
| POST | /api/entries/:id/variants/:variantId/select | `server/src/api/chat-entries.api.ts` | L239 |
| POST | /api/entries/:id/variants/:variantId/soft-delete | `server/src/api/chat-entries.api.ts` | L330 |
| POST | /api/entries/soft-delete-bulk | `server/src/api/chat-entries.api.ts` | L357 |
| GET | /api/files/metadata/:filename | `server/src/api/files/routes.ts` | L71 |
| POST | /api/files/upload | `server/src/api/files/routes.ts` | L53 |
| POST | /api/files/upload-card | `server/src/api/files/routes.ts` | L59 |
| POST | /api/files/upload-image | `server/src/api/files/routes.ts` | L65 |
| POST | /api/generations/:id/abort | `server/src/api/generations.core.api.ts` | L16 |
| GET | /api/instructions | `server/src/api/instructions.core.api.ts` | L44 |
| POST | /api/instructions | `server/src/api/instructions.core.api.ts` | L105 |
| DELETE | /api/instructions/:id | `server/src/api/instructions.core.api.ts` | L188 |
| PUT | /api/instructions/:id | `server/src/api/instructions.core.api.ts` | L146 |
| GET | /api/instructions/default-st-preset | `server/src/api/instructions.core.api.ts` | L56 |
| POST | /api/instructions/prerender | `server/src/api/instructions.core.api.ts` | L64 |
| GET | /api/llm-preset-settings | `server/src/api/llm-presets.api.ts` | L185 |
| PUT | /api/llm-preset-settings | `server/src/api/llm-presets.api.ts` | L201 |
| GET | /api/llm-presets | `server/src/api/llm-presets.api.ts` | L77 |
| POST | /api/llm-presets | `server/src/api/llm-presets.api.ts` | L93 |
| DELETE | /api/llm-presets/:id | `server/src/api/llm-presets.api.ts` | L132 |
| PUT | /api/llm-presets/:id | `server/src/api/llm-presets.api.ts` | L108 |
| POST | /api/llm-presets/:id/apply | `server/src/api/llm-presets.api.ts` | L150 |
| GET | /api/llm/models | `server/src/api/llm.api.ts` | L234 |
| GET | /api/llm/openrouter/endpoints | `server/src/api/llm.api.ts` | L274 |
| GET | /api/llm/providers | `server/src/api/llm.api.ts` | L62 |
| POST | /api/llm/providers/:providerId/check | `server/src/api/llm.api.ts` | L150 |
| GET | /api/llm/providers/:providerId/config | `server/src/api/llm.api.ts` | L121 |
| PATCH | /api/llm/providers/:providerId/config | `server/src/api/llm.api.ts` | L131 |
| GET | /api/llm/runtime | `server/src/api/llm.api.ts` | L77 |
| PATCH | /api/llm/runtime | `server/src/api/llm.api.ts` | L95 |
| GET | /api/llm/runtime/provider-state | `server/src/api/llm.api.ts` | L112 |
| GET | /api/llm/tokens | `server/src/api/llm.api.ts` | L172 |
| POST | /api/llm/tokens | `server/src/api/llm.api.ts` | L190 |
| DELETE | /api/llm/tokens/:id | `server/src/api/llm.api.ts` | L225 |
| PATCH | /api/llm/tokens/:id | `server/src/api/llm.api.ts` | L211 |
| GET | /api/operation-blocks | `server/src/api/operation-blocks.core.api.ts` | L33 |
| POST | /api/operation-blocks | `server/src/api/operation-blocks.core.api.ts` | L41 |
| DELETE | /api/operation-blocks/:id | `server/src/api/operation-blocks.core.api.ts` | L82 |
| GET | /api/operation-blocks/:id | `server/src/api/operation-blocks.core.api.ts` | L53 |
| PUT | /api/operation-blocks/:id | `server/src/api/operation-blocks.core.api.ts` | L67 |
| GET | /api/operation-blocks/:id/export | `server/src/api/operation-blocks.core.api.ts` | L96 |
| POST | /api/operation-blocks/import | `server/src/api/operation-blocks.core.api.ts` | L124 |
| GET | /api/operation-profiles | `server/src/api/operation-profiles.core.api.ts` | L36 |
| POST | /api/operation-profiles | `server/src/api/operation-profiles.core.api.ts` | L44 |
| DELETE | /api/operation-profiles/:id | `server/src/api/operation-profiles.core.api.ts` | L115 |
| GET | /api/operation-profiles/:id | `server/src/api/operation-profiles.core.api.ts` | L86 |
| PUT | /api/operation-profiles/:id | `server/src/api/operation-profiles.core.api.ts` | L100 |
| GET | /api/operation-profiles/:id/export | `server/src/api/operation-profiles.core.api.ts` | L132 |
| GET | /api/operation-profiles/active | `server/src/api/operation-profiles.core.api.ts` | L58 |
| PUT | /api/operation-profiles/active | `server/src/api/operation-profiles.core.api.ts` | L72 |
| POST | /api/operation-profiles/import | `server/src/api/operation-profiles.core.api.ts` | L151 |
| POST | /api/parts/:id/canonicalization-undo | `server/src/api/chat-entries.api.ts` | L407 |
| POST | /api/parts/:id/soft-delete | `server/src/api/chat-entries.api.ts` | L422 |
| GET | /api/rag/chroma/collections | `server/src/api/rag-chroma.api.ts` | L77 |
| POST | /api/rag/chroma/collections | `server/src/api/rag-chroma.api.ts` | L84 |
| DELETE | /api/rag/chroma/collections/:name | `server/src/api/rag-chroma.api.ts` | L96 |
| GET | /api/rag/chroma/collections/:name/peek | `server/src/api/rag-chroma.api.ts` | L104 |
| POST | /api/rag/chroma/documents/delete | `server/src/api/rag-chroma.api.ts` | L133 |
| POST | /api/rag/chroma/documents/upsert | `server/src/api/rag-chroma.api.ts` | L121 |
| GET | /api/rag/chroma/health | `server/src/api/rag-chroma.api.ts` | L70 |
| POST | /api/rag/chroma/query | `server/src/api/rag-chroma.api.ts` | L145 |
| POST | /api/rag/chroma/world-info/reindex | `server/src/api/rag-chroma.api.ts` | L161 |
| POST | /api/rag/embeddings | `server/src/api/rag.api.ts` | L188 |
| GET | /api/rag/models | `server/src/api/rag.api.ts` | L94 |
| GET | /api/rag/presets | `server/src/api/rag.api.ts` | L113 |
| POST | /api/rag/presets | `server/src/api/rag.api.ts` | L118 |
| DELETE | /api/rag/presets/:id | `server/src/api/rag.api.ts` | L136 |
| PUT | /api/rag/presets/:id | `server/src/api/rag.api.ts` | L122 |
| POST | /api/rag/presets/:id/apply | `server/src/api/rag.api.ts` | L165 |
| GET | /api/rag/providers | `server/src/api/rag.api.ts` | L51 |
| POST | /api/rag/providers/:providerId/check | `server/src/api/rag.api.ts` | L73 |
| GET | /api/rag/providers/:providerId/config | `server/src/api/rag.api.ts` | L63 |
| PATCH | /api/rag/providers/:providerId/config | `server/src/api/rag.api.ts` | L68 |
| GET | /api/rag/runtime | `server/src/api/rag.api.ts` | L55 |
| PATCH | /api/rag/runtime | `server/src/api/rag.api.ts` | L59 |
| GET | /api/rag/tokens | `server/src/api/rag.api.ts` | L88 |
| USE | /api/settings | `server/src/api/settings.api.ts` | L7 |
| GET | /api/settings/rag-presets | `server/src/api/rag.api.ts` | L144 |
| POST | /api/settings/rag-presets | `server/src/api/rag.api.ts` | L149 |
| GET | /api/settings/user-persons | `server/src/api/user-persons.core.api.ts` | L105 |
| POST | /api/settings/user-persons | `server/src/api/user-persons.core.api.ts` | L117 |
| POST | /api/sillytavern-import/import | `server/src/api/sillytavern-import.api.ts` | L47 |
| POST | /api/sillytavern-import/scan | `server/src/api/sillytavern-import.api.ts` | L34 |
| GET | /api/ui-theme-presets | `server/src/api/ui-theme.core.api.ts` | L39 |
| POST | /api/ui-theme-presets | `server/src/api/ui-theme.core.api.ts` | L49 |
| DELETE | /api/ui-theme-presets/:id | `server/src/api/ui-theme.core.api.ts` | L88 |
| PUT | /api/ui-theme-presets/:id | `server/src/api/ui-theme.core.api.ts` | L64 |
| GET | /api/ui-theme-presets/:id/export | `server/src/api/ui-theme.core.api.ts` | L99 |
| POST | /api/ui-theme-presets/import | `server/src/api/ui-theme.core.api.ts` | L117 |
| GET | /api/ui-theme-settings | `server/src/api/ui-theme.core.api.ts` | L131 |
| PUT | /api/ui-theme-settings | `server/src/api/ui-theme.core.api.ts` | L141 |
| GET | /api/user-persons | `server/src/api/user-persons.core.api.ts` | L27 |
| POST | /api/user-persons | `server/src/api/user-persons.core.api.ts` | L50 |
| DELETE | /api/user-persons/:id | `server/src/api/user-persons.core.api.ts` | L93 |
| GET | /api/user-persons/:id | `server/src/api/user-persons.core.api.ts` | L39 |
| PUT | /api/user-persons/:id | `server/src/api/user-persons.core.api.ts` | L72 |
| GET | /api/world-info/bindings | `server/src/api/world-info.core.api.ts` | L341 |
| PUT | /api/world-info/bindings | `server/src/api/world-info.core.api.ts` | L355 |
| GET | /api/world-info/books | `server/src/api/world-info.core.api.ts` | L165 |
| POST | /api/world-info/books | `server/src/api/world-info.core.api.ts` | L175 |
| DELETE | /api/world-info/books/:id | `server/src/api/world-info.core.api.ts` | L224 |
| GET | /api/world-info/books/:id | `server/src/api/world-info.core.api.ts` | L186 |
| PUT | /api/world-info/books/:id | `server/src/api/world-info.core.api.ts` | L197 |
| POST | /api/world-info/books/:id/duplicate | `server/src/api/world-info.core.api.ts` | L235 |
| GET | /api/world-info/books/:id/export | `server/src/api/world-info.core.api.ts` | L301 |
| POST | /api/world-info/books/import | `server/src/api/world-info.core.api.ts` | L252 |
| POST | /api/world-info/resolve | `server/src/api/world-info.core.api.ts` | L372 |
| GET | /api/world-info/settings | `server/src/api/world-info.core.api.ts` | L320 |
| PUT | /api/world-info/settings | `server/src/api/world-info.core.api.ts` | L330 |
| USE | /defaults/backgrounds | `server/src/api/static.api.ts` | L36 |
| POST | /login | `server/src/api/auth.api.ts` | L253 |
| POST | /logout | `server/src/api/auth.api.ts` | L345 |
| USE | /media | `server/src/api/static.api.ts` | L22 |
| POST | /password | `server/src/api/auth.api.ts` | L355 |
| POST | /recover | `server/src/api/auth.api.ts` | L322 |
| POST | /register | `server/src/api/auth.api.ts` | L268 |
| POST | /setup | `server/src/api/auth.api.ts` | L234 |
| GET | /status | `server/src/api/auth.api.ts` | L159 |
| POST | /switch | `server/src/api/auth.api.ts` | L305 |
| GET | /users | `server/src/api/auth.api.ts` | L374 |
| POST | /users | `server/src/api/auth.api.ts` | L385 |
| PATCH | /users/:id | `server/src/api/auth.api.ts` | L403 |
| POST | /users/:id/password | `server/src/api/auth.api.ts` | L426 |

## Notes

- Для роутов из `_routes_.ts` путь нормализуется с префиксом `/api`.
- Для router chaining (`router.route(...).get(...).delete(...)`) каждый метод включается отдельно.
