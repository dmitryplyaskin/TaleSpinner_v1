# TaleSpinner v1: План Реализации World Info / Lorebook (DB-First, Backend-First)

_Дата: 2026-02-08 (draft)_

## 0) Статус реализации (обновлено: 2026-02-08)

### Уже реализовано в коде

- DB layer:
  - добавлен `server/src/db/schema/world-info.ts`;
  - добавлена миграция `server/drizzle/0015_world_info_v1.sql`;
  - обновлен экспорт схем в `server/src/db/schema.ts`;
  - обновлен `server/drizzle/meta/_journal.json`.
- Core API:
  - добавлен `server/src/api/world-info.core.api.ts`;
  - route подключен в `server/src/api/_routes_.ts`;
  - подняты endpoints books/settings/bindings/import/export/resolve.
- Сервисы World Info:
  - добавлены модули `server/src/services/world-info/*`:
    - `world-info-types.ts`
    - `world-info-defaults.ts`
    - `world-info-normalizer.ts`
    - `world-info-repositories.ts`
    - `world-info-bindings.ts`
    - `world-info-matcher.ts`
    - `world-info-groups.ts`
    - `world-info-timed-effects.ts`
    - `world-info-scanner.ts`
    - `world-info-prompt-assembly.ts`
    - `world-info-runtime.ts`
    - `world-info-converters.ts`
- Интеграция в генерацию:
  - `build-base-prompt.ts`: вызов WI runtime и прокидка `pre/post` injections;
  - `prompt-template-context.ts`: `wiBefore/wiAfter/loreBefore/loreAfter/anchor*` теперь заполняются runtime-значениями;
  - `prompt-draft-builder.ts`: поддержка `preHistorySystemMessages/postHistorySystemMessages`;
  - `contracts.ts` + `run-chat-generation-v3.ts`: `promptSnapshot.meta.worldInfo`.
- Тесты:
  - добавлены unit-тесты для matcher/groups/scanner/timed/converters;
  - добавлен тест prompt integration: `server/src/services/chat-generation-v3/prompt/build-base-prompt.test.ts`.
- Валидация запуска:
  - `yarn --cwd server typecheck` проходит;
  - `yarn --cwd server test` проходит.

### Что осталось сделать

- Integration tests уровня API:
  - CRUD + bindings + resolve через реальные HTTP endpoints.
- Integration tests уровня генерации:
  - проверить end-to-end, что `generate/regenerate` стабильно включают `wiBefore/wiAfter` в llm messages (не только unit-моком).
- Документация API:
  - добавить короткий README в `server/src/api` по `world-info` endpoint-ам.
- Этап 6/7 из roadmap пока не выполнены:
  - `atDepth/outlet` инъекции в prompt draft;
  - UI экран/редактор;
  - расширенная observability/метрики.

### Важно для следующей сессии

- `yarn --cwd server lint` проходит без ошибок, но в проекте есть много legacy warnings по `import/order` (не связаны только с World Info).
- В `git status` есть много незакоммиченных изменений по WI и связанным prompt-модулям; перед новым этапом лучше сделать отдельный commit именно этого среза.

## 1) Назначение документа

Этот документ описывает полный, самодостаточный план внедрения фичи **World Info (Lorebook)** в TaleSpinner v1.

Документ покрывает:
- целевое поведение фичи;
- модель данных и миграции БД;
- API-контракты backend;
- runtime-алгоритм активации записей;
- интеграцию в текущий pipeline генерации;
- тестовый план;
- пошаговый implementation roadmap с критериями готовности.

После реализации по этому плану отдельные внешние документы не нужны.

## 2) Цели и границы

## 2.1 Цели

- Реализовать World Info как first-class backend feature.
- Хранить lorebooks и настройки в БД (не в файловом storage).
- Выполнять активацию записей на backend при каждой генерации.
- Инжектить результат в prompt-пайплайн без client-side сборки.
- Дать API для CRUD, биндингов, импорта/экспорта и dry-run диагностики.

## 2.2 Не-цели первого релиза

- Полная пиксель-парити UI с SillyTavern редактором.
- Векторная активация (`vectorized`) и внешние force hooks от extension-модулей.
- Полная parity-конверсия всех сторонних форматов (добавляется этапом после core).

## 2.3 Definition of Done (продуктовый)

World Info считается реализованным, когда:
- backend хранит books/settings/bindings/timed effects в БД;
- есть рабочие API для управления и привязок;
- scan-алгоритм активирует записи по ключам/группам/рекурсии/бюджету;
- activated lore попадает в prompt при `generate` и `regenerate`;
- есть dry-run endpoint для диагностики;
- есть unit + integration тесты по ключевым правилам.

