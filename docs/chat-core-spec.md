# TaleSpinner Chat Core Spec (v1)

Этот документ фиксирует **лексикон**, **границы ответственности**, **модель данных** и **потоки** для ядра чата в TaleSpinner после переосмысления архитектуры.

Документ является **источником правды** для разработки (backend-first source of truth). Любые существенные изменения должны сначала отражаться здесь.

## Цели

- **Backend — единственный source of truth**: сервер хранит и интерпретирует данные, собирает prompt, оркестрирует пайплайны и запросы к LLM.
- **DB-first**: хранение в БД (SQLite локально; с возможностью миграции в Postgres для SaaS).
- **Local-first сейчас, SaaS возможно позже**: модель данных должна иметь явные поля для будущего мульти-тенанта, не ломая single-user.
- **Расширяемость**: поддержка пайплайнов, RAG, pre/post processing без “распила” больших JSON-документов и без сложной нагрузки на чтение.
- **Наблюдаемость**: хранить достаточно метаданных, чтобы объяснять “почему получился такой ответ” (pipeline runs, generation attempts, ошибки).

## Инварианты (обязательные правила v1)

- **Backend source of truth**:

  - Истина истории — в БД: `chat_messages` + выбранный `message_variants` (если включены).
  - Истина процесса — в БД: `pipeline_runs`, `pipeline_step_runs`, `llm_generations`.
  - Frontend не формирует финальный prompt и не принимает решения о trimming/политике.

- **Promptable text**:

  - Для LLM используется **только `promptText`** выбранного состояния (см. правила variants ниже).
  - `blocksJson` может содержать дополнительные UI-данные и не обязан совпадать с `promptText`.

- **Шаблоны (templates) и сборка prompt**:

  - Шаблоны задаются пользователем в UI, но **сохраняются и исполняются на бэкенде**.
  - Frontend хранит/редактирует только исходный текст шаблона и настройки, но **не формирует финальный prompt**.
  - В v1 используем **LiquidJS** как engine рендера шаблонов.

- **Порядок сообщений**:

  - Сообщения упорядочены по `(createdAt, id)` или по явному `seq` (если будет введён). В v1 достаточно `(createdAt, id)` при условии, что сервер задаёт `createdAt`.
  - Клиент не задаёт `createdAt` и не считается источником порядка.

- **Ветки**:
  - Каждое сообщение принадлежит конкретной ветке (`branchId`).
  - У чата всегда есть минимум одна ветка `main` (создаётся при создании чата).

## Термины (лексикон)

### Данные (долговечные сущности)

- **EntityProfile**

  - Описательная сущность “о чём/с кем мы общаемся”: персонаж, мир, локация, сеттинг, объект и т.п.
  - Это **не агент** (не исполнитель). Это **профиль/контекст**.
  - В v1 **`kind = "CharSpec"`** (совместимость с SillyTavern).
    - На входе поддерживаем импорт CharSpec V1–V3, но при сохранении в БД **нормализуем и храним как CharSpecV3** в `specJson`.
    - В v1 **не обязаны** хранить “сырой импорт”: достаточно нормализованного CharSpecV3.

- **Chat**

  - Изолированная сессия общения **с одним EntityProfile**.
  - По сути — контейнер для истории сообщений и метаданных.
  - Chat “глупый”: не принимает решений и не строит prompt.

- **ChatBranch**

  - Ветка истории внутри Chat.
  - Ветка может быть ответвлена от определённого сообщения (fork-point) и дальше жить независимо.
  - В будущем возможен “fork в отдельный Chat” (см. раздел про ветвление/форки).

- **Message**

  - Сообщение в чате (`user | assistant | system`).
  - Содержит:
    - **`promptText`** — канонический текст, который участвует в prompt.
    - **`blocks[]`** — массив UI-блоков (reasoning, answer, tool_result, game_state и т.п.), который рендерится по-разному и может не совпадать с `promptText`.

- **MessageVariant** (опционально, но рекомендуется для swipe/regenerate)
  - Вариант текста для одного `Message`: альтернативный ответ, регенерация, ручная правка как новая версия.
  - Один вариант помечается как **selected/active**.
  - Variant хранит собственные `promptText` и `blocks[]`.
  - В v1 рекомендуется включать variants минимум для `assistant` сообщений, чтобы:
    - поддержать регенерацию как “новый вариант”
    - поддержать swipe/выбор варианта без потери истории

