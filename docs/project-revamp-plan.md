## План “переезда” TaleSpinner в новое видение (backend-first + DB)

Этот документ описывает **конкретные шаги** перехода от текущего MVP-устройства к новой архитектуре, описанной в `docs/chat-core-spec.md`.

Цель: сделать бэкенд единственным источником правды, перенести данные в БД, упростить фронтенд до UI, и заложить основу для pipeline/RAG.

---

## Текущий статус (2026-01-19)

Кратко: **Этап 1 (DB) + Этап 2 (core API без LLM) + Этап 3 (оркестратор/генерации/стриминг) + Этап 4 (prompt templates/LiquidJS) + Этап 5 (pipelines/run logging) — реализованы**. Сейчас идёт **Этап 6 (frontend: thin UI, cutover на новые API)**, далее — **Этап 7 (удаление legacy/JSON)**.

### Этап 6 — прогресс (2026-01-19)

- [x] **Cutover chat UI на backend-first core API**
  - UI работает от `EntityProfile -> Chat -> Messages` через новые endpoint’ы: `/entity-profiles`, `/entity-profiles/:id/chats`, `/chats/:id/messages`
  - отправка сообщений и стриминг: `POST /chats/:id/messages` + `Accept: text/event-stream`
  - abort генерации: `POST /generations/:id/abort`
- [x] **Убрана клиентская сборка prompt**
  - не используется `buildMessages()` и template prepend на фронте; prompt собирается на сервере (оркестратор + LiquidJS)
- [x] **Починены “legacy settings” блокирующие запуск фронта**
  - добавлен `GET/POST /settings/pipelines` (иначе UI падал на 404 HTML → JSON parse)
  - фронтовые `_fabric_` модели теперь устойчивее к не-JSON ошибочным ответам
- [x] **Templates UI подключён к DB-first prompt_templates (совместимость)**
  - legacy UI `/templates` и `/settings/templates` теперь работают поверх таблицы `prompt_templates` (scope=global)
  - выбранный global template реально влияет на следующие генерации (через pickActivePromptTemplate)

Осталось по Этапу 6 (крупные хвосты):

- [ ] **Variants/swipes и управление ими (UI + API)**
  - выбор варианта, регенерация как новый variant, “swipe” UX (см. `docs/chat-core-spec.md`)
- [ ] **Сообщения: edit/delete (и/или manual_edit variant)**
- [ ] **Мульти-чат UX у профиля**
  - список чатов у `EntityProfile`, создание/удаление чатов, переключение активного чата
- [ ] **Branches UI**
  - список/создание/activate веток, корректный показ истории по выбранной ветке
- [ ] **Templates UI v1 “по-новому”**
  - перейти с legacy `/templates` на `/prompt-templates` и добавить scope (global/entity_profile/chat)
- [ ] **Pipeline UI**
  - привести UI пайплайнов к DB-first модели `/pipelines` (и убрать legacy ожидания, если есть)

### Что уже реализовано

- [x] **Этап 0: DTO/валидация (Zod)**

  - Добавлены Zod-схемы/DTO и утилиты JSON:
    - `server/src/chat-core/schemas.ts`
    - `server/src/chat-core/json.ts`

- [x] **Этап 1.2: новая схема БД (v1)**

  - Обновлена Drizzle-схема:
    - `server/src/db/schema.ts`
  - Добавлена миграция **greenfield для legacy `chats/chat_messages`** (дроп старых таблиц и создание новых):
    - `server/drizzle/0004_chat_core_v1.sql`
  - Таблицы в БД (v1, без RAG):  
    `entity_profiles`, `chats`, `chat_branches`, `chat_messages`, `message_variants`, `llm_generations`, `prompt_templates`, `pipelines`, `pipeline_runs`, `pipeline_step_runs`

- [x] **Этап 1.3: repository слой (минимум под API v1 без LLM)**

  - Реализованы репозитории:
    - `server/src/services/chat-core/entity-profiles-repository.ts`
    - `server/src/services/chat-core/chats-repository.ts`
  - Реализовано: CRUD для `entity_profiles`, создание `chat` + автосоздание `main` ветки, список веток, запись/листинг сообщений (пагинация `limit/before`).