## 3) Термины и модель поведения

- **Lorebook / World Info**: набор записей (entries), которые активируются по контексту.
- **Book**: отдельный lorebook-объект.
- **Entry**: одна запись lorebook с ключами, условиями и контентом.
- **Scan**: процесс поиска и активации entry по истории чата и дополнительным источникам.
- **Binding**: привязка book к scope (`global`, `chat`, `entity_profile`, `persona`).

Приоритет источников активации:
1. chat-bound books
2. persona-bound books
3. global + entity_profile books (порядок зависит от strategy)

## 4) Целевая архитектура в коде

Новые backend модули:

- `server/src/services/world-info/world-info-types.ts`
- `server/src/services/world-info/world-info-defaults.ts`
- `server/src/services/world-info/world-info-normalizer.ts`
- `server/src/services/world-info/world-info-repositories.ts`
- `server/src/services/world-info/world-info-bindings.ts`
- `server/src/services/world-info/world-info-matcher.ts`
- `server/src/services/world-info/world-info-groups.ts`
- `server/src/services/world-info/world-info-timed-effects.ts`
- `server/src/services/world-info/world-info-scanner.ts`
- `server/src/services/world-info/world-info-prompt-assembly.ts`
- `server/src/services/world-info/world-info-runtime.ts`

Новые API:

- `server/src/api/world-info.core.api.ts`

Новые DB schema files:

- `server/src/db/schema/world-info.ts`

Обновления существующих файлов:

- `server/src/db/schema.ts` (экспорт новой schema)
- `server/src/api/_routes_.ts` (подключить `world-info.core.api.ts`)
- `server/src/services/chat-generation-v3/prompt/build-base-prompt.ts` (интеграция WI runtime)
- `server/src/services/chat-core/prompt-template-context.ts` (контекстные поля WI заполняются реальными данными)
- `server/src/services/chat-core/prompt-draft-builder.ts` (поддержка pre/post system injections)

## 5) Схема БД (Drizzle + SQL migration)

## 5.1 Таблица `world_info_books`

Назначение: хранение lorebook как канонического JSON-объекта (совместимого по entry-полям).

Колонки:
- `id` TEXT PK
- `owner_id` TEXT NOT NULL DEFAULT `"global"`
- `slug` TEXT NOT NULL
- `name` TEXT NOT NULL
- `description` TEXT NULL
- `data_json` TEXT NOT NULL (канонический book JSON, минимум `{ "entries": {} }`)
- `extensions_json` TEXT NULL
- `source` TEXT NOT NULL DEFAULT `"native"` (`native|imported|converted`)
- `version` INTEGER NOT NULL DEFAULT `1`
- `created_at` TIMESTAMP_MS NOT NULL
- `updated_at` TIMESTAMP_MS NOT NULL
- `deleted_at` TIMESTAMP_MS NULL

Индексы и ограничения:
- UNIQUE (`owner_id`, `slug`)
- INDEX (`owner_id`, `updated_at`)

## 5.2 Таблица `world_info_settings`

Назначение: owner-level настройки scan-алгоритма.

Колонки:
- `owner_id` TEXT PK DEFAULT `"global"`
- `scan_depth` INTEGER NOT NULL DEFAULT `2`
- `min_activations` INTEGER NOT NULL DEFAULT `0`
- `min_activations_depth_max` INTEGER NOT NULL DEFAULT `0`
- `budget_percent` INTEGER NOT NULL DEFAULT `25`
- `budget_cap_tokens` INTEGER NOT NULL DEFAULT `0`
- `context_window_tokens` INTEGER NOT NULL DEFAULT `8192`
- `include_names` BOOLEAN NOT NULL DEFAULT `true`
- `recursive` BOOLEAN NOT NULL DEFAULT `false`
- `overflow_alert` BOOLEAN NOT NULL DEFAULT `false`
- `case_sensitive` BOOLEAN NOT NULL DEFAULT `false`
- `match_whole_words` BOOLEAN NOT NULL DEFAULT `false`
- `use_group_scoring` BOOLEAN NOT NULL DEFAULT `false`
- `character_strategy` INTEGER NOT NULL DEFAULT `1` (`0|1|2`)
- `max_recursion_steps` INTEGER NOT NULL DEFAULT `0`
- `meta_json` TEXT NULL
- `created_at` TIMESTAMP_MS NOT NULL
- `updated_at` TIMESTAMP_MS NOT NULL

