# Backend contracts (draft) — Pipelines & Artifacts (v1)

> Цель: зафиксировать **контракты бэкенда** (shape + инварианты), чтобы от них отталкиваться в реализации.
> Это **не DDL** и не “как хранить в БД”, а договорённость о полях/типах/поведении.

## Scope v1 (важные ограничения)

- **`llm` как данность (boundary)**: в v1 мы считаем, что “генерация” — это уже существующий процесс chat-core (стрим SSE, flush в БД, finish generation).  
  Пайплайны в v1 — это **обвязка до/после** этой точки, без попыток управлять тем, что уже работает.
- **`main llm` строго один** “канонический” генератор в момент времени (в рамках ветки/чата): именно он стримит `llm.stream.*` и сохраняет assistant variant/message.
- **RAG/Tool**: в v1 **не реализуем** как фичу; контракты для `rag|tool` считаются зарезервированными/минимальными.
- **Artifacts session**: persisted артефакты **chat-scoped** (`sessionId = chatId`), `branchId` пока не влияет на storage.
- **История чата** в prompt берётся из **`promptText` выбранных variants**; пайплайн не “переписывает прошлое” (кроме текущего turn и только при разрешённом `message_transform`).

---

## 1) Pipeline contracts

### 1.0. Термины (важно для понимания)

В этой версии контрактов:

- **Pipeline** = *одна единица логики* (“один шаг/плагин”), которая запускается в определённый момент исполнения (`pre` или `post`) и:
  - пишет результат в артефакты, и/или
  - делает внешние побочные эффекты (логирование, валидация, подготовка данных и т.п.).
- **PipelineProfile** = *набор активных пайплайнов + порядок их запуска* (конфигурация).
- **PipelineRun** = *конкретный запуск* пайплайнов для одного turn-а (runtime/лог процесса). В этом файле Run описываем позже (сейчас фокус на Pipeline + Artifact).

### 1.1. Триггер запуска (для `PipelineRun`)

```ts
export type PipelineTrigger = "user_message" | "regenerate" | "manual" | "api";
```

### 1.2. Pipeline step type (когда выполняется пайплайн)

```ts
export type PipelineStepTypeV1 = "pre" | "post";
```

Уточнение v1:

- `llm` — это **данность/boundary** существующей генерации (стрим/flush/finalize), а пайплайны — это обвязка **до/после** неё.
- В v1 каждый pipeline — **ровно один шаг** и выполняется либо в `pre`, либо в `post`.
- Семантика фаз:
  - `pre`: после сохранения user message и создания assistant variant, но до вызова LLM генератора;
  - `post`: после завершения генерации (done/aborted/error) и финального flush в БД.

### 1.3. PipelineDefinition (описание одного пайплайна)

```ts
export interface PipelineDefinitionV1 {
  /** Стабильный идентификатор pipeline (для хранения/логов/SSE). */
  pipelineId: string;

  /** Человекочитаемое имя (для UI/debug report). */
  name: string;

  /** Опциональный tag/slug для ссылок в UI/темплейтах. */
  tag?: string;

  /** Можно выключать пайплайн без удаления. */
  enabledByDefault?: boolean;

  /**
   * Единственный шаг пайплайна (v1).
   * NOTE: не путать с `pipeline_step_runs` в БД — это запись лога выполнения.
   */
  step: PipelineStepDefinitionV1;
}
```

### 1.4. PipelineStepDefinition + params (v1: минимально, без управления `llm`)

В v1 намеренно **не описываем** параметры управления LLM (provider/model/stream), потому что `llm` — это boundary существующей генерации.

```ts
export interface PipelineStepDefinitionV1 {
  type: PipelineStepTypeV1;
  params?: unknown;
}
```

Рекомендуемые (опциональные) shapes для `params`:

```ts
export interface PrePipelineParamsV1 {
  /**
   * Можно ли этому пайплайну писать persisted артефакты (`art.<tag>`).
   * Детальная политика мутаций — отдельный контракт, но флаг полезен как “intent”.
   */
  allowArtifactWrite?: boolean;

  /**
   * Зарезервировано (follow-up): если в будущем дадим пайплайнам влиять на prompt,
   * то это будет через артефакты + promptInclusion, а не через прямое управление `llm`.
   */
  reserved?: Record<string, unknown>;
}
```

```ts
export interface PostPipelineParamsV1 {
  /**
   * Опциональные операции постобработки (как intent).
   * Реальный набор операций зависит от того, что мы будем внедрять в v1.
   */
  operations?: Array<
    | { type: "normalize_markdown" }
    | { type: "safety_redact" }
    | { type: "build_blocks_json" }
  >;
}
```

### 1.6. PipelineProfile (минимум, чтобы зафиксировать порядок и единственный main-LLM)

> Если ты хочешь “начать строго с Pipeline + Artifact”, этот раздел можно временно не реализовывать в коде,
> но **контракт порядка и ограничений** удобно держать здесь.

```ts
export interface PipelineProfileV1 {
  profileId: string;
  name: string;

  /** Порядок = порядок массива: “выше” → раньше. */
  pipelines: PipelineProfileEntryV1[];

  /** Мета для ревизий/миграций (v1: опционально). */
  revision?: number;
}

export interface PipelineProfileEntryV1 {
  pipelineId: string;
  enabled: boolean;
}
```

