# Code Review: TaleSpinner Backend (Chat-Core Domain)

**Дата:** 2026-01-19
**Версия:** v1 (DB-first architecture)
**Reviewer:** Claude Opus 4.5

---

## Резюме

TaleSpinner реализовал **полноценную рефакторинг бэкенда на DB-first архитектуру** согласно плану `project-revamp-plan.md`. Бэкенд построен по принципам Clean Architecture с чётким разделением слоёв.

### Общая оценка: **7.5/10**

| Аспект | Оценка | Комментарий |
|--------|--------|-------------|
| Архитектура | 8/10 | Clean layers, repository pattern |
| Streaming/SSE | 9/10 | Elegant throttled flushing |
| Type Safety | 9/10 | Full TypeScript + Zod |
| Error Handling | 7/10 | Comprehensive, но есть gaps |
| Performance | 8/10 | Throttling, indexes, heartbeat |
| Security | 6/10 | Missing auth, rate limiting |
| Testing | 3/10 | No automated tests |
| Documentation | 6/10 | Plans есть, JSDoc нет |

### Статус по плану

| Этап | Статус | Прогресс |
|------|--------|----------|
| Этап 0: DTO/Schemas | ✅ Готов | 100% |
| Этап 1: DB Schema | ✅ Готов | 100% |
| Этап 2: Core API | ✅ Готов | 100% |
| Этап 3: Orchestrator + SSE | ✅ Готов | 100% |
| Этап 4: Templates (LiquidJS) | ✅ Готов | 100% |
| Этап 5: Pipelines v1 | ✅ Готов | 100% |
| Этап 6: Frontend cutover | 🟡 В процессе | ~60% |
| Этап 7: Legacy cleanup | ❌ Не начат | 0% |

---

## 1. Архитектура и структура кода

### 1.1 Слои архитектуры

Проект следует **Clean Architecture** с 4 основными слоями:

```
┌─────────────────────────────────────────────────────────┐
│  API Layer (Express Routers)                            │
│  server/src/api/*.core.api.ts                           │
├─────────────────────────────────────────────────────────┤
│  Domain Services (Orchestration, Rendering)             │
│  server/src/services/chat-core/*.ts                     │
├─────────────────────────────────────────────────────────┤
│  Repository Layer (CRUD + Complex Queries)              │
│  server/src/services/chat-core/*-repository.ts          │
├─────────────────────────────────────────────────────────┤
│  Database Layer (Drizzle ORM + SQLite)                  │
│  server/src/db/schema.ts, client.ts                     │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Ключевые файлы по компонентам

#### API Endpoints
| Файл | Описание |
|------|----------|
| `server/src/api/entity-profiles.core.api.ts` | CRUD EntityProfile + import CharSpec |
| `server/src/api/chats.core.api.ts` | Chats, branches, messages + SSE streaming |
| `server/src/api/message-variants.core.api.ts` | Variants, swipes, regenerate |
| `server/src/api/prompt-templates.core.api.ts` | Templates CRUD с scopes |
| `server/src/api/generations.core.api.ts` | Abort generation |
| `server/src/api/pipelines.api.ts` | Pipelines CRUD (DB-first) |

#### Repositories
| Файл | Описание |
|------|----------|
| `server/src/services/chat-core/entity-profiles-repository.ts` | EntityProfile CRUD |
| `server/src/services/chat-core/chats-repository.ts` | Chats + Branches + Messages |
| `server/src/services/chat-core/message-variants-repository.ts` | Variants selection |
| `server/src/services/chat-core/generations-repository.ts` | LLM generations tracking |
| `server/src/services/chat-core/prompt-templates-repository.ts` | Templates с scopes |
| `server/src/services/chat-core/pipelines-repository.ts` | Pipelines storage |
| `server/src/services/chat-core/pipeline-runs-repository.ts` | Pipeline execution logs |

#### Domain Services
| Файл | Описание |
|------|----------|
| `server/src/services/chat-core/orchestrator.ts` | Координация генерации: template → LLM → DB |
| `server/src/services/chat-core/prompt-template-renderer.ts` | LiquidJS rendering |
| `server/src/services/chat-core/generation-runtime.ts` | In-memory registry для abort |
| `server/src/core/sse/sse.ts` | SSE utilities и envelope |

#### Database
| Файл | Описание |
|------|----------|
| `server/src/db/schema.ts` | Drizzle schema (все таблицы) |
| `server/src/db/client.ts` | SQLite connection |
| `server/src/db/apply-migrations.ts` | Auto-migrate при старте |
| `server/drizzle/0004_chat_core_v1.sql` | Greenfield migration |

### 1.3 Оценка архитектуры

**✅ Плюсы:**
- Clean separation of concerns между слоями
- Repository pattern изолирует data access от бизнес-логики
- DTO отделяют DB schema от API contracts
- Dependency injection через параметры функций
- Async/await вместо callbacks
- Явный контроль ошибок через HttpError

**⚠️ Минусы:**
- Отсутствие явных транзакций (последовательные запросы)
- Нет middleware для transaction management
- Runtime state хранится in-memory (теряется при рестарте)
- Нет интерфейсов для мокирования в тестах

---

## 2. Паттерны и реализация

### 2.1 Repository Pattern

Каждая repository возвращает **DTO**, отделяя DB schema от API:

```typescript
// entity-profiles-repository.ts
export type EntityProfileDto = {
  id: string;
  ownerId: string;
  name: string;
  spec: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: typeof entityProfiles.$inferSelect): EntityProfileDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    spec: safeJsonParse(row.specJson, null),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export async function getEntityProfileById(id: string): Promise<EntityProfileDto | null> {
  const rows = await db.select().from(entityProfiles).where(eq(entityProfiles.id, id)).limit(1);
  return rows[0] ? rowToDto(rows[0]) : null;
}
```

**Оценка: 8/10** — хорошее разделение, type-safe через `$inferSelect`.

### 2.2 Generator-based Streaming (Orchestrator)

Элегантное использование AsyncGenerator для streaming с throttled flush:

```typescript
// orchestrator.ts
export async function* runChatGeneration(params: {
  chatId: string;
  userMessageId: string;
  flushMs?: number;
  signal?: AbortSignal;
}): AsyncGenerator<OrchestratorEvent> {

  let assistantText = "";
  let flushing = Promise.resolve();

  // Serialize flush calls (no race conditions)
  const flush = async () => {
    flushing = flushing.then(async () => {
      if (closed) return;
      await updateAssistantText({ variantId, text: assistantText });
    });
    await flushing;
  };

  // Throttled flushing prevents DB write storms
  const timer = setInterval(() => { void flush(); }, params.flushMs ?? 750);

  try {
    for await (const chunk of messageStream) {
      assistantText += chunk.content;
      yield { type: "llm.stream.delta", data: { content: chunk.content } };
    }
  } finally {
    clearInterval(timer);
    await flush(); // Final flush гарантирует consistency
  }
}
```

**Оценка: 9/10** — отличная реализация:
- Serialize все flush calls (no race conditions)
- Throttling предотвращает write storms
- Final flush гарантирует consistency
- Правильный cleanup в finally block

### 2.3 SSE (Server-Sent Events) Envelope

Унифицированный формат SSE событий:

```typescript
// sse.ts
export type SseEnvelope<T = unknown> = {
  id: string;      // unique event id
  type: string;    // event type
  ts: number;      // timestamp
  data: T;         // payload
};