## 5.3 Таблица `world_info_bindings`

Назначение: привязка books к scope.

Колонки:
- `id` TEXT PK
- `owner_id` TEXT NOT NULL DEFAULT `"global"`
- `scope` TEXT NOT NULL (`global|chat|entity_profile|persona`)
- `scope_id` TEXT NULL (`NULL` только для `global`)
- `book_id` TEXT NOT NULL FK -> `world_info_books.id` ON DELETE CASCADE
- `binding_role` TEXT NOT NULL DEFAULT `"additional"` (`primary|additional`)
- `display_order` INTEGER NOT NULL DEFAULT `0`
- `enabled` BOOLEAN NOT NULL DEFAULT `true`
- `meta_json` TEXT NULL
- `created_at` TIMESTAMP_MS NOT NULL
- `updated_at` TIMESTAMP_MS NOT NULL

Индексы и ограничения:
- UNIQUE (`owner_id`, `scope`, `scope_id`, `book_id`)
- INDEX (`owner_id`, `scope`, `scope_id`, `display_order`)

## 5.4 Таблица `world_info_timed_effects`

Назначение: sticky/cooldown состояние между генерациями.

Колонки:
- `id` TEXT PK
- `owner_id` TEXT NOT NULL DEFAULT `"global"`
- `chat_id` TEXT NOT NULL FK -> `chats.id` ON DELETE CASCADE
- `branch_id` TEXT NOT NULL FK -> `chat_branches.id` ON DELETE CASCADE
- `entry_hash` TEXT NOT NULL
- `book_id` TEXT NULL
- `entry_uid` INTEGER NULL
- `effect_type` TEXT NOT NULL (`sticky|cooldown`)
- `start_message_index` INTEGER NOT NULL
- `end_message_index` INTEGER NOT NULL
- `protected` BOOLEAN NOT NULL DEFAULT `false`
- `created_at` TIMESTAMP_MS NOT NULL
- `updated_at` TIMESTAMP_MS NOT NULL

Индексы:
- UNIQUE (`owner_id`, `chat_id`, `branch_id`, `entry_hash`, `effect_type`)
- INDEX (`chat_id`, `branch_id`, `effect_type`, `end_message_index`)

## 5.5 Миграции

Добавить миграцию:
- `server/drizzle/0015_world_info_v1.sql`

И обновить:
- `server/src/db/schema.ts` (экспорт `./schema/world-info`)

Данных для миграции из legacy нет (feature новая), поэтому backfill не нужен.

## 6) Канонический JSON контракт Book/Entry

`world_info_books.data_json` хранит объект:

```json
{
  "name": "Fantasy Core Lore",
  "entries": {
    "0": {
      "uid": 0,
      "key": ["elf", "forest"],
      "keysecondary": [],
      "comment": "Elves",
      "content": "Elves have long lifespans.",
      "constant": false,
      "vectorized": false,
      "selective": true,
      "selectiveLogic": 0,
      "addMemo": false,
      "order": 100,
      "position": 0,
      "disable": false,
      "ignoreBudget": false,
      "excludeRecursion": false,
      "preventRecursion": false,
      "matchPersonaDescription": false,
      "matchCharacterDescription": false,
      "matchCharacterPersonality": false,
      "matchCharacterDepthPrompt": false,
      "matchScenario": false,
      "matchCreatorNotes": false,
      "delayUntilRecursion": 0,
      "probability": 100,
      "useProbability": true,
      "depth": 4,
      "outletName": "",
      "group": "",
      "groupOverride": false,
      "groupWeight": 100,
      "scanDepth": null,
      "caseSensitive": null,
      "matchWholeWords": null,
      "useGroupScoring": null,
      "automationId": "",
      "role": 0,
      "sticky": null,
      "cooldown": null,
      "delay": null,
      "triggers": [],
      "characterFilter": {
        "isExclude": false,
        "names": [],
        "tags": []
      },
      "extensions": {}
    }
  },
  "extensions": {}
}
```

Правила нормализации на read:
- отсутствующие поля дополняются дефолтами;
- `key` и `keysecondary` всегда массивы;
- `uid` обязателен, при отсутствии генерируется;
- некорректный `characterFilter` приводится к безопасной форме.

## 7) API контракт backend (`/api/world-info/*`)

## 7.1 Books CRUD

1. `GET /api/world-info/books?ownerId&query&limit&before`
- Назначение: список книг.
- Ответ: `{ data: { items: BookSummary[], nextCursor } }`