### Оркестрация LLM (процессы)

- **Prompt**

  - Результат сборки данных перед запросом в LLM (system + инструкции + history + retrieval + policy).
  - Prompt не обязателен как отдельная БД-сущность, но может логироваться (snapshot) для отладки.

- **PromptTemplate** (LiquidJS template)

  - Текст шаблона (LiquidJS), из которого бэкенд собирает часть prompt (обычно `system`-сообщение).
  - Шаблон — это **конфиг**, а не “финальный prompt”: он исполняется на сервере над данными из БД.
  - Базовый пример:
    - `Ты гейм мастер. Персонажи: {{char.name}} и {{user.name}}`

- **Generation**

  - Попытка получить/обновить текст ассистента (LLM call) со статусом, параметрами, метриками.
  - Generation относится к конкретному `MessageVariant` (или напрямую к `Message`, если variants отключены).
  - Generation не является сообщением: это запись о попытке получения/обновления текста.

- **Stream**
  - Транспортный канал доставки чанков (SSE/WS). В домене — часть `Generation`.

### Пайплайны / агентика

- **Pipeline**

  - Описание процесса: набор шагов (`pre | rag | llm | post | tool`), параметры, условия, ссылки на источники знаний.

- **PipelineRun**

  - Конкретный запуск Pipeline (по триггеру: новое user-сообщение, кнопка, расписание и т.п.).

- **PipelineStepRun**

  - Выполнение конкретного шага: хранит вход/выход/ошибку, длительность, зависимости.

- **Tool**
  - Интеграция/функция, выполняемая в рамках шага (поиск, парсинг, retrieval, вызовы API и т.п.).

> Термин **Agent** зарезервирован для “исполнителя” (runtime runner) и не используется для EntityProfile.

## Принципы ответственности (границы системы)

### Backend

- Единственный источник правды для:
  - истории (`Chat`, `Message`, выбранный `MessageVariant`)
  - результата оркестрации (`PipelineRun`, `PipelineStepRun`, `Generation`)
  - политики сборки prompt (`Policy`)
- Сборка prompt:
  - извлекает данные из БД
  - применяет `Policy` (trimming, форматирование, запреты/guardrails)
  - добавляет retrieval результаты (RAG)
  - выполняет pipeline шаги
- Стриминг:
  - отправляет чанки клиенту
  - обновляет состояние в БД по стратегии “throttle/flush” (см. ниже)

### Frontend

- UI для:
  - ввода сообщений
  - отображения истории и статусов генерации
  - управления EntityProfile/Chat и настройками
- Не является источником правды:
  - не “собирает” финальный prompt
  - не решает, какие сообщения включать в контекст
  - не хранит долгосрочную историю как канонический источник

## Модель хранения (рекомендуемая: гибрид)

Рекомендация: **реляционное ядро + JSON для расширяемых хвостов**.

### Почему гибрид

- Пайплайнам и оркестратору нужен быстрый доступ к:
  - EntityProfile spec
  - последним N сообщений чата
  - метаданным генераций и шагов
- Реляционное ядро даёт:
  - пагинацию/частичные выборки
  - индексацию/поиск
  - безопасные обновления без перезаписи “огромного документа”
- JSON сохраняет гибкость для будущих спек (миры/персонажи/сложные поля).

## Сущности БД (логическая схема)

Ниже — логическая схема. Конкретная реализация зависит от выбранной БД (SQLite сейчас, Postgres позже), но сущности и связи должны сохраняться.

### Multi-tenant задел

Все “пользовательские” сущности имеют:

- `ownerScope` (например: `global | user | workspace`) или проще `ownerId`/`tenantId` в v1
- В single-user режиме можно фиксировать `ownerId = "global"`.

### EntityProfiles

**`entity_profiles`**

- `id`
- `ownerId`
- `name`
- `kind` (v1: `"CharSpec"`)
- `specJson` (TEXT/JSON): **нормализованный CharSpecV3 документ** (prompts, metadata, настройки, расширяемые поля)
- `metaJson` (TEXT/JSON, опционально): доп. мета (например, UI-настройки, импорт-метка без raw)
- `createdAt`, `updatedAt`
- (опционально) `avatarAssetId`

### Chats

**`chats`**

