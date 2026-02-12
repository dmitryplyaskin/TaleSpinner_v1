# TaleSpinner — фактический флоу чата по коду (2026-01-20)

Документ описывает **реальный** (актуальный на дату) флоу общения с LLM в TaleSpinner **по текущему коду**, включая источники данных, формат SSE, точки записи в БД и сценарии abort/regenerate/variants.

> Контекст: `knowledge-base/chat-core-spec.md` описывает целевую архитектуру. Ниже — то, что действительно исполняется сейчас.

## Карта компонентов (где что живёт)

- **Frontend**
  - UI ввода: `web/src/features/chat-window/input/index.tsx`
  - Модель чата (Effector): `web/src/model/chat-core/index.ts`
  - Клиент API (chat-core, JSON+SSE): `web/src/api/chat-core.ts`
  - Базовый URL бэка: `web/src/const.ts` (`BASE_URL`, по умолчанию `http://localhost:5000/api`)
  - Legacy-стрим (не chat-core): `web/src/model/llm-orchestration/*` → `POST /api/generate`

- **Backend**
  - Chat-core endpoints: `server/src/api/chats.core.api.ts`
  - Variants/regenerate endpoints: `server/src/api/message-variants.core.api.ts`
  - Abort generation: `server/src/api/generations.core.api.ts`
  - SSE writer (формат событий + heartbeat): `server/src/core/sse/sse.ts`
  - Оркестратор (сбор prompt + стрим + flush в БД): `server/src/services/chat-core/orchestrator.ts`
  - Репозитории: `server/src/services/chat-core/*-repository.ts`
  - LLM service + провайдеры: `server/src/services/llm/*`
  - Legacy `/api/generate` + `/api/abort/:streamId`: `server/src/routes/generate-routes.ts`

## Какие данные откуда берутся (источники истины)

### Долговременные данные (SQLite через Drizzle)

Схема: `server/src/db/schema.ts`.

- **EntityProfile**
  - Таблица: `entity_profiles`
  - Важное: `specJson` → на фронт приходит как `spec` (в DTO) и используется при рендере system prompt на бэке через Liquid.

- **Chat / Branch**
  - Таблицы: `chats`, `chat_branches`
  - Активная ветка: `chats.activeBranchId`

- **Messages**
  - Таблица: `chat_messages`
  - Канонический текст: `promptText` (в БД `prompt_text`)
  - `blocksJson` сейчас есть в схеме, но поток генерации обновляет в основном `promptText`.

- **MessageVariants (swipe/regenerate/manual edit)**
  - Таблица: `message_variants`
  - Для `assistant` сообщение создаётся вместе с variant (kind=`generation`) и `chat_messages.activeVariantId` указывает на выбранный variant.

- **Generation / Pipeline logging**
  - Таблицы: `llm_generations`, `pipeline_runs`, `pipeline_step_runs`
  - Сейчас это в основном “лог процесса”: pre/llm step + статус.

### Настройки провайдера/токены/рантайм LLM

Таблицы: `llm_providers`, `llm_provider_configs`, `llm_tokens`, `llm_runtime_settings`, `llm_runtime_provider_state`.

- Выбор активного провайдера/модели/токена идёт через `getRuntime("global", ownerId)` в `server/src/services/llm/llm-repository.ts` (используется внутри `server/src/services/llm/llm-service.ts` и chat-core orchestrator).
- UI управляет этим через API `server/src/api/llm.api.ts` (на фронте: `web/src/api/llm.ts`).

### Эфемерные данные (in-memory)

- **Активные генерации (abort)**
  - `server/src/services/chat-core/generation-runtime.ts`: `Map<generationId, AbortController>`
  - Важно: после завершения генерации запись удаляется; после рестарта сервера карта пустая.

## Основной флоу: отправка user-сообщения и получение стрима ассистента (chat-core)

### 1) UI → Effector (frontend)