- [x] **Этап 2.1–2.2: новый backend API core домена (без LLM)**

  - Добавлены роуты:
    - `server/src/api/entity-profiles.core.api.ts`
    - `server/src/api/entity-profiles.import.api.ts` (импорт CharSpec)
    - `server/src/api/chats.core.api.ts`
  - Подключены в общий роутинг:
    - `server/src/api/_routes_.ts`
  - Эндпоинты (все под `/api`):
    - `GET /entity-profiles`
    - `POST /entity-profiles`
    - `POST /entity-profiles/import` (multipart: `.png`/`.json` → normalize V1–V3 → `entity_profiles.spec_json`)
    - `GET /entity-profiles/:id`
    - `PUT /entity-profiles/:id`
    - `DELETE /entity-profiles/:id`
    - `GET /entity-profiles/:id/chats`
    - `POST /entity-profiles/:id/chats` → возвращает `{ chat, mainBranch }`
    - `GET /chats/:id`
    - `DELETE /chats/:id` (soft-delete: `status=deleted`)
    - `GET /chats/:id/branches`
    - `POST /chats/:id/branches`
    - `POST /chats/:id/branches/:branchId/activate`
    - `GET /chats/:id/messages?branchId&limit&before`
    - `POST /chats/:id/messages` (только `user|system`, без стрима на этом шаге)

- [x] **Этап 3: Orchestrator + Generation + Streaming (LLM) (минимум v1)**

  - Добавлена SSE-инфраструктура (единый envelope событий):
    - `server/src/core/sse/sse.ts`
  - Добавлен orchestrator (fallback system prompt + сбор prompt из истории + throttle/flush в БД):
    - `server/src/services/chat-core/orchestrator.ts`
  - Добавлен runtime registry активных генераций (AbortController по `generationId`):
    - `server/src/services/chat-core/generation-runtime.ts`
  - Добавлен репозиторий для `llm_generations`:
    - `server/src/services/chat-core/generations-repository.ts`
  - Расширен endpoint `POST /chats/:id/messages`:
    - `Accept: text/event-stream` → создаёт user+assistant+variant+generation и стримит SSE события
    - `Accept: application/json` → сохраняет сообщение без генерации (как раньше)
  - Добавлен endpoint abort:
    - `POST /generations/:id/abort`
    - `server/src/api/generations.core.api.ts`

- [x] **Этап 4: Prompt templates (LiquidJS)**

  - Добавлена поддержка LiquidJS на бэкенде (рендер выполняется только на сервере).
  - Добавлен репозиторий и рендер:
    - `server/src/services/chat-core/prompt-templates-repository.ts`
    - `server/src/services/chat-core/prompt-template-renderer.ts`
  - Добавлен core API:
    - `server/src/api/prompt-templates.core.api.ts`
    - `GET /prompt-templates?scope&scopeId`
    - `POST /prompt-templates`
    - `PUT /prompt-templates/:id`
    - `DELETE /prompt-templates/:id`
  - Подключено в общий роутинг:
    - `server/src/api/_routes_.ts`
  - Оркестратор выбирает шаблон по приоритету **chat → entity_profile → global**, рендерит system prompt и использует его в генерации:
    - `server/src/services/chat-core/orchestrator.ts`

- [x] **Этап 5: Pipelines v1 (каркас) + run logging**

  - `GET/POST/PUT/DELETE /pipelines` теперь **DB-first** (таблица `pipelines`), legacy JSON-сервис для `/pipelines` заменён:
    - `server/src/services/chat-core/pipelines-repository.ts`
    - `server/src/api/pipelines.api.ts`
  - Добавлено логирование pipeline runs/step runs для каждого SSE-запроса генерации:
    - `server/src/services/chat-core/pipeline-runs-repository.ts`
    - `server/src/services/chat-core/pipeline-step-runs-repository.ts`
  - `llm_generations` теперь может ссылаться на `pipeline_run_id` и `pipeline_step_run_id` (заполняется при создании generation):
    - `server/src/services/chat-core/generations-repository.ts`
  - В SSE-режиме `POST /chats/:id/messages` создаются `pipeline_run` + шаги `pre`/`llm` и завершаются по DONE/ABORT/ERROR:
    - `server/src/api/chats.core.api.ts`

