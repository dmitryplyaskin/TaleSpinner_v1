# Spec: Chat Entries / Variants / Parts + UI/Prompt Projections

_Дата: 2026‑02‑01 (rev.2)_

Этот документ описывает целевую модель хранения и обработки "сообщений" в TaleSpinner: **сообщение как контейнер**, контент как **набор частей (parts)**, а UI и LLM prompt — как **две независимые проекции** одних и тех же данных.

---

## 1) Цели

- **Единый источник истины** для контента: структурированные части (`parts`), а не плоский `promptText`.
- **Разделение ответственности**:
  - **UI projection**: что показываем пользователю.
  - **Prompt projection**: что отправляем в LLM на следующем ходе.
- **Расширяемость**: новый "кастомный блок" не требует нового enum/типа данных. Достаточно указать:
  - как его **рендерить в UI** (`ui.rendererId`),
  - как его **сериализовать в prompt** (`prompt.serializerId`),
  - и какие у него **policies** (visibility + lifespan).
- **Контроль релевантности**: части могут иметь **lifespan (TTL в ходах)**, чтобы не засорять prompt и UI.
- **Поддержка вариантов** (swipe/regen/manual edit): несколько `variants` на одну запись таймлайна.
- **Поддержка агентов**: агенты могут добавлять/заменять части во время хода.

---

## 2) Терминология

- **Chat**: разговор.
- **Branch**: ветка истории в чате.
- **Turn**: монотонно возрастающий счетчик количества generate-запросов к LLM в рамках Branch. Инкрементируется при каждом вызове LLM (включая retry/regen). Используется для расчета TTL.
- **Entry**: элемент таймлайна (то, что пользователь воспринимает как "сообщение").
- **Role**: дискурсивная роль Entry в диалоге: `system | user | assistant`. Определяет "кто говорит" с точки зрения LLM API.
- **Variant**: конкретная версия контента Entry. Мутабельна во время хода (агенты могут добавлять/изменять parts). Свайп = создание нового Variant.
- **Part**: атомарный кусок контента внутри Variant (ключевая сущность).
- **Projection**:
  - **UI projection**: отображение Entry в интерфейсе.
  - **Prompt projection**: сборка итогового массива сообщений для LLM.

**Ключевая идея**: Entry/Variant — контейнер, Part — смысловая единица, Prompt/UI — проекции.

---

## 3) Модель данных

### 3.1 Entry (таймлайн контейнер)

```typescript
interface Entry {
  entryId: string
  chatId: string
  branchId: string
  role: "system" | "user" | "assistant"
  createdAt: number
  activeVariantId: string
  
  // Soft delete
  softDeleted?: boolean
  softDeletedAt?: number
  softDeletedBy?: "user" | "agent"
  
  // Meta (опционально)
  meta?: {
    imported?: boolean
    pinned?: boolean
    // ...
  }
}
```

**Важно**: Если `Entry.softDeleted = true`, все Parts внутри автоматически исключаются из проекций. Проверять Parts не нужно.

### 3.2 Variant (контейнер контента)

```typescript
interface Variant {
  variantId: string
  entryId: string
  kind: "generation" | "manual_edit" | "import"
  createdAt: number
  parts: Part[]
  
  // Derived (опционально): кэши/снапшоты
  derived?: {
    promptHash?: string
    // ...
  }
}
```

**Жизненный цикл Variant**:
- Создается при генерации, ручном редактировании или импорте
- **Мутабельна во время хода**: агенты могут добавлять/заменять parts
- **Свайп** (regen) = создание нового Variant
- `activeVariantId` в Entry указывает на текущий отображаемый Variant

### 3.3 Part (атомарный блок контента)

```typescript
interface Part {
  // === Идентичность ===
  partId: string
  channel: "main" | "reasoning" | "aux" | "trace"
  order: number  // позиция при сериализации/рендеринге, main = 0
  
  // === Данные ===
  payload: string | object
  payloadFormat: "text" | "markdown" | "json"
  schemaId?: string   // идентификатор схемы для JSON (например "talespinner/world-state@v1")
  label?: string      // человеко-читаемое имя для UI (например "World state")
  
  // === Visibility ===
  visibility: {
    ui: "always" | "debug" | "never"
    prompt: boolean
  }
  
  // === UI presentation ===
  ui?: {
    rendererId: string                    // "text", "markdown", "card", "json", custom...
    props?: Record<string, unknown>       // настройки рендера
  }
  
  // === Prompt serialization ===
  prompt?: {
    serializerId: string                  // "asText", "asMarkdown", "asJson", "asXmlTag"...
    props?: Record<string, unknown>       // настройки сериализации (например { tagName: "think" })
  }
  
  // === Lifespan (TTL) ===
  lifespan: "infinite" | { turns: number }
  createdTurn: number
  
  // === Provenance (происхождение) ===
  source: "llm" | "agent" | "user" | "import"
  agentId?: string
  model?: string
  requestId?: string
  
  // === Replacement (для override механизма) ===
  replacesPartId?: string   // если эта часть заменяет другую
  
  // === Soft delete ===
  softDeleted?: boolean
  softDeletedAt?: number
  softDeletedBy?: "user" | "agent"
  
  // === Tags (опционально) ===
  tags?: string[]
}
```