2. `POST /api/world-info/books`
- Body: `{ ownerId?, name, slug?, description?, data?, extensions? }`
- Валидация:
  - `name` обязателен;
  - `slug` уникален в owner;
  - `data.entries` должен быть объектом.
- Ответ: `{ data: BookDto }`

3. `GET /api/world-info/books/:id`
- Ответ: `{ data: BookDto }`

4. `PUT /api/world-info/books/:id`
- Body: `{ name?, slug?, description?, data?, extensions?, version? }`
- Ответ: `{ data: BookDto }`

5. `DELETE /api/world-info/books/:id`
- Soft-delete (`deleted_at`), ответ `{ data: { id } }`

6. `POST /api/world-info/books/:id/duplicate`
- Body: `{ name?, slug? }`
- Ответ: `{ data: BookDto }`

## 7.2 Импорт/экспорт

1. `POST /api/world-info/books/import`
- multipart:
  - `file` (json/png)
  - `format?` (`auto|st_native|character_book|agnai|risu|novel`)
- Ответ: `{ data: { book, warnings: string[] } }`

2. `GET /api/world-info/books/:id/export?format=st_native`
- Ответ:
  - `application/json` book в ST-compatible формате.

## 7.3 Settings

1. `GET /api/world-info/settings?ownerId`
- Ответ: `{ data: WorldInfoSettingsDto }`

2. `PUT /api/world-info/settings`
- Body: частичный patch полей settings.
- Валидация:
  - `budget_percent` в диапазоне `1..100`;
  - non-negative для depth/min/budget cap.
- Ответ: `{ data: WorldInfoSettingsDto }`

## 7.4 Bindings

1. `GET /api/world-info/bindings?scope&scopeId&ownerId`
- Ответ: `{ data: BindingDto[] }`

2. `PUT /api/world-info/bindings`
- Body:
```json
{
  "ownerId": "global",
  "scope": "chat",
  "scopeId": "chat-uuid",
  "items": [
    { "bookId": "uuid-1", "bindingRole": "additional", "displayOrder": 0, "enabled": true }
  ]
}
```
- Семантика: replace-all for scope (upsert + delete missing).

## 7.5 Runtime dry-run

`POST /api/world-info/resolve`

Body:
- `ownerId?`
- `chatId` (required)
- `branchId?` (default active)
- `entityProfileId?` (default chat.entityProfileId)
- `trigger?` (`generate|regenerate`)
- `historyLimit?` (default 50)
- `dryRun?` (default true)

Response:
- `activatedEntries`
- `worldInfoBefore`
- `worldInfoAfter`
- `depthEntries`
- `outletEntries`
- `debug` (matched keys, skips, budget stats)

## 8) Runtime обработка: точный порядок

## 8.1 Resolve active books

Шаги:
1. Загрузить `world_info_settings`.
2. Загрузить bindings для scope: `global`, `entity_profile`, `chat`, `persona`.
3. Применить dedup (одна и та же книга один раз).
4. Применить приоритет:
   - chat first;
   - persona second;
   - global/entity_profile по `character_strategy`.
5. Раскрыть books в массив entries.

## 8.2 Подготовка entries

Для каждой entry:
- `normalizeEntry(entry)`;
- `parseDecorators(entry.content)` (`@@activate`, `@@dont_activate`);
- `entry.hash = sha256(bookId + ":" + uid + ":" + normalizedContentJSON)`;
- сохранить `entry.bookId`, `entry.bookName`.

## 8.3 Scan buffer (текст для матчинга)

Базовый источник:
- последние `scanDepth` сообщений из истории ветки (newest-first при сканировании).

Дополнительные источники по flags entry:
- `matchPersonaDescription` -> `user.prefix`;
- `matchCharacterDescription` -> `char.description`;
- `matchCharacterPersonality` -> `char.personality`;
- `matchCharacterDepthPrompt` -> `char.system_prompt` (или fallback extension);
- `matchScenario` -> `char.scenario`;
- `matchCreatorNotes` -> `char.creator_notes`/`creatorcomment`.

## 8.4 Matching rules

- primary keys (`key`) обязательны;
- поддержка regex `/pattern/flags`;
- для non-regex:
  - case-sensitive по entry override, иначе global setting;
  - whole-word по entry override, иначе global setting.
- secondary logic:
  - `AND_ANY`, `AND_ALL`, `NOT_ALL`, `NOT_ANY`.

## 8.5 Activation loop