// Event types для chat generation:
// - llm.stream.meta    → { generationId, userMessageId, assistantMessageId, variantId }
// - llm.stream.delta   → { content: string }
// - llm.stream.done    → { finalText: string }
// - llm.stream.error   → { code: string, message: string }
```

**Оценка: 8/10** — чистый envelope с версионированием.

### 2.4 Template Rendering (LiquidJS)

Серверный рендеринг prompt templates:

```typescript
// prompt-template-renderer.ts
export interface PromptTemplateRenderContext {
  char: unknown;           // CharSpec (entityProfile.spec)
  user: unknown;           // User persona (empty in v1)
  chat: unknown;           // Chat metadata
  messages: Array<{        // Conversation history
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  rag: unknown;            // RAG context (empty in v1)
  now: string;             // ISO timestamp
}

export async function renderLiquidTemplate(params: {
  templateText: string;
  context: PromptTemplateRenderContext;
}): Promise<string> {
  const engine = new Liquid();
  const out = await engine.parseAndRender(params.templateText, params.context);
  return typeof out === "string" ? out : String(out);
}
```

**Оценка: 8/10** — работает, но нет валидации template syntax при сохранении.

---

## 3. Database Schema

### 3.1 Таблицы (v1)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ entity_profiles │────<│     chats       │────<│  chat_branches  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               │                        │
                        ┌──────┴──────┐          ┌──────┴──────┐
                        │             │          │             │
                   ┌────▼────┐   ┌────▼────┐   ┌─▼───────────┐
                   │ messages│   │pipelines│   │chat_messages│
                   │_variants│   │         │   └─────────────┘
                   └─────────┘   └────┬────┘          │
                        │            │                │
                   ┌────▼────┐  ┌────▼─────┐   ┌─────▼──────┐
                   │  llm_   │  │pipeline_ │   │  message_  │
                   │generat- │  │  runs    │   │  variants  │
                   │  ions   │  └────┬─────┘   └────────────┘
                   └─────────┘       │
                              ┌──────▼──────┐
                              │pipeline_step│
                              │    _runs    │
                              └─────────────┘

┌─────────────────┐
│prompt_templates │  (scope: global | entity_profile | chat)
└─────────────────┘
```

### 3.2 Ключевые таблицы

| Таблица | Назначение |
|---------|------------|
| `entity_profiles` | Профили персонажей (CharSpec) |
| `chats` | Чаты, привязанные к профилю |
| `chat_branches` | Ветки внутри чата (main + forks) |
| `chat_messages` | Сообщения в ветке |
| `message_variants` | Варианты ответа (swipes) |
| `llm_generations` | Логи генераций LLM |
| `prompt_templates` | Шаблоны промптов с scopes |
| `pipelines` | Определения pipeline'ов |
| `pipeline_runs` | Логи выполнения pipeline |
| `pipeline_step_runs` | Логи шагов pipeline |

### 3.3 Индексы

```sql
-- Оптимизация основных запросов
CREATE INDEX chat_messages_chat_branch_created_at_idx
  ON chat_messages(chat_id, branch_id, created_at);

CREATE INDEX message_variants_message_created_at_idx
  ON message_variants(message_id, created_at);

CREATE INDEX llm_generations_chat_started_at_idx
  ON llm_generations(chat_id, started_at);

CREATE INDEX prompt_templates_scope_enabled_idx
  ON prompt_templates(scope, scope_id, enabled);
```

**Оценка: 8/10** — правильные индексы для основных query patterns.

---

## 4. API Endpoints

### 4.1 Entity Profiles

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/entity-profiles` | Список профилей |
| POST | `/api/entity-profiles` | Создать профиль |
| POST | `/api/entity-profiles/import` | Импорт CharSpec (PNG/JSON) |
| GET | `/api/entity-profiles/:id` | Получить профиль |
| PUT | `/api/entity-profiles/:id` | Обновить профиль |
| DELETE | `/api/entity-profiles/:id` | Удалить профиль |
| GET | `/api/entity-profiles/:id/chats` | Чаты профиля |
| POST | `/api/entity-profiles/:id/chats` | Создать чат |

### 4.2 Chats & Messages

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/chats/:id` | Получить чат |
| DELETE | `/api/chats/:id` | Soft-delete чата |
| GET | `/api/chats/:id/branches` | Список веток |
| POST | `/api/chats/:id/branches` | Создать ветку |
| POST | `/api/chats/:id/branches/:branchId/activate` | Активировать ветку |
| GET | `/api/chats/:id/messages` | Сообщения (с пагинацией) |
| POST | `/api/chats/:id/messages` | Отправить сообщение (+ SSE streaming) |

### 4.3 Variants & Regenerate

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/messages/:id/variants` | Список вариантов |
| POST | `/api/messages/:id/variants/:variantId/select` | Выбрать вариант |
| POST | `/api/messages/:id/regenerate` | Регенерировать (SSE) |

### 4.4 Generations

| Method | Endpoint | Описание |
|--------|----------|----------|
| POST | `/api/generations/:id/abort` | Отменить генерацию |

### 4.5 Templates & Pipelines

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/prompt-templates` | Список шаблонов |
| POST | `/api/prompt-templates` | Создать шаблон |
| PUT | `/api/prompt-templates/:id` | Обновить шаблон |
| DELETE | `/api/prompt-templates/:id` | Удалить шаблон |
| GET | `/api/pipelines` | Список pipelines |
| POST | `/api/pipelines` | Создать pipeline |
| PUT | `/api/pipelines/:id` | Обновить pipeline |
| DELETE | `/api/pipelines/:id` | Удалить pipeline |

---

## 5. Качество кода

### 5.1 Type Safety

**Оценка: 9/10**

✅ **Сильные стороны:**
- Полная типизация TypeScript (strict mode)
- Zod для runtime validation на API границе
- Type inference через `$inferSelect` из Drizzle
- Explicit null handling (`?? null`)

```typescript
// Пример Zod validation
const CreateMessageBody = z.object({
  role: z.enum(["user", "system"]),
  promptText: z.string(),
  branchId: z.string().uuid().optional(),
});

router.post("/chats/:id/messages", asyncHandler(async (req, res) => {
  const body = CreateMessageBody.parse(req.body);
  // ...
}));
```

### 5.2 Error Handling

**Оценка: 7/10**

✅ **Хорошо:**
- `HttpError` класс с statusCode + code + details
- Глобальный `errorHandler` middleware
- Try-finally для cleanup в generators
- Safe JSON parsing: `safeJsonParse(value, fallback)`

⚠️ **Проблемы:**

1. **Недостаточная валидация в некоторых местах:**
```typescript
// api/message-variants.core.api.ts
const [entityProfile, template, history] = await Promise.all([...]);
// Если entityProfile = null, это тихо проходит через fallback
if (template && entityProfile) { ... }  // но что если entityProfile = null?
```

2. **"Best-effort" recovery слишком молчаливый:**
```typescript
try {
  const spec = profile.spec as any;  // Type casting без валидации!
  const firstMes = typeof spec?.first_mes === "string" ? spec.first_mes : "";
} catch {
  // best-effort; don't fail chat creation — но ошибка не логируется!
}
```

3. **Отсутствие retry logic** в critical DB operations

### 5.3 Performance

**Оценка: 8/10**

✅ **Хорошо:**
- **Throttled flushing** (750ms) предотвращает write storms
- **Heartbeat в SSE** (15s) предотвращает timeout
- **Правильные индексы** для основных queries
- **Promise.all** для параллельных независимых запросов

⚠️ **Потенциальные проблемы:**

1. **N+1 в pickActivePromptTemplate:**
```typescript
// Может быть 3+ queries для выбора template по scope
const chatTemplate = await getTemplateByScope("chat", chatId);
const profileTemplate = await getTemplateByScope("entity_profile", profileId);
const globalTemplate = await getTemplateByScope("global", "global");
```

2. **Hardcoded pagination limit:**
```typescript
limit: 50,  // Что если user хочет читать 1000+ сообщений?
```

3. **In-memory generation registry без cleanup:**
```typescript
const active = new Map<string, RuntimeEntry>();
// Нет TTL — potential memory leak при долгой работе
```

---

## 6. Проблемы и технический долг

### 6.1 Critical Issues

| # | Проблема | Серьёзность | Описание |
|---|----------|-------------|----------|
| 1 | **Non-atomic operations** | 🔴 High | `createChat()` делает 3 INSERT без транзакции |
| 2 | **In-memory registry TTL** | 🟠 Medium | Generation registry может расти unbounded |
| 3 | **No rollback on failure** | 🟠 Medium | Если step fails, состояние может быть inconsistent |
| 4 | **Hardcoded "global" ownerId** | 🟠 Medium | Не готово к multi-tenant |

### 6.2 Примеры проблемного кода

#### Issue #1: Non-atomic chat creation

```typescript
// chats-repository.ts
export async function createChat(params: {...}): Promise<{chat, mainBranch}> {
  // Step 1: Insert chat
  await db.insert(chats).values({...});

  // Step 2: Insert main branch
  await db.insert(chatBranches).values({...});

  // Step 3: Update chat with activeBranchId
  await db.update(chats).set({ activeBranchId }).where(...);

  // ❌ BUG: Если step 2 или 3 fails, step 1 уже выполнен!
  // Результат: orphaned chat без branch
}
```

**Рекомендация:**
```typescript
// Использовать SQLite transaction
import { sql } from "drizzle-orm";

export async function createChat(params: {...}) {
  return await db.transaction(async (tx) => {
    const [chat] = await tx.insert(chats).values({...}).returning();
    const [branch] = await tx.insert(chatBranches).values({...}).returning();
    await tx.update(chats).set({ activeBranchId: branch.id }).where(...);
    return { chat, mainBranch: branch };
  });
}
```

#### Issue #2: Unsafe variant selection

```typescript
// message-variants-repository.ts
export async function selectVariant(params: {...}) {
  // Step 1: Deselect all variants
  await db.update(messageVariants)
    .set({ isSelected: false })
    .where(eq(messageVariants.messageId, params.messageId));

  // Step 2: Select target variant
  await db.update(messageVariants)
    .set({ isSelected: true })
    .where(eq(messageVariants.id, params.variantId));

  // ❌ BUG: Если step 2 fails, все variants deselected!
}
```

#### Issue #3: Type casting без валидации

```typescript
// api/entity-profiles.core.api.ts
const spec = profile.spec as any;  // 🔴 Dangerous!
const firstMes = typeof spec?.first_mes === "string" ? spec.first_mes : "";
// Если spec=null или spec={}, это пройдёт без ошибки и логирования
```

### 6.3 Security Issues

| # | Проблема | Серьёзность |
|---|----------|-------------|
| 1 | Отсутствие ownerId validation | 🔴 High (для multi-tenant) |
| 2 | Нет rate limiting на SSE endpoints | 🟠 Medium |
| 3 | `spec: z.unknown()` принимает любой JSON | 🟡 Low |
| 4 | Нет maxLength validation на input strings | 🟡 Low |

```typescript
// Текущее состояние — всегда "global"
const profiles = await listEntityProfiles({ ownerId: "global" });

// Нужно для multi-tenant
const profiles = await listEntityProfiles({ ownerId: req.user.id });
```

---

## 7. Что хорошо реализовано

### 7.1 Streaming Architecture (9/10)

Orchestrator реализует streaming с правильным resource management:

```typescript
// Последовательность событий SSE:
// 1. llm.stream.meta    → { generationId, assistantMessageId, variantId }
// 2. llm.stream.delta   → { content: "Привет" }
// 3. llm.stream.delta   → { content: ", как" }
// 4. llm.stream.delta   → { content: " дела?" }
// 5. llm.stream.done    → { finalText: "Привет, как дела?" }

// Throttled flush каждые 750ms → DB не перегружена
// Final flush в finally → данные не теряются
// Heartbeat каждые 15s → connection не timeout'ится
```

### 7.2 Pipeline Run Logging (8/10)

Каждый SSE request создаёт полный trace:

```typescript
// Создаётся:
// 1. pipeline_run (status: running)
// 2. pipeline_step_run (step: "pre", status: done)
// 3. pipeline_step_run (step: "llm", status: running)
// 4. llm_generation (status: streaming)

// По завершении:
// 5. llm_generation (status: done, tokens: {...})
// 6. pipeline_step_run (step: "llm", status: done)
// 7. pipeline_run (status: done)
```

Это даёт:
- Полную трассировку каждого LLM request
- Возможность отладки bottlenecks
- Основу для metrics/analytics

### 7.3 Template Scopes (8/10)

Правильная иерархия переопределения:

```
chat template (если есть)
    ↓ fallback
entity_profile template (если есть)
    ↓ fallback
global template (если есть)
    ↓ fallback
hardcoded default system prompt
```

```typescript
export async function pickActivePromptTemplate(params: {
  chatId: string;
  entityProfileId: string;
}): Promise<PromptTemplateDto | null> {
  // 1. Try chat-level
  const chatTemplate = await getEnabledTemplate("chat", params.chatId);
  if (chatTemplate) return chatTemplate;

  // 2. Try entity_profile-level
  const profileTemplate = await getEnabledTemplate("entity_profile", params.entityProfileId);
  if (profileTemplate) return profileTemplate;

  // 3. Try global
  return await getEnabledTemplate("global", "global");
}
```

---

## 8. Рекомендации

### 8.1 Приоритет High

| # | Задача | Оценка трудозатрат |
|---|--------|-------------------|
| 1 | Добавить transaction support для atomic операций | 4-6 часов |
| 2 | Написать integration tests для core flows | 8-12 часов |
| 3 | Добавить TTL cleanup для generation registry | 2 часа |

**Transaction support:**
```typescript
// drizzle поддерживает transactions из коробки
await db.transaction(async (tx) => {
  await tx.insert(...);
  await tx.update(...);
  // Если любой шаг fails, всё откатывается
});
```

**Integration tests:**
```typescript
describe("Chat Generation Flow", () => {
  it("should create user message, generate response, save to DB", async () => {
    // 1. Create entity profile
    // 2. Create chat
    // 3. POST /chats/:id/messages with SSE
    // 4. Verify: user message in DB
    // 5. Verify: assistant message in DB
    // 6. Verify: variant created and selected
    // 7. Verify: generation logged
  });
});
```

### 8.2 Приоритет Medium

| # | Задача | Оценка трудозатрат |
|---|--------|-------------------|
| 4 | Завершить Этап 6 (multi-chat + branches UI) | 16-24 часа |
| 5 | Добавить input validation (maxLength) | 2 часа |
| 6 | Добавить rate limiting на SSE endpoints | 4 часа |

### 8.3 Приоритет Low

| # | Задача | Оценка трудозатрат |
|---|--------|-------------------|
| 7 | Добавить JSDoc на public functions | 2-3 часа |
| 8 | Cleanup legacy кода (Этап 7) | 8 часов |
| 9 | Template syntax validation при сохранении | 2 часа |

---

## 9. Заключение

### Сильные стороны проекта

1. **Архитектура** следует плану и Clean Architecture принципам
2. **Streaming** реализован elegantly с proper resource management
3. **DB-first approach** полностью внедрён (Этапы 1-5)
4. **Repository pattern** обеспечивает хорошую тестируемость
5. **Type safety** через TypeScript + Zod на всех границах

### Основные риски

1. ⚠️ **No transactions** — data consistency at risk
2. ⚠️ **No integration tests** — changes may break core flows
3. ⚠️ **In-memory registries unbounded** — potential memory leak
4. ⚠️ **Frontend 40% incomplete** — can't fully test backend

### Оценка готовности

| Метрика | Оценка |
|---------|--------|
| **Production readiness** | 6.5/10 |
| **Code quality** | 7.5/10 |
| **Architecture** | 8/10 |
| **Feature completeness** | 7/10 |

**Вывод:** Core функционал готов и работает. Для production нужны:
1. Transactions для atomic операций
2. Integration tests
3. Завершение Этапа 6 (frontend cutover)
4. Cleanup legacy кода (Этап 7)

---

## Приложение A: Checklist для Production

- [ ] Transaction support для createChat, selectVariant, createMessage+Generation
- [ ] Integration tests для: send message → stream → save flow
- [ ] TTL cleanup для generation-runtime registry
- [ ] Rate limiting на `/chats/:id/messages` (SSE)
- [ ] Input validation: maxLength на promptText (например 100KB)
- [ ] Logging: структурированные логи для debugging
- [ ] Monitoring: метрики для generation latency, error rate
- [ ] Завершить Этап 6: multi-chat UI, branches UI, edit/delete
- [ ] Этап 7: удалить legacy JSON storage и старые endpoints

## Приложение B: Файлы для изучения

### Core Domain
- `server/src/services/chat-core/orchestrator.ts` — главный orchestration logic
- `server/src/services/chat-core/chats-repository.ts` — CRUD для chats/branches/messages
- `server/src/api/chats.core.api.ts` — API endpoints + SSE streaming

### Supporting
- `server/src/db/schema.ts` — полная DB schema
- `server/src/core/sse/sse.ts` — SSE utilities
- `server/src/chat-core/schemas.ts` — Zod schemas