1. Пользователь жмёт Enter/кнопку.
2. `MessageInput` вызывает `sendMessageRequested({ promptText, role: 'user' })` (`web/src/features/chat-window/input/index.tsx`).
3. `web/src/model/chat-core/index.ts`:
   - проверяет, что есть `currentChat` + `branchId`, что не идёт стрим, и что `promptText` не пустой.
   - создаёт `AbortController` + временные optimistic id:
     - `local_user_${iso}`
     - `local_assistant_${iso}`
   - **optimistic insert**: добавляет в `$messages` user-сообщение и “пустой” assistant-плейсхолдер.

### 2) Frontend → Backend: SSE запрос

Фронт открывает стрим:

- Запрос: `POST /api/chats/:chatId/messages`
- Заголовки:
  - `Accept: text/event-stream`
  - `Content-Type: application/json`
- Тело (минимально в текущем UI):

```json
{
  "branchId": "<activeBranchId>",
  "role": "user",
  "promptText": "<текст пользователя>",
  "settings": {}
}
```

Реализация клиента SSE: `streamChatMessage()` в `web/src/api/chat-core.ts` (читает `response.body.getReader()`, парсит `event:`/`data:` и отдаёт `SseEnvelope`).

### 3) Backend (SSE режим): сохранение + запуск оркестрации

Роут: `server/src/api/chats.core.api.ts`, `POST /chats/:id/messages` при `Accept: text/event-stream`:

1. Валидирует вход.
2. Сохраняет user-сообщение в `chat_messages` (`createChatMessage()`).
3. Создаёт assistant message + variant:
   - `chat_messages(role=assistant, promptText="")`
   - `message_variants(kind=generation, promptText="")`
   - `chat_messages.activeVariantId = variantId`
4. Создаёт `pipeline_runs` (trigger=`user_message`) и `pipeline_step_runs`:
   - `pre` (рендер system prompt)
   - `llm` (сама генерация)
5. Создаёт запись `llm_generations` со статусом `streaming`.
6. Отправляет первое SSE событие **`llm.stream.meta`** (с каноническими id).
7. Запускает `runChatGeneration()` и транслирует наружу `llm.stream.delta|error|done`.

### 4) Сбор prompt на бэке (что реально уходит в LLM)

Оркестратор: `server/src/services/chat-core/orchestrator.ts`, `runChatGeneration()`.

1. Берёт историю из БД:
   - `listMessagesForPrompt({ chatId, branchId, limit=50, excludeMessageIds:[assistantMessageId] })`
   - важное: берётся `chat_messages.promptText` (**уже с учётом выбранного variant**, т.к. это кэш выбранного).
2. Определяет `systemPrompt`:
   - либо уже переданный сверху из `chats.core.api.ts` (в send flow он передаётся)
   - либо сам выбирает template: `pickActivePromptTemplate(...)`
   - рендерит Liquid: `renderLiquidTemplate({ templateText, context: { char, chat, messages, now, ... } })`
3. Формирует prompt как массив `GenerateMessage[]`:
   - `{ role: "system", content: systemPrompt }`
   - `...history (role/content)`
4. Вызывает LLM стрим:
   - `streamGlobalChat({ messages: prompt, settings, abortController })`
   - внутри: выбирается runtime (`activeProviderId`, `activeTokenId`, `activeModel`) и дергается провайдер (например `OpenRouterProvider.streamChat()`).

### 5) Streaming + запись ассистента в БД (flush)

В `runChatGeneration()`:

- Каждый чанк:
  - добавляется в `assistantText`
  - наружу уходит `llm.stream.delta` с `{ content: "<кусок>" }`
- Параллельно включён таймер flush (по умолчанию **750ms**):
  - `updateAssistantText({ assistantMessageId, variantId, text: assistantText })`
  - обновляет **и** `message_variants.promptText`, **и** `chat_messages.promptText` (кэш выбранного варианта).
- На финале:
  - финальный flush
  - `finishGeneration({ status: done|aborted|error, error? })`
  - `llm.stream.done`