- `id`
- `ownerId`
- `entityProfileId` (FK)
- `title`
- `activeBranchId` (FK → `chat_branches.id`)
- `status` (`active | archived | deleted`)
- `createdAt`, `updatedAt`
- `lastMessageAt`
- `lastMessagePreview`
- `version` (optimistic locking)
- (опционально) `metaJson` (UI state, pinned flags, и т.п.)

Поля происхождения (для будущего “fork в новый чат”, опционально в v1):

- `originChatId` (nullable)
- `originBranchId` (nullable)
- `originMessageId` (nullable)

### Chat branches

**`chat_branches`**

- `id`
- `ownerId`
- `chatId` (FK)
- `title` / `name` (опционально)
- `createdAt`, `updatedAt`
- `parentBranchId` (nullable)
- `forkedFromMessageId` (nullable)
- `forkedFromVariantId` (nullable)
- `metaJson` (опционально)

Правило:

- Ветвление по умолчанию создаёт новую branch внутри того же chat.
- “Fork в отдельный Chat” создаёт новый chat и заполняет `origin*` ссылками.

Рекомендация v1:

- В момент создания чата создаём ветку `main` и устанавливаем `chats.activeBranchId = main.id`.

### Messages

**`chat_messages`**

- `id`
- `ownerId`
- `chatId` (FK)
- `branchId` (FK → `chat_branches.id`)
- `role` (`user | assistant | system`)
- `createdAt`
- `promptText` (TEXT): **канонический promptable текст**
- `format` (например: `markdown | plain`)
- `blocksJson` (TEXT/JSON): массив блоков (см. “Модель blocks” ниже)
- `metaJson` (TEXT/JSON): расширение (ссылки на assets, structured data, UI hints)
- (опционально) `activeVariantId` (если variants включены)

Правило variants (v1):

- Если variants включены:
  - `activeVariantId` указывает выбранный вариант.
  - `chat_messages.promptText` хранит кэш выбранного варианта (денормализация).
- Если variants выключены:
  - `activeVariantId` всегда NULL.
  - `chat_messages.promptText` является каноническим текстом сообщения.

### Message variants (рекомендуется)

**`message_variants`**

- `id`
- `ownerId`
- `messageId` (FK)
- `createdAt`
- `kind` (`generation | manual_edit | import`)
- `promptText` (TEXT)
- `blocksJson` (TEXT/JSON)
- `metaJson` (TEXT/JSON)
- `isSelected` (boolean)

Правило:

- `chat_messages.promptText` может быть:
  - либо кэшем выбранного variant (денормализация)
  - либо пустым/производным, если канонический текст извлекается всегда из выбранного variant
    Рекомендуемый компромисс: **держать `chat_messages.promptText` как кэш выбранного**, чтобы быстро строить prompt без join.

### Модель blocks (v1)

`blocksJson` хранит массив блоков:

- `id` (string)
- `type` (например: `answer | reasoning | tool_result | game_state | any`)
- `format` (например: `markdown | plain | json`)
- `content` (string или json-строка)
- `visibility`:
  - `ui_only` — показывать только в UI
  - `prompt_only` — участвует только в prompt (редко)
  - `both` — и UI, и prompt
- `order` (number)

Правило сборки prompt:

- В v1 канонический текст для LLM берётся из `promptText`.
- `blocksJson` предназначен для UI и расширений; если нужно синхронизировать блоки и текст, это делается на бэке в pipeline шаге (pre/post) по явной политике.

Рекомендация по reasoning:

- `reasoning` хранится как отдельный block с `visibility=ui_only` (или `prompt_only`, если нужно явно добавлять).
- По умолчанию reasoning **не попадает** в `promptText`, если это не оговорено политикой/шагом pipeline.

### Generations

**`llm_generations`**

- `id`
- `ownerId`
- `chatId` (FK)
- `messageId` (FK) — assistant message
- `variantId` (FK) — какой variant создаётся (рекомендуемо)
- `pipelineRunId` (nullable)
- `pipelineStepRunId` (nullable)
- `providerId`
- `model`
- `paramsJson` (sampler settings, max tokens, etc.)
- `status` (`streaming | done | aborted | error`)
- `startedAt`, `finishedAt`
- `promptHash` (nullable)
- `promptSnapshotJson` (nullable) — для отладки/репродьюса
- `promptTokens`, `completionTokens` (nullable)
- `error` (nullable)

### Pipelines

**`pipelines`**

- `id`
- `ownerId`
- `name`
- `enabled`
- `definitionJson` (TEXT/JSON): шаги, условия, параметры
- `createdAt`, `updatedAt`