- [x] **Инфраструктура: автоприменение миграций при старте сервера**
  - Добавлено:
    - `server/src/db/apply-migrations.ts`
  - `server/src/index.ts` теперь вызывает `applyMigrations()` при запуске, чтобы dev-сервер не падал на “пустой” SQLite.

### Что важно помнить / ограничения текущей реализации

- **CharSpec normalize (V1–V3 → V3)**: реализовано для импорта через `POST /entity-profiles/import`.
  - Поддержка: `.json` (сырой JSON) и `.png` (tEXt `chara`/`ccv3`, base64 JSON).
  - Нормализатор (best-effort) приводят V1/V2/V3 к единому объекту с top-level полями (`name`, `first_mes`, и т.д.), чтобы `{{char.name}}` работал стабильно.
  - Технически: `server/src/chat-core/charspec/*`.
  - Важно: `POST /entity-profiles` и `PUT /entity-profiles/:id` по-прежнему принимают `spec: unknown` и сохраняют как есть (без принудительной нормализации).
- **FK циклы**: намеренно **не добавлялись** жёсткие FK вида `chats.active_branch_id -> chat_branches.id` (во избежание циклических зависимостей), это сейчас проверяется на уровне логики.
- **Транзакционность createChat**: создание `chat` + `main` branch сейчас сделано последовательными запросами (без явной транзакции).
- **Prompt templates/LiquidJS**: реализованы, но контекст v1 минимальный: `user`/`rag` пока пустые, snapshot prompt для репродьюса ещё не логируется.
- **Pipelines v1**: пока это каркас хранения + run logging; выполнение “definitionJson” как настоящего пайплайна (pre/rag/post обработка) — следующий этап развития.
- **Streaming/SSE и Generation**: реализовано в `POST /chats/:id/messages` при `Accept: text/event-stream`. Текущий набор SSE `event` типов: `llm.stream.meta`, `llm.stream.delta`, `llm.stream.error`, `llm.stream.done`.
- **Legacy**: старые JSON-based сервисы/эндпоинты пока не вычищались (это **Этап 7**).

## Ориентиры (что считаем успехом)

- **Backend source of truth**: фронт не собирает prompt и не хранит каноническую историю.
- **DB-first**: чаты/сообщения/ветки/варианты/генерации живут в БД.
- **Streaming**: SSE-стриминг работает через бэкенд-оркестратор; запись прогресса идёт по throttle/flush.
- **Templates**: prompt templates на LiquidJS живут на бэке, UI только редактирует конфиг.
- **Pipelines**: есть каркас pipeline_runs/step_runs и хотя бы один “default pipeline” (pre → llm → post).
- **Greenfield**: миграция старых JSON-данных не требуется (можно удалить legacy хранение).

---

## Этап 0. Подготовка репозитория и “контракты”

- **Зафиксировать** спеку как source of truth:
  - `docs/chat-core-spec.md` — ядро домена и хранения
  - этот план — порядок внедрения
- **Договориться о naming** в коде:
  - `EntityProfile`, `Chat`, `ChatBranch`, `Message`, `MessageVariant`, `Generation`, `PromptTemplate`, `PipelineRun`, `PipelineStepRun`
- **Ввести базовые DTO/схемы валидации** (Zod) для новых API.

Артефакт готовности:

- в `server/src` есть папка/модуль для новых domain types + Zod schemas.

---

## Этап 1. БД и слой доступа к данным (repository)

### 1.1 Выбор DB и инфраструктура

- **SQLite локально** (как сейчас), но проектировать таблицы так, чтобы потом перенести в Postgres.
- Подключить/привести в порядок `drizzle` (у вас уже есть `server/drizzle/*` и `server/src/db/schema.ts`).

### 1.2 Новая схема БД (минимальный набор v1)

Добавить/обновить таблицы (см. `docs/chat-core-spec.md`):

- `entity_profiles`
- `chats`
- `chat_branches`
- `chat_messages`
- `message_variants`
- `llm_generations`
- `prompt_templates`
- `pipelines`
- `pipeline_runs`
- `pipeline_step_runs`