### 6) Frontend обработка SSE событий и обновление UI

Effector-обработчик: `handleSseEnvelope` в `web/src/model/chat-core/index.ts`.

- `llm.stream.meta`
  - заменяет optimistic ids на server ids (userMessageId/assistantMessageId)
  - сохраняет `generationId` в `$activeGenerationId`
  - при regenerate также обновляет `activeVariantId` у assistant сообщения и очищает `promptText`
- `llm.stream.delta`
  - накапливает `promptText` у assistant сообщения прямо в `$messages` (чтобы UI обновлялся мгновенно)
- `llm.stream.done`
  - сбрасывает `$activeStream`/`$activeGenerationId`
  - после выхода из цикла делается `loadMessagesFx()` (финальная синхронизация с каноном из БД)

## Формат SSE “по проводу”

На бэке `initSse()` пишет:

- heartbeat: `: ping <ms>\n\n` (клиент игнорирует строки, начинающиеся с `:`)
- событие:
  - `event: <type>\n`
  - `data: <json>\n\n`

Где `<json>` — это envelope:

```ts
type SseEnvelope<T = unknown> = {
  id: string;     // seq внутри соединения
  type: string;   // дублируется с event:
  ts: number;     // Date.now()
  data: T;
};
```

Сейчас реально используются типы:

- `llm.stream.meta`
- `llm.stream.delta`
- `llm.stream.error`
- `llm.stream.done`

## Abort: как работает прерывание генерации

### Abort со стороны UI

`web/src/features/chat-window/input/index.tsx`:

- если `$isChatStreaming === true`, кнопка “Отправить” превращается в “Оборвать” и вызывает `abortRequested()`.

`web/src/model/chat-core/index.ts`:

- делает `stream.controller.abort()` (это abort текущего fetch/SSE на клиенте)
- если уже известен `generationId`, вызывает `POST /api/generations/:id/abort`

### Abort на бэке

`POST /api/generations/:id/abort` (`server/src/api/generations.core.api.ts`):

- ищет `AbortController` по `generationId` в `generation-runtime.ts` и вызывает `abort()`
- если генерация уже завершена/не найдена → 404

Дополнительно: в SSE-роутах (`chats.core.api.ts`, `message-variants.core.api.ts`) стоит `req.on("close", ...)`, который вызывает `abortGeneration(generationId)` при разрыве соединения.

## Regenerate (создание нового variant для assistant)

Frontend:

- инициируется `regenerateVariantRequested({ messageId })`
- открывает SSE: `POST /api/messages/:messageId/regenerate` (`streamRegenerateMessageVariant` в `web/src/api/chat-core.ts`)

Backend (`server/src/api/message-variants.core.api.ts`):

- ограничение v1: regenerate разрешён **только для последнего сообщения в ветке**
- создаёт новый variant `kind=generation`, помечает его selected, очищает кэш `chat_messages.promptText`
- создаёт pipeline run + steps + generation
- шлёт `llm.stream.meta` (userMessageId=null)
- запускает `runChatGeneration()` (замечание: в коде прокидывается `userMessageId: ""`, потому что orchestrator сейчас его не использует)

## Variants: list/select/manual edit

- `GET /api/messages/:id/variants` — список вариантов
- `POST /api/messages/:id/variants/:variantId/select` — выбирает вариант:
  - сбрасывает `isSelected` у остальных
  - ставит `chat_messages.activeVariantId` и копирует `promptText/blocksJson` выбранного варианта в `chat_messages.*` (кэш)
- `POST /api/messages/:id/variants` — manual edit:
  - создаёт новый `manual_edit` variant, делает его selected и обновляет кэш `chat_messages.*`

## Legacy флоу: `POST /api/generate` (в обход chat-core)

Есть второй поток стриминга (используется не во всех местах UI):