---

## 4) Channel — категоризация частей

Channel определяет **как рендерить часть на фронтенде** и какой UI-компонент использовать.

| Channel | Назначение | Структура рендеринга |
|---------|------------|---------------------|
| `main` | Основной ответ LLM. Базовая точка, от которой "пляшем". | Жесткая |
| `reasoning` | Мышление модели (нативное `<think>` или кастомное через промпты). | Жесткая |
| `aux` | Вспомогательные блоки: world state, character stats, agent results, etc. | Гибкая (кастомный UI по шаблону) |
| `trace` | Технические логи, debug информация. | Жесткая |

**Инварианты**:
- В Variant assistant Entry должен быть **ровно один активный Part с `channel="main"`** (основной ответ).
- `main` имеет `order=0`. Остальные части располагаются до (`order < 0`) или после (`order > 0`).

---

## 5) Order — порядок частей

`order: number` определяет позицию части при сериализации в prompt и рендеринге в UI.

```
order=-20  │  Reasoning (думалка)
order=-10  │  Pre-context injection
order=0    │  Main (основной ответ) ← базовая точка
order=10   │  Character stats
order=20   │  World state
order=30   │  Hidden plot hint
```

**Правила**:
- `main` всегда имеет `order=0`
- Parts с меньшим `order` идут раньше
- При равном `order` — сортировка по `partId` (стабильная)

---

## 6) Replacement — механизм замены частей

Агенты могут "переделывать" существующие части (например, стилизация текста, перевод).

**Механизм**:
1. Агент создает новый Part с `replacesPartId` указывающим на заменяемую часть
2. Оригинальная часть остается в данных, но игнорируется при проекциях
3. В debug режиме можно посмотреть оригинал

```typescript
// Оригинальный ответ LLM
{ partId: "abc", channel: "main", payload: "Dry technical text..." }

// Агент стилизации создает замену
{ partId: "xyz", channel: "main", replacesPartId: "abc", payload: "Beautiful prose..." }
```

**При проекции**: Part "abc" игнорируется (заменен "xyz"), показываем только "xyz".

---

## 7) Visibility — управление отображением

```typescript
visibility: {
  ui: "always" | "debug" | "never"
  prompt: boolean
}
```

| `ui` значение | Поведение |
|---------------|-----------|
| `"always"` | Показывать всегда |
| `"debug"` | Показывать только в debug режиме |
| `"never"` | Не показывать |

**Примечание**: `visibility` — это **политика** (как Part задуман). `softDeleted` — это **состояние** (скрыт ли Part сейчас).

---

## 8) Lifespan (TTL) — время жизни части

TTL определяет сколько ходов часть остается активной.

```typescript
lifespan: "infinite" | { turns: number }
createdTurn: number
```

**Проверка TTL** (динамическая, при каждой проекции):
```typescript
function isTTLExpired(part: Part, currentTurn: number): boolean {
  if (part.lifespan === "infinite") return false
  return currentTurn - part.createdTurn >= part.lifespan.turns
}
```

**Важно**: TTL влияет на **prompt И UI**. Истекшие части пропускаются в обеих проекциях. Данные остаются в БД (доступны в debug/истории).

---

## 9) Soft Delete — мягкое удаление

Soft delete скрывает данные без физического удаления из БД.

### Иерархия (верхний уровень приоритетнее)

```
Entry.softDeleted = true  →  Все Parts игнорируются (не проверяем их)
Entry.softDeleted = false →  Проверяем Part.softDeleted
```

### Применение

- **User**: может скрыть Entry или Part вручную
- **Agent**: например, агент суммаризации скрывает старые сообщения после создания summary

### Hard Delete

Физическое удаление из БД — отдельная операция (garbage collection, по запросу пользователя).

---

## 10) Provenance — происхождение части

```typescript
source: "llm" | "agent" | "user" | "import"
```

| Source | Описание |
|--------|----------|
| `llm` | Прямой результат вызова LLM |
| `agent` | Результат работы агента (может внутри вызывать LLM) |
| `user` | Ручной ввод/редактирование пользователем |
| `import` | Импортировано из внешнего источника |

**Разница между `Entry.role` и `Part.source`**:
- `Entry.role` — **дискурсивная роль**: кто говорит в диалоге (для LLM API)
- `Part.source` — **провенанс**: кто технически создал контент

Пример: Entry с `role="assistant"` может содержать Part с `source="agent"` (агент создал часть ответа ассистента).

---

## 11) UI Projection (как отображаем)

### Алгоритм