Индексы (минимум):

- `chats(entityProfileId, updatedAt)`
- `chat_branches(chatId, createdAt)`
- `chat_messages(chatId, branchId, createdAt)`
- `message_variants(messageId, createdAt)`
- `llm_generations(chatId, startedAt)`
- `prompt_templates(scope, scopeId, enabled)`

### 1.3 Repository слой

Создать репозитории (примерно):

- `EntityProfilesRepository`
- `ChatsRepository`
- `ChatBranchesRepository`
- `MessagesRepository`
- `MessageVariantsRepository`
- `GenerationsRepository`
- `PromptTemplatesRepository`
- `PipelinesRepository` + `PipelineRunsRepository`

Артефакт готовности:

- CRUD операции на уровне repository, покрытые минимальными тестами (или хотя бы smoke).

---

## Этап 2. Новый backend API для core домена

### 2.1 EntityProfiles API

Добавить новые endpoints:

- `GET/POST/PUT/DELETE /entity-profiles`
- `GET /entity-profiles/:id/chats`
- `POST /entity-profiles/:id/chats`

Поведение:

- `kind = "CharSpec"`
- входной импорт CharSpec V1–V3 → normalize → сохранить как CharSpecV3 в `specJson`

### 2.2 Chats + Branches + Messages API (без LLM)

Добавить:

- `GET /chats/:id`
- `DELETE /chats/:id` (soft delete)
- `GET /chats/:id/branches`
- `POST /chats/:id/branches`
- `POST /chats/:id/branches/:branchId/activate`
- `GET /chats/:id/messages?limit&before`
- `POST /chats/:id/messages` (сохранить user/system message; опционально без стрима)

Ключевое правило:

- сервер назначает `createdAt` и порядок.

Артефакт готовности:

- UI можно подключить к этим endpoint’ам и получить список/создание чатов/сообщений (без генерации).

---

## Этап 3. Orchestrator + Generation + Streaming (LLM)

Статус: **реализовано (v1 минимум)** — request-scoped SSE в `POST /chats/:id/messages`, запись `llm_generations`, throttle/flush текста в БД, abort по `generationId`.

### 3.1 Orchestrator service (core)

Создать сервис уровня “оркестратор”, который:

- читает данные из БД (entityProfile + chat + branch + messages + selected variants)
- выбирает PromptTemplate (scope chat → entity_profile → global)
- рендерит LiquidJS → получает system prompt / prelude
- формирует `GenerateMessage[]` (system + history)
- запускает pipeline (пока default)

### 3.2 Generation модель и запись прогресса

Правило v1:

- при запуске создаём:
  - assistant `chat_message` (пустой promptText)
  - `message_variant` (пустой promptText) и делаем selected
  - `llm_generation(status=streaming)`
- во время стрима:
  - append в буфер
  - flush в БД по таймеру (например 500–1000ms): обновить `message_variants.promptText` (+ blocksJson если нужно) и кэш `chat_messages.promptText`
- по DONE/ABORT/ERROR:
  - финальный flush
  - обновить `llm_generations.status`

### 3.3 Streaming endpoint (SSE)

Сделать v1 основной вход:

- `POST /chats/:id/messages`:
  - `Accept: text/event-stream` → записали user message → запустили orchestration → стримим чанки
  - `Accept: application/json` → просто записали message

Плюс:

- `POST /generations/:id/abort`

Артефакт готовности:

- UI отправляет сообщение, получает SSE чанки, видит “печать” ассистента, и результат сохраняется в БД.

---

## Этап 4. Prompt templates (LiquidJS) как продуктовая сущность

### 4.1 CRUD templates

Добавить endpoints:

- `GET /prompt-templates?scope&scopeId`
- `POST /prompt-templates`
- `PUT /prompt-templates/:id`
- `DELETE /prompt-templates/:id`

### 4.2 Минимальный template context v1

Контекст (как в спеке):

- `char` (CharSpecV3)
- `user` (если есть)
- `chat` (meta)
- `messages` (role/content из promptText)
- `rag` (пока пусто)
- `now`