**`pipeline_runs`**

- `id`
- `ownerId`
- `chatId`
- `entityProfileId`
- `trigger` (`user_message | manual | scheduled | api`)
- `status` (`running | done | error | aborted`)
- `startedAt`, `finishedAt`
- `metaJson`

**`pipeline_step_runs`**

- `id`
- `ownerId`
- `runId`
- `stepName`
- `stepType` (`pre | rag | llm | post | tool`)
- `status` (`running | done | error | skipped`)
- `startedAt`, `finishedAt`
- `inputJson`
- `outputJson`
- `error`

### Prompt templates (LiquidJS)

**`prompt_templates`**

- `id`
- `ownerId`
- `name`
- `enabled`
- `scope` (`global | entity_profile | chat`)
- `scopeId` (nullable; зависит от scope)
- `engine` (v1: `"liquidjs"`)
- `templateText` (TEXT): исходный текст LiquidJS
- `metaJson` (TEXT/JSON, опционально)
- `createdAt`, `updatedAt`

Правило выбора шаблона (v1 минимально):

- Если есть template для `scope=chat` и `scopeId=chatId` → используем его.
- Иначе если есть template для `scope=entity_profile` и `scopeId=entityProfileId` → используем его.
- Иначе используем `scope=global` активный шаблон (или дефолтный “встроенный”).

Контекст рендера (v1 минимально):

- `char` — объект из `entity_profiles.specJson` (CharSpecV3)
- `user` — активная персона пользователя (если включено; иначе пустой объект/дефолт)
- `chat` — мета чата (id, title, timestamps, branchId)
- `messages` — история сообщений активной ветки в виде массива `{ role, content }`, где `content = promptText` выбранного состояния
- `rag` — результаты retrieval (если есть; иначе пусто)
- `now` — текущая дата/время

### Knowledge / RAG (v1 минимально)

**`knowledge_sources`**

- `id`
- `ownerId`
- `scope` (`global | entity_profile | chat`)
- `scopeId`
- `type` (`file | url | note | folder`)
- `metaJson`
- timestamps

**`rag_documents`**

- `id`, `ownerId`, `sourceId`, `title`, `text`, `metaJson`, timestamps

**`rag_chunks`**

- `id`, `documentId`, `chunkIndex`, `text`, `metaJson`

> Embeddings/Vector: в SQLite можно отложить или сделать провайдерный слой; в Postgres обычно используется pgvector.

## Потоки (flows)

### Отправка user-сообщения и запуск оркестрации

1. Frontend вызывает API `POST /chats/:chatId/messages` (role=user, `promptText`, опционально `blocks[]`, опционально `branchId`).
2. Backend:
   - сохраняет user message
   - создаёт assistant message (пустой) + variant (пустой) **или** создаёт их после pre-шага (решение зависит от UX)
   - запускает `PipelineRun` (если включено)
3. Pipeline:
   - `pre`: нормализация/политики/рендер шаблона (LiquidJS)
   - `rag`: retrieval (если включено)
   - `llm`: создаёт `Generation` и стримит output
   - `post`: преобразования (например: форматирование/структура/сейф-редакция)
4. Backend стримит чанки на фронт.

Транспорт (v1 рекомендация):

- `POST /chats/:id/messages` может работать в двух режимах по заголовку `Accept`:
  - `Accept: text/event-stream` → сервер **сразу** запускает orchestration и стримит чанки (один запрос = запись user message + стрим ассистента).
  - `Accept: application/json` → сервер только сохраняет сообщение и возвращает JSON (без стрима).

### Стриминг и запись в БД

Стратегия записи:

- Сервер держит буфер чанков в памяти на время стрима.
- Обновления в БД выполняются:
  - либо по таймеру (например 500–1000ms) — **throttle flush**
  - либо по ключевым событиям: `DONE`, `ABORT`, `ERROR`

Рекомендация v1:

- делать flush по таймеру + финальный flush по завершению,
- хранить `llm_generations.status` и обновлять `message_variants.promptText` (и при необходимости `blocksJson`),
- обновлять кэш `chat_messages.promptText` (и `activeVariantId`) для выбранного варианта.

### Регенерация

- Регенерация — это **новая Generation**, создающая новый `MessageVariant`.
- Затем:
  - либо автоматически делается `isSelected=true` у нового варианта,
  - либо пользователь выбирает вариант (swipe) и сервер обновляет selection.

