# Backend guide: chat storage + LLM request flow (TaleSpinner v1)

_Дата: 2026‑01‑28. Состояние соответствует текущему коду в ветке repo на момент чтения. Этот документ — “как сейчас работает”, не “как должно быть”._

## TL;DR

- **Сообщения чата хранятся в SQLite** (Drizzle schema `server/src/db/schema/chat-core.ts`) в таблице `chat_messages`.
- **В LLM уходит упрощённый массив** `GenerateMessage[]` вида `{ role, content }` (тип `shared/types/generate.ts`).
- **`content` берётся из `chat_messages.promptText`** (и фильтруются удалённые/пустые сообщения).
- **Стриминг** идёт через `services/llm/*` → провайдер (`openrouter` / `custom_openai`) → OpenAI SDK (`client.chat.completions.create(..., stream: true)`).
- **Ответ ассистента пишется в БД постепенно** (flush) в `message_variants.promptText` + кэш в `chat_messages.promptText`.

---

## 1) Где что лежит в коде (карта файлов)

### Хранилище чатов/сообщений

- **DB schema**: `server/src/db/schema/chat-core.ts`
  - `chats`
  - `chat_branches`
  - `chat_messages`
  - `message_variants`
- **Репозиторий чата**: `server/src/services/chat-core/chats-repository.ts`
  - создание сообщений
  - чтение истории
  - обновление текста ассистента (и вариантов)

### Сбор prompt/messages и запуск генерации

- **Оркестратор генерации**: `server/src/services/chat-core/orchestrator.ts`
  - берёт историю, собирает `GenerateMessage[]`
  - запускает LLM стрим и пишет результат в БД
- **Сбор draft/prompts для пайплайнов** (v1): `server/src/services/chat-core/prompt-draft-builder.ts`
  - добавляет artifacts, делает snapshot/hash, мапит `developer -> system` для LLM

### LLM слой

- **Выбор провайдера/токена/модели и прокси‑стрим**: `server/src/services/llm/llm-service.ts`
- **Провайдеры**:
  - OpenRouter: `server/src/services/llm/providers/openrouter-provider.ts`
  - Custom OpenAI‑compatible: `server/src/services/llm/providers/custom-openai-provider.ts`

### Legacy (важно не перепутать)

- `server/src/services/open-router-service.ts` — старая реализация с чтением `data/config/openrouter.json`.
- `server/src/api/llm.api.ts` явно глушит legacy endpoint `/config/openrouter` (410).

---

## 2) Как выглядят данные “для LLM”

### Тип сообщения, который реально уходит в API

Файл: `shared/types/generate.ts`

```ts
export type GenerateMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
```

Это важный “срез”: **никаких tool calls, name, multimodal parts и т.п.** сейчас тут нет. Только роль + текст.

---

## 3) Как в БД хранятся сообщения чата

Файл схемы: `server/src/db/schema/chat-core.ts`

### Таблица `chat_messages` (основная)

Ключевые поля:

- **`id`**: идентификатор сообщения.
- **`chatId` / `branchId`**: к какому чату и ветке относится.
- **`role`**: `"user" | "assistant" | "system"`.
- **`createdAt`**: timestamp.
- **`promptText`**: основной текст сообщения (см. ниже подробный разбор).
- **`format`**: строка‑метка формата представления (см. ниже).
- **`blocksJson`**: JSON‑строка со “структурированными блоками” (см. ниже).
- **`metaJson`**: JSON‑строка с произвольной метой (в т.ч. soft delete).
- **`activeVariantId`**: выбранный вариант (для assistant; “свайпы/регенерации”).

### Таблица `message_variants` (варианты для одного сообщения)

Используется в основном для assistant‑сообщений:

- **`messageId`**: ссылка на `chat_messages.id`.
- **`kind`**: `"generation" | "manual_edit" | "import" | ...` (источник варианта).
- **`promptText` / `blocksJson` / `metaJson`**: содержимое конкретного варианта.
- **`isSelected`**: выбранный вариант.

### Как устроен кэш

В `chat_messages` хранится:

- `activeVariantId` = какой вариант выбран
- `promptText` = **кэш выбранного варианта** (чтобы быстро читать ленту без join’ов)

Когда идёт генерация, код обновляет:

- `message_variants.promptText` (конкретный вариант)
- **и** `chat_messages.promptText` (кэш) + `chat_messages.activeVariantId`

См. `updateAssistantText()` в `server/src/services/chat-core/chats-repository.ts`.

---

## 4) Подробно про `promptText`, `format`, `blocksJson`

Ниже — трактовка “как сейчас в коде”, плюс “какой смысл, судя по именам/направлению”.

### 4.1 `promptText`

**Что это:** основное **текстовое представление** сообщения, которое:

- показывается в UI (в простом сценарии),
- и **именно оно** превращается в `GenerateMessage.content` для LLM.

**Где используется для LLM:**

`listMessagesForPrompt()` читает историю и возвращает:

- `role: chat_messages.role`
- `content: chat_messages.promptText`

Дополнительно:

- сообщения с пустым/пробельным `promptText` выбрасываются,
- удалённые сообщения исключаются по `metaJson.deleted` / `metaJson.deletedAt`,
- можно исключить конкретные ids (например, чтобы не отправлять “пустую болванку” ассистента при регенерации).

**Практический смысл:** сейчас “LLM видит” ровно ту плоскую текстовую историю, которая лежит в `promptText`.

### 4.2 `format`

**Что это:** метка/строка, которая должна описывать **как интерпретировать** содержимое сообщения.

По коду это поле:

- есть в схеме (`chat_messages.format`),
- прокидывается в DTO,
- выставляется при создании сообщения (`createChatMessage` принимает optional `format`),
- но **в текущем LLM‑пути почти не участвует**: в prompt в LLM идёт только `promptText`.

**Какая идея:** обычно `format` нужен, чтобы различать, например:

- `"text"` — простой текст
- `"markdown"` — markdown‑текст (рендерить иначе)
- `"json"` — JSON‑payload (показывать как код/структуру)
- `"blocks"` — “главное” хранится в `blocksJson`, а `promptText` — derived/preview

**Важно:** даже если `format="json"`, сейчас LLM всё равно получит `promptText` как обычную строку.

### 4.3 `blocksJson` (в вопросе “blacksJson” — это оно)

**Что это:** JSON‑строка (в БД `text`), которая хранит **массив блоков** (`unknown[]` на уровне репозитория).

В `chats-repository.ts` это читается как:

- `blocks: safeJsonParse(row.blocksJson, [])`

и пишется как:

- `blocksJson: safeJsonStringify(params.blocks ?? [], "[]")`

**Текущее состояние:** по основному LLM‑пути `blocksJson` сейчас **не участвует** в формировании prompt. То есть:

- можно хранить структурные данные для UI,
- но в LLM они попадут только если кто‑то отдельно конвертирует блоки в текст и положит это в `promptText`.

**Зачем это нужно архитектурно:** `blocksJson` обычно делают для:

- мультимодальных сообщений/частей (текст + картинки + “карточки”),
- richer UI (разные типы кусочков),
- пост‑процессинга (например, извлечь “артефакты” или “сцены” в отдельные блоки).

---

## 5) Откуда берётся история для LLM (и что именно берётся)

### 5.1 Чтение истории

Функция: `listMessagesForPrompt()` в `server/src/services/chat-core/chats-repository.ts`.

Логика (важные моменты):

- берём сообщения конкретного `chatId + branchId`
- сортируем по времени/ид, затем разворачиваем в **oldest → newest**
- исключаем ids из `excludeMessageIds`
- исключаем “удалённые” через `metaJson`
- возвращаем `{ role, content: promptText }` и фильтруем пустые

### 5.2 Сбор prompt в оркестраторе

Файл: `server/src/services/chat-core/orchestrator.ts`

Если `promptMessages` не передали извне, оркестратор:

- строит `systemPrompt` (дефолт или из шаблона через `renderLiquidTemplate`)
- создаёт массив:
  - `[{ role: "system", content: systemPrompt }, ...history]`