Состояния: `INITIAL -> RECURSION -> MIN_ACTIVATIONS -> NONE`.

Suppressor/activation порядок (обязателен):
1. уже провалил probability в прошлом loop
2. уже activated
3. disable=true
4. trigger filter mismatch
5. character filter mismatch
6. delay skip
7. cooldown skip (если not sticky active)
8. recursion-level skip
9. excludeRecursion skip
10. `@@activate`
11. `@@dont_activate`
12. external forced activate (резерв на v2)
13. `constant`
14. active sticky
15. no primary keys -> skip
16. обычный key-match

После первичного отбора:
- sticky-first sort;
- inclusion-group filter;
- probability gate;
- budget gate;
- merge в final activated map.

## 8.6 Budget policy

Формула:
- `budgetTokens = max(1, round(budget_percent * context_window_tokens / 100))`
- если `budget_cap_tokens > 0`, clamp до cap.
- токены entry: `ceil(content.length / 4)` (v1 estimate policy).

Правило:
- `ignoreBudget=true` может пройти после overflow;
- обычные entries после overflow отклоняются.

## 8.7 Group policy

- `group` поддерживает CSV;
- `groupOverride=true` выигрывает по max `order`;
- иначе weighted random по `groupWeight`.

Для предсказуемости в backend:
- использовать deterministic RNG seed:
  - `seed = sha256(generationId + ":" + groupName)`

## 8.8 Timed effects

`messageIndex` = число сообщений в ветке (без deleted) на момент scan.

Sticky:
- при активации entry со `sticky=N` создать/обновить sticky effect `[messageIndex, messageIndex+N]`.

Cooldown:
- при активации entry со `cooldown=N` создать cooldown effect `[messageIndex, messageIndex+N]`.
- sticky-expire -> auto-create cooldown (`protected=true`) если у entry есть cooldown.

Delay:
- `delay=N` активируется только если `messageIndex >= N`.

Dry-run:
- timed effects читаются для проверки;
- запись изменений не выполняется.

## 8.9 Prompt assembly outputs

Результат scan:
- `worldInfoBefore` (position=`before`)
- `worldInfoAfter` (position=`after`)
- `depthEntries[]` (position=`atDepth`)
- `outletEntries{}` (position=`outlet`)
- `anTop/anBottom`, `emTop/emBottom` (поддержать в данных, даже если UI позже)

## 9) Интеграция в текущий генерационный pipeline

## 9.1 Точка интеграции

Изменяем `server/src/services/chat-generation-v3/prompt/build-base-prompt.ts`:

Новый flow:
1. Построить базовый template context (char/user/chat/messages).
2. Вызвать `resolveWorldInfoRuntime(...)`.
3. Записать в context:
   - `wiBefore`, `wiAfter`, `loreBefore`, `loreAfter`, `anchorBefore`, `anchorAfter`.
4. Рендерить Liquid template.
5. В `buildPromptDraft(...)` передать:
   - `preHistorySystemMessages = [worldInfoBefore]`
   - `postHistorySystemMessages = [worldInfoAfter]`
6. Сохранить debug summary в `llm_generations.prompt_snapshot.meta.worldInfo`.

## 9.2 Изменение prompt-draft-builder

Добавить параметры:
- `preHistorySystemMessages?: string[]`
- `postHistorySystemMessages?: string[]`

Сборка draft:
1. `systemPrompt`
2. `preHistorySystemMessages`
3. history
4. `postHistorySystemMessages`

`depthEntries` в v1:
- сохранить в runtime result и debug;
- инжектить в prompt на следующем этапе (см. этап 6 roadmap).

## 9.3 Trigger mapping

Текущие runtime triggers:
- `generate` -> WI trigger `normal`
- `regenerate` -> WI trigger `regenerate`

Если entry имеет `triggers[]`, матчим по mapped trigger.

## 10) Валидация, ошибки, безопасность

- Все API через Zod-схемы.
- Некорректный regex key не роняет scan, entry считается non-match.
- Любые parse ошибки `data_json`:
  - книга пропускается;
  - warning в dry-run debug;
  - сервер не падает.
- Ограничения payload:
  - max book size (например 5 MB);
  - max entries per book (например 10k);
  - max content length per entry (например 20k chars).

## 11) Пошаговый roadmap внедрения

## Этап 0: Контракты и типы

- Добавить типы World Info и дефолты.
- Добавить Zod-схемы API.

Готовность:
- компилируется без runtime wiring.

## Этап 1: БД и репозитории