Рекомендация v1:

- Регенерация по умолчанию создаёт новый variant и делает его selected.
- Предыдущие варианты не удаляются (для истории/свайпов).

## Правило “где правда”

- **Правда истории**:
  - `chat_messages` + выбранный `message_variant` (если включено)
  - `chat_messages.promptText` считается кэшем выбранного текста (опционально, но рекомендуемо)
- **Правда процесса**:
  - `pipeline_runs`, `pipeline_step_runs`, `llm_generations`

Frontend хранит только временное состояние UI (inputs, selection в моменте), но не является каноническим источником.

## API (высокоуровнево)

Цель — сделать API, где клиент оперирует “глупыми” сущностями, а сервер оркестрирует.

### EntityProfiles

- `GET /entity-profiles`
- `POST /entity-profiles`
- `GET /entity-profiles/:id`
- `PUT /entity-profiles/:id`
- `DELETE /entity-profiles/:id`

### Chats

- `GET /entity-profiles/:id/chats`
- `POST /entity-profiles/:id/chats` (create new chat)
- `GET /chats/:id`
- `DELETE /chats/:id` (soft-delete)

### ChatBranches

- `GET /chats/:id/branches`
- `POST /chats/:id/branches` (create branch; body: `parentBranchId`, `forkedFromMessageId`, optional `forkedFromVariantId`)
- `POST /chats/:id/branches/:branchId/activate` (set active branch)

Опционально (v2+):

- `POST /chats/:id/fork` (создать новый Chat из ветки/сообщения; заполняет `origin*`)

### Messages

- `GET /chats/:id/messages?limit&before`
- `POST /chats/:id/messages` (user/system messages)

### MessageVariants

- `GET /messages/:id/variants`
- `POST /messages/:id/variants/:variantId/select` (выбрать variant как активный)
- `POST /messages/:id/regenerate` (создать новую Generation → Variant; может возвращать stream)

### Generation / Streaming

- `POST /generations/:id/abort`

Опционально (v2+):

- `POST /chats/:id/generate` (ручной запуск orchestrator без добавления user message; возвращает stream)

### Pipelines

- `GET/POST/PUT/DELETE /pipelines`
- `POST /pipelines/:id/run` (опционально)

### PromptTemplates

- `GET /prompt-templates?scope&scopeId`
- `POST /prompt-templates`
- `PUT /prompt-templates/:id`
- `DELETE /prompt-templates/:id`

## Миграции и совместимость

- В рамках этого переосмысления считаем проект **greenfield**: перенос старых данных из JSON-хранилища не требуется.
- Для импорта EntityProfile (CharSpec V1–V3) действует правило нормализации: входные версии приводятся к CharSpecV3 и сохраняются в `entity_profiles.specJson`.

## Неграницы (non-goals) v1

- Полная нормализация всех nested-структур до отдельной таблицы на компонент — не обязательна в v1.
- Multi-user auth/ACL — не входит в v1, но schema оставляет задел.
- Полноценные embeddings с векторным поиском — можно отложить (начать с FTS/BM25).

## Принятые решения (v1)

- **Branches**: вводим `chat_branches` как first-class сущность. Ветка создаётся от сообщения/варианта и живёт внутри Chat.
- **Fork в новый Chat**: не обязателен в v1, но закладываем поля `origin*` в `chats` для будущего “вынести ветку в отдельный чат”.
- **Message content**: канонический текст для prompt — `promptText`. UI-рендер и расширения — через `blocksJson`.
- **Reasoning и прочие типы данных**: оформляются как блоки (`blocksJson`) с управлением видимостью (`ui_only|prompt_only|both`).
- **EntityProfile.kind**: в v1 фиксируем `kind = "CharSpec"`, спецификацию храним как нормализованный CharSpecV3 в `specJson`.
- **Streaming transport**: SSE (WebSocket не требуется в v1).

## Открыто (v2+)

- Нужна ли отдельная нормализация blocks (таблица `message_blocks`) или достаточно JSON.
- Политика синхронизации `blocksJson` ↔ `promptText` (какие блоки участвуют в prompt, как формировать итоговый текст).
- Полный UX для “fork в новый Chat” и правила переноса части истории.
- Индексация/поиск: FTS5 для `promptText` и/или “lastMessagePreview” (решить, когда появится поиск по истории).