- Frontend: `web/src/model/llm-orchestration/stream.ts`
  - `fetch(`${BASE_URL}/generate`, { Accept: text/event-stream, body: { messages, settings, streamId } })`
  - парсит SSE по простому формату `data: {content}|{error}` и `data: [DONE]`
- Backend: `server/src/routes/generate-routes.ts`
  - `POST /api/generate` берёт **готовый массив messages** из тела запроса и стримит результат `streamGlobalChat()`
  - abort: `POST /api/abort/:streamId`

Ключевое отличие: в этом режиме **prompt полностью собирает фронт**, и **нет** привязки к `chats/chat_messages/variants/generations`.

## Расхождения/нюансы относительно `knowledge-base/chat-core-spec.md`

Ниже — не “хотелки”, а именно различия “спека vs текущая реализация”.

- **Два параллельных режима генерации**
  - Спека описывает “backend source of truth” и чат-эндпоинты.
  - В коде одновременно живёт legacy `/api/generate`, где source of truth по prompt — фронт.

- **Settings для LLM в chat-core сейчас фактически не прокинуты из UI**
  - В `runStreamFx` на фронте отправляется `settings: {}` (см. `web/src/model/chat-core/index.ts`).
  - Хотя бэк поддерживает `settings` и пишет их в `llm_generations.paramsJson`.

- **Pipeline как “лог шагов”, без реального исполнения pipeline definition**
  - Есть `pipeline_runs`/`pipeline_step_runs`, но шаги фиксированы (pre + llm), RAG/tool/post сейчас не выполняются.

- **Generation abort хранится в памяти процесса**
  - `POST /generations/:id/abort` работает только пока generation “активна” и пока сервер не перезапущен.

- **Prompt snapshot / token usage не заполняются**
  - В `llm_generations` есть поля `promptSnapshotJson`, `promptTokens`, `completionTokens`, но в текущем коде они не рассчитываются/не пишутся.

- **Regenerate передаёт `userMessageId: ""`**
  - В orchestrator сигнатура требует `userMessageId`, но в regenerate это поле не используется (в коде есть комментарий).

## Диаграмма (sequence) — send user message (chat-core)

```mermaid
sequenceDiagram
  participant UI as web/MessageInput
  participant FE as web/model/chat-core
  participant API as web/api/chat-core.ts
  participant BE as server/api/chats.core.api.ts
  participant ORCH as server/services/chat-core/orchestrator.ts
  participant LLM as server/services/llm/providers/openrouter-provider.ts
  participant DB as SQLite (Drizzle)

  UI->>FE: sendMessageRequested(promptText)
  FE->>FE: optimistic insert (user + assistant placeholder)
  FE->>API: streamChatMessage(POST /api/chats/:id/messages, SSE)
  API->>BE: HTTP(SSE)
  BE->>DB: insert chat_messages(user)
  BE->>DB: insert chat_messages(assistant) + message_variants(generation)
  BE->>DB: insert pipeline_runs + pipeline_step_runs(pre,llm)
  BE->>DB: insert llm_generations(status=streaming)
  BE-->>API: llm.stream.meta({ids,generationId,...})
  API-->>FE: env(type=meta)
  FE->>FE: replace optimistic ids; store generationId
  BE->>ORCH: runChatGeneration(...)
  ORCH->>DB: listMessagesForPrompt(...)
  ORCH->>LLM: streamGlobalChat(prompt, settings, abort)
  loop chunks
    LLM-->>ORCH: delta(content)
    ORCH-->>BE: llm.stream.delta
    BE-->>API: llm.stream.delta
    API-->>FE: env(type=delta)
    FE->>FE: append content to assistant promptText
    ORCH->>DB: updateAssistantText(...) (throttled)
  end
  ORCH->>DB: finishGeneration(status=done|aborted|error)
  ORCH-->>BE: llm.stream.done
  BE-->>API: llm.stream.done
  API-->>FE: env(type=done)
  FE->>DB: (indirect) loadMessagesFx() via API GET /messages
```