- `world-info.ts` schema + `0015_world_info_v1.sql`.
- Репозитории:
  - books;
  - settings;
  - bindings;
  - timed effects.

Готовность:
- CRUD операций в репозиториях покрыт unit/smoke тестами.

## Этап 2: Core API

- Реализовать `world-info.core.api.ts`.
- Подключить в `_routes_.ts`.
- Поднять endpoints books/settings/bindings/import/export/resolve.

Готовность:
- Postman smoke: CRUD + bindings + dry-run.

## Этап 3: Scan engine

- Реализовать matcher/grouping/recursion/budget/timed.
- Реализовать prompt assembly outputs.

Готовность:
- unit tests на матрицу активации (см. раздел 12).

## Этап 4: Интеграция в генерацию

- Вызов runtime в `build-base-prompt.ts`.
- Передача `wi*` в template context.
- Инжект `worldInfoBefore/After` через prompt-draft-builder.

Готовность:
- реальная генерация учитывает lore без фронтовой сборки.

## Этап 5: Импорт/экспорт конвертеры

- `st_native` обязателен.
- `character_book` и прочие форматы можно добавлять по очереди.

Готовность:
- импорт ST world json и экспорт обратно без потери ключевых полей.

## Этап 6: Расширенная инъекция (atDepth/outlet) + UI

- Добавить глубинные вставки (`atDepth`) в prompt draft.
- Добавить outlet map в template context (`wiOutlets`).
- Добавить frontend экраны редактора и binding controls.

Готовность:
- пользователь может управлять lorebooks из UI и видеть эффект в генерации.

## Этап 7: Полировка и observability

- Добавить debug-отчет в generation snapshot.
- Добавить метрики latency/activated_count/overflow.

Готовность:
- диагностика проблем доступна без дебага кода.

## 12) Тестовый план (обязательный минимум)

## 12.1 Unit tests

- matching:
  - primary/secondary логика (`AND_ANY/AND_ALL/NOT_ALL/NOT_ANY`);
  - case-sensitive и whole-word;
  - regex keys.
- recursion:
  - recursive on/off;
  - delayUntilRecursion boolean/number;
  - prevent/exclude recursion.
- budget:
  - percent + cap + ignoreBudget.
- groups:
  - override;
  - weighted deterministic winner.
- timed:
  - sticky, cooldown, delay.

## 12.2 Integration tests

- API books/settings/bindings.
- dry-run resolve выдает ожидаемые activated entries.
- generation pipeline получает `wiBefore/wiAfter` и отправляет их в llm messages.

## 12.3 Smoke сценарии

1. Привязать chat lorebook и получить activation по ключу.
2. Проверить regeneration trigger filtering.
3. Проверить sticky/cooldown на нескольких сообщениях.
4. Проверить budget overflow.
5. Проверить dedup при одинаковой книге в global и chat scope.

## 13) Решения по совместимости и компромиссы

- Храним entries как JSON blob в `world_info_books.data_json`, чтобы:
  - сохранить совместимость с ST-полями;
  - упростить импорт/экспорт;
  - не раздувать SQL schema десятками колонок.
- Токены в budget считаем оценочно (`chars/4`) в v1.
- RNG для групп делаем deterministic (в отличие от сырого `Math.random`), чтобы тесты были стабильны.
- `vectorized` и external force hooks резервируются в контракте, но можно включить позже.

## 14) Чеклист готовности к merge

- [x] Добавлен `server/src/db/schema/world-info.ts`
- [x] Добавлен `server/drizzle/0015_world_info_v1.sql`
- [x] Обновлен `server/src/db/schema.ts`
- [x] Добавлен `server/src/api/world-info.core.api.ts`
- [x] Подключен route в `server/src/api/_routes_.ts`
- [x] Добавлены сервисы `server/src/services/world-info/*`
- [x] Интеграция в `build-base-prompt.ts`
- [x] Интеграция в `prompt-template-context.ts`
- [x] Интеграция в `prompt-draft-builder.ts`
- [x] Unit tests для scanner/matcher/groups/timed
- [ ] Integration tests API + prompt injection
- [ ] Документация API (короткий README в `server/src/api`)

## 15) Минимальный набор задач для первого PR (рекомендуемый)

Чтобы не делать слишком большой diff в один проход:

1. PR-1: DB + repositories + settings/bindings/books API (без scan).
2. PR-2: scan engine + dry-run endpoint + unit tests.
3. PR-3: prompt integration в generation flow + integration tests.
4. PR-4: import/export converters + UI wiring.

Это снижает риск регрессий и упрощает review.