```typescript
function getUIProjection(entry: Entry, variant: Variant, currentTurn: number): Part[] {
  // 1. Entry level check
  if (entry.softDeleted) return []
  
  // 2. Filter parts
  return variant.parts.filter(part => {
    // Soft delete
    if (part.softDeleted) return false
    
    // Replacement check
    if (isReplaced(part, variant.parts)) return false
    
    // TTL check
    if (isTTLExpired(part, currentTurn)) return false
    
    // Visibility check
    return part.visibility.ui === "always" 
        || (part.visibility.ui === "debug" && isDebugMode())
  })
  .sort((a, b) => a.order - b.order)
}
```

### Рендеринг

- Таблица UI-рендереров по `part.ui.rendererId`
- Дефолтный рендерер для неизвестных `rendererId`
- Channel определяет какой UI-компонент использовать (reasoning, aux имеют разную логику рендеринга)

---

## 12) Prompt Projection (как собираем prompt)

PromptBuilder строит `GenerateMessage[]` (совместимо с OpenAI/OpenRouter: `{ role, content }`).

### Алгоритм

```typescript
function getPromptProjection(entries: Entry[], currentTurn: number): GenerateMessage[] {
  const messages: GenerateMessage[] = []
  
  for (const entry of entries) {
    // 1. Entry level check
    if (entry.softDeleted) continue
    
    const variant = getActiveVariant(entry)
    
    // 2. Filter parts
    const parts = variant.parts.filter(part => {
      if (part.softDeleted) return false
      if (isReplaced(part, variant.parts)) return false
      if (isTTLExpired(part, currentTurn)) return false
      return part.visibility.prompt === true
    })
    .sort((a, b) => a.order - b.order)
    
    // 3. Serialize parts into message content
    const content = parts
      .map(part => serializePart(part))
      .join("\n\n")
    
    if (content) {
      messages.push({ role: entry.role, content })
    }
  }
  
  return messages
}

function serializePart(part: Part): string {
  const serializer = getSerializer(part.prompt?.serializerId ?? "asText")
  return serializer(part.payload, part.prompt?.props)
}
```

### Сериализаторы

| serializerId | Описание |
|--------------|----------|
| `asText` | Payload как plain text |
| `asMarkdown` | Payload с markdown форматированием |
| `asJson` | Payload как JSON строка |
| `asXmlTag` | Payload обернутый в XML тег (настраивается через `props.tagName`) |

---

## 13) Примеры конфигураций

### 13.1 Main result (LLM ответ)

```typescript
{
  channel: "main",
  order: 0,
  source: "llm",
  visibility: { ui: "always", prompt: true },
  lifespan: "infinite"
}
```

### 13.2 Reasoning / `<think>` (скрытые рассуждения)

```typescript
{
  channel: "reasoning",
  order: -20,
  source: "llm",
  visibility: { ui: "debug", prompt: false },
  lifespan: "infinite"
}
```

### 13.3 World state (нужен и в prompt, и в UI)

```typescript
{
  channel: "aux",
  order: 20,
  label: "World state",
  schemaId: "talespinner/world-state@v1",
  source: "agent",
  ui: { rendererId: "card" },
  prompt: { serializerId: "asXmlTag", props: { tagName: "world_state" } },
  visibility: { ui: "always", prompt: true },
  lifespan: { turns: 3 }
}
```

### 13.4 Скрытый plot hint (модель знает, юзер — нет)

```typescript
{
  channel: "aux",
  order: 30,
  label: "Plot hint",
  source: "agent",
  visibility: { ui: "never", prompt: true },
  prompt: { serializerId: "asText" },
  lifespan: { turns: 1 }
}
```

### 13.5 Стилизованный ответ (override main)

```typescript
// Оригинал от LLM
{
  partId: "orig-123",
  channel: "main",
  order: 0,
  source: "llm",
  payload: "The system encountered an error state.",
  visibility: { ui: "always", prompt: true }
}

// Стилизация от агента
{
  partId: "styled-456",
  channel: "main",
  order: 0,
  source: "agent",
  agentId: "prose-stylist",
  replacesPartId: "orig-123",
  payload: "A shadow of uncertainty crept across the machine's consciousness...",
  visibility: { ui: "always", prompt: true }
}
```

---

## 14) Инварианты (что должно быть правдой всегда)

1. **Истина — `parts`**. LLM prompt не читается из "плоского текста". `promptText` (если хранится) — деривативный кэш.

2. **Один активный main**. В assistant Variant ровно один Part с `channel="main"`, который не заменен и не удален.

3. **Entry.role наследуется**. Все Parts внутри Entry сериализуются с ролью Entry.role. Part не имеет собственной роли.

4. **Иерархия soft delete**. Entry.softDeleted = true → Parts не проверяются.

5. **TTL динамический**. Проверяется при каждой проекции. Данные не модифицируются при истечении.

6. **Channel для рендеринга**. Channel определяет UI-компонент и логику отображения. Доменный смысл (что именно это за aux-блок) выражается через `schemaId` + `label`.

7. **Order для позиционирования**. `order=0` — main, остальное до или после.