#### Инварианты профиля (v1)

- `llm` как boundary вызывается ровно один раз (канонический стрим/сохранение) — это не “пайплайн”, а фиксированная часть оркестратора.
- Порядок исполнения пайплайнов определяется порядком в `pipelines[]`.
- Композиция, когда несколько пайплайнов влияют на prompt, не формализуется до итерации реализации (v2+/follow-up).

---

## 2) Artifact contracts

### 2.1. Базовые enum’ы

```ts
export type ArtifactAccess = "run_only" | "persisted";

export type ArtifactVisibility =
  | "prompt_only"
  | "ui_only"
  | "prompt_and_ui"
  | "internal";

export type UiSurface =
  | "chat_history"
  | `panel:${string}`
  | `feed:${string}`
  | `overlay:${string}`
  | "internal";

export type ArtifactContentType = "text" | "json" | "markdown";
```

### 2.2. Prompt inclusion (минимум v1)

```ts
export type PromptInclusionMode =
  | "none"
  | "append_after_last_user"
  | "prepend_system"
  | "as_message";

export type PromptRole = "system" | "developer" | "assistant" | "user";

export interface PromptInclusionV1 {
  mode: PromptInclusionMode;
  role?: PromptRole;
  format?: ArtifactContentType; // как сериализуем в prompt

  /**
   * На будущее (v2+): ordering/anchor/depthPolicy и т.п.
   * В v1 можно держать как opaque json, но ниже — “зарезервированные” поля.
   */
  phase?: "system" | "early" | "near_anchor" | "after_last_user" | "tail";
  priority?: number;
}
```

Уточнение v1 про роли:

- `developer` на уровне домена маппится в `system` на уровне большинства провайдеров (пока не введём явную provider-role).

### 2.3. Retention policy (v1 минимум)

```ts
export interface RetentionPolicyV1 {
  /** Если задано — храним историю версий, иначе по умолчанию overwrite-only. */
  keepHistory?: boolean;

  /** Максимум версий в history (если keepHistory=true). */
  maxVersions?: number;

  /** TTL (если keepHistory=true). */
  ttlSeconds?: number;
}
```

### 2.4. Persisted artifact (контракт сущности)

```ts
export interface PipelineArtifactV1 {
  /** Уникальный id версии (может быть uuid). */
  id: string;

  /** Кто владелец (пользователь/аккаунт). */
  ownerId: string;

  /**
   * Где живёт (Session). v1: строго chatId.
   * В будущем возможно: branch-scoped.
   */
  sessionId: string;

  /** Уникальный тег адресации в Liquid: `art.<tag>`. Обязателен для access=persisted. */
  tag?: string;

  kind: string; // "augmentation" | "state" | "commentary" | ...
  access: ArtifactAccess;
  visibility: ArtifactVisibility;
  uiSurface: UiSurface;

  contentType: ArtifactContentType;
  contentText?: string;
  contentJson?: unknown;

  /** Правила включения в prompt (если visibility допускает). */
  promptInclusion?: PromptInclusionV1 | null;

  /** Политика “жизни” (Latest + History). */
  retention?: RetentionPolicyV1;

  /**
   * Версионирование:
   * - version: монотонно растущий int или uuid (важно: сравнимость/упорядочивание).
   * - basedOnVersion: оптимистическая конкуррентность (reject при mismatch).
   */
  version: number | string;
  basedOnVersion?: number | string | null;

  createdAt: string; // ISO
  updatedAt: string; // ISO
}
```

#### Инварианты артефактов (v1)

- Для `access="persisted"`: `tag` **обязателен** и уникален в пределах `(ownerId, sessionId)`.
- **Single-writer**: у persisted `tag` должен быть ровно один writer (пайплайн‑владелец). Писать в чужой `tag` нельзя (policy violation).
- **Latest + History**:
  - в рантайме почти всегда нужен “latest” (`art.<tag>.value`);
  - `history[]` хранится только если retention требует.
- **Optimistic concurrency + reject**:
  - при записи новой версии persisted `tag` указываем `basedOnVersion`;
  - если не совпало с текущим latest — `artifact_conflict`.

### 2.5. SessionView (Liquid доступ `art.<tag>`)

```ts
export interface SessionArtifactViewV1 {
  /** Текущее значение (latest). Формат зависит от contentType. */
  value: unknown;

  /**
   * История прошлых значений (без текущего).
   * Формат элементов совпадает с `value`.
   */
  history?: unknown[];

  /** Метаданные (опционально): version, timestamps, kind, surface, etc. */
  meta?: {
    tag: string;
    kind: string;
    version: number | string;
    updatedAt: string;
  };
}

export type SessionViewV1 = Record<string, SessionArtifactViewV1>;
```

Уточнение:

- `SessionViewV1` содержит **только** `access="persisted"` артефакты (`art.<tag>`).
- `access="run_only"` существует внутри run и наблюдается через step logs/snapshots, но не адресуется как `art.*`.