- передаёт в `streamGlobalChat({ messages: prompt, settings, ... })`

---

## 6) Как уходит запрос в OpenRouter/OpenAI API

### 6.1 Выбор провайдера/токена/модели

Файл: `server/src/services/llm/llm-service.ts`

- runtime (activeProviderId/activeTokenId/activeModel) берётся из БД (`llm-repository`)
- токен читается из хранилища токенов (в БД)
- конфиг провайдера читается из БД
- дальше вызывается `provider.streamChat(...)`

### 6.2 OpenRouter provider

Файл: `server/src/services/llm/providers/openrouter-provider.ts`

Суть:

- создаётся `OpenAI` клиент с `baseURL = https://openrouter.ai/api/v1`
- формируется payload:
  - `model`
  - `messages: [{ role, content }, ...]` (прямой маппинг)
  - `...settings` (температура и прочие параметры)
  - `stream: true`
- читаются чанки стрима: `chunk.choices[0].delta.content`

### 6.3 Custom OpenAI provider

Файл: `server/src/services/llm/providers/custom-openai-provider.ts`

Почти то же самое, только:

- `baseURL` берётся из конфига (и нормализуется, чтобы без `/` в конце)
- `GET /models` идёт по `${baseUrl}/models`

---

## 7) Как стрим “приземляется” обратно в чат

Файл: `server/src/services/chat-core/orchestrator.ts`

Поведение:

- оркестратор инициализирует `assistantText = ""`
- запускает таймер `flush` (по умолчанию ~750ms)
- в цикле `for await` по LLM‑стриму:
  - добавляет `chunk.content` в `assistantText`
  - отдаёт событие стрима наружу
- на flush (и в finally финально) пишет текст в БД через:
  - `updateAssistantText({ assistantMessageId, variantId, text })`

Это значит, что во время генерации:

- в `message_variants.promptText` растёт текст текущей генерации,
- и параллельно обновляется кэш `chat_messages.promptText`.

---

## 8) Как “свайпы/варианты” связаны с генерацией

Важная модель данных:

- один логический message (`chat_messages`) может иметь несколько вариантов (`message_variants`)
- выбранный вариант отмечается `isSelected=true` и дублируется в `chat_messages.promptText`

Генерация создаёт новый assistant message + variant (kind=`generation`) и постепенно наполняет именно этот variant.

---

## 9) Отдельно: `prompt-draft-builder` и роль `developer`

Файл: `server/src/services/chat-core/prompt-draft-builder.ts`

Там есть явное правило:

- **для LLM API роль `developer` мапится в `system`**

Это нужно, потому что `GenerateMessage.role` допускает только `system|user|assistant`.

Также builder умеет:

- подключать “artifacts” в prompt (как system prepend, как отдельные сообщения и т.д.)
- считать `promptHash`
- делать redacted snapshot (обрезки по размеру) для дебага/воспроизводимости

---

## 10) Практические выводы (что важно помнить при разработке)

- **LLM получает только `promptText`.** Если UI хранит что‑то сложнее в `blocksJson`, оно не попадёт в LLM, пока не будет сериализовано в `promptText` или отдельным шагом pipeline.
- **`format` сейчас влияет скорее на UI/интерпретацию**, но не на LLM запрос.
- **Для assistant сообщений есть два слоя хранения**: `message_variants` (истина) и `chat_messages.promptText` (кэш выбранного варианта).
- **Legacy OpenRouterService** лучше не трогать для новой логики; актуальный путь — через `services/llm/providers/*`.

---

## 11) Быстрый “текстовый diagram” флоу

```
UI -> (создаём user message в chat_messages)
   -> (создаём пустой assistant message + variant)
   -> runChatGeneration()
      -> listMessagesForPrompt() -> [{role, content(promptText)}...]
      -> + system prompt
      -> streamGlobalChat()
         -> getRuntime() -> providerId/token/model
         -> provider.streamChat()
            -> OpenAI SDK: chat.completions.create({model, messages, ...settings, stream:true})
            -> for await chunk -> delta.content
      -> flush updateAssistantText() -> message_variants.promptText + chat_messages.promptText(cache)
```

