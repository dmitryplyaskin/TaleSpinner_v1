## План “переезда” TaleSpinner в новое видение (backend-first + DB)

Этот документ описывает **конкретные шаги** перехода от текущего MVP-устройства к новой архитектуре, описанной в `docs/chat-core-spec.md`.

Цель: сделать бэкенд единственным источником правды, перенести данные в БД, упростить фронтенд до UI, и заложить основу для pipeline/RAG.

---

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