Артефакт готовности:

- пользователь меняет шаблон → следующий ответ LLM формируется по нему.

---

## Этап 5. Pipelines v1 (каркас, без узких кейсов)

### 5.1 Сущности и рантайм

- Реализовать хранение `pipelines` (definitionJson).
- Реализовать `pipeline_runs` и `pipeline_step_runs` записи для каждого вызова.
- Сделать “default pipeline”:
  - `pre`: выбор+рендер template, базовая policy (trimming/history window)
  - `llm`: генерация
  - `post`: базовое форматирование blocks (например: answer block)

### 5.2 API (минимум)

- `GET/POST/PUT/DELETE /pipelines`
- (опционально) `POST /pipelines/:id/run` для ручного запуска

Артефакт готовности:

- каждый запрос в LLM оставляет след: pipeline_run + step_runs + generation.

---

## Этап 6. Frontend: превратить в “тонкий UI”

### 6.1 Убрать frontend-сборку prompt и “источник правды”

Перевести на backend-first:

- убрать сбор `GenerateMessage[]` на фронте (`buildMessages`, template prepend на клиенте)
- `$currentAgentCard` и автосейв “каждые 1s” заменить на:
  - загрузку из API (chat/messages)
  - локальное UI-состояние (input, selection, pending)

### 6.2 Подключить новые сущности

Заменить UI-терминологию/модели:

- `AgentCard` → `EntityProfile`
- список чатов у профиля: `EntityProfile -> Chats`
- внутри чата показывать сообщения по ветке + variants/swipes

### 6.3 Streaming

Фронт должен:

- отправлять `POST /chats/:id/messages` с `Accept: text/event-stream`
- рендерить чанки как “typing”
- корректно обрабатывать abort (по generationId)

Артефакт готовности:

- фронт не содержит логики “какие сообщения отправлять в LLM”.

### Статус реализации (факт)

- Сделано:
  - отправка/стриминг/abort через backend-first core API (SSE)
  - UI больше не собирает prompt (нет client-side template prepend / buildMessages)
- Осталось:
  - variants/swipes + регенерация
  - branches UX (create/activate + рендер ветки)
  - редактирование/удаление (или manual_edit variant)
  - полноценный templates UI через `/prompt-templates` со scope’ами
  - чистка legacy моделей/фич на фронте (см. Этап 7)

---

## Этап 7. Удаление legacy и чистка

Удалить/выключить:

- файловое JSON-хранилище (`server/src/core/services/base-service.ts`, `config-service.ts`) или оставить только для не-чатовых legacy частей, если они ещё нужны
- legacy API вокруг `agent-cards` и /или `/chats` если больше не используются:
  - `server/src/services/agent-cards.service.ts`
  - `server/src/api/agent-cards.api.ts`
  - `server/src/routes/chat-routes.ts` (если перейдём полностью на новое)
- frontend fabric модели, которые больше не применимы к chat history (в частности “сохранение карточки целиком”)

Артефакт готовности:

- никакие данные чата не пишутся в JSON на диск; всё в БД.

---

## Этап 8. Закладка под SaaS (без реализации)

Не делать auth сейчас, но подготовить:

- единый `ownerId` (все таблицы), индексы по нему
- отсутствие “глобальных” синглтонов в бизнес-логике (scope-aware runtime)

---

## Порядок внедрения (рекомендуемый cutover)

1. DB schema + repositories
2. EntityProfiles/Chats/Messages API (без LLM)
3. Orchestrator + SSE generation + persistence
4. Templates CRUD + LiquidJS render step
5. Pipelines каркас + run logging
6. Frontend перевод на новые API + убираем client-side prompt assembly
7. Удаляем legacy JSON storage и старые endpoints

---

## Замечания по рискам

- **Сложность “двойной истины”**: нельзя долго держать параллельно старый и новый flow. Лучше делать быстрый cutover после этапа 3.
- **Streaming write load**: обязательны throttle/flush и финальный flush по DONE/ABORT.
- **blocksJson**: в v1 не нормализовать; оставить JSON. Нормализация — v2+, когда появится сильная потребность в индексах/поиске по блокам.
