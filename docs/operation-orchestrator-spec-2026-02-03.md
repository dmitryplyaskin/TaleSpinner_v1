# Spec: Operation Orchestrator (Event‑Driven + DAG Execution)

_Дата: 2026‑02‑03 (draft)_

Этот документ описывает **оркестратор операций** как **универсальный движок исполнения DAG**: он принимает список “тасков” (в нашем случае — `operations` из `OperationProfile`), **фильтрует**, **строит план**, **исполняет** (последовательно или конкурентно) и эмитит **события жизненного цикла**.

Ключевой принцип: **оркестратор не содержит бизнес‑логики**. Он не знает про UI, БД, SSE, “как устроены артефакты”, “как хранить канон”, и т.д. Все side‑effects происходят внутри injected‑blackbox исполнителей или в потребителях событий.

---

## 1) Цели

- **Детерминированное планирование**: одинаковый вход → одинаковый план (порядок в очередях, tie‑break).
- **DAG‑исполнение**: зависимость (`dependsOn`) является единственным источником истинной “связанности”.
- **Два режима**:
  - `sequential` — строго по одному, в детерминированном порядке;
  - `concurrent` — конкурентно, с учётом зависимостей.
- **Event‑Driven**: поток событий “что происходит” (старт/финиш/статус/ошибка/пропуск).
- **Переиспользуемость**: один и тот же движок можно применять в любой части приложения.
- **Отмена**: поддержка `AbortSignal` (user cancel / deadline policy).

---

## 2) Не‑цели

- Оркестратор **не** валидирует `OperationProfile` как persisted сущность (это задача save‑time валидации).
- Оркестратор **не** применяет “эффекты” к канону/артефактам (**commit слой** отделён).
- Оркестратор **не** делает сетевые/DB операции сам по себе (только через blackbox‑исполнители).
- Оркестратор **не** управляет стримингом main LLM (это отдельный процесс; оркестратор лишь оборачивает запуск “до/после”).

---

## 3) Терминология

- **Task**: единица исполнения в DAG (в контексте v2 — одна `Operation` из профиля).
- **DAG**: ориентированный ацикличный граф зависимостей `dependsOn`.
- **Dependency**: ребро `A -> B`, где `A` зависит от `B` (то есть `A.dependsOn` содержит `B`).
- **Phase/Hook**: точка запуска относительно main LLM:
  - `before_main_llm`
  - `after_main_llm`
- **Trigger**: причина запуска `Run`:
  - `generate`
  - `regenerate`
- **Plan**: результат фильтрации + нормализации + построения графа (готовый набор задач к запуску).
- **Terminal status**:
  - `done | error | aborted | skipped`
- **Event**: сообщение “в оркестраторе что‑то произошло”, предназначено для наблюдаемости/интеграций.

---

## 4) Контракты (вход/выход)

### 4.1 Минимальный тип таска (ядро DAG‑движка)

```ts
type TaskId = string;

type ExecutionMode = "concurrent" | "sequential";
type Trigger = "generate" | "regenerate";
type Hook = "before_main_llm" | "after_main_llm";

type TaskStatus = "done" | "error" | "aborted" | "skipped";

type TaskSkipReason =
  | "disabled"
  | "filtered_out"
  | "dependency_missing"
  | "dependency_not_done"
  | "orchestrator_aborted";

type OrchestratorTask<TResult = unknown> = {
  taskId: TaskId;
  name?: string;

  // Планирование/валидация
  enabled: boolean;
  required: boolean;
  order: number;
  dependsOn?: TaskId[];

  // Исполнение (blackbox)
  run: (ctx: TaskContext) => Promise<TResult>;
};

type TaskContext = {
  runId: string;
  hook: Hook;
  trigger: Trigger;

  // cancellation
  signal: AbortSignal;

  // “временный стейт” (opaque для оркестратора)
  state: Record<string, unknown>;

  // event bus для прогресса внутри blackbox (опционально)
  emit: (event: OrchestratorEvent) => void;
};
```

### 4.2 Параметры запуска оркестратора

```ts
type OrchestratorRunParams = {
  runId: string;
  hook: Hook;
  trigger: Trigger;
  executionMode: ExecutionMode;

  tasks: OrchestratorTask[];

  // Фильтрация (не только enabled/hooks/triggers)
  filter?: {
    includeTaskIds?: string[];
    excludeTaskIds?: string[];
    // future: by kind/tags/etc (если появится)
  };

  // Runtime
  state?: Record<string, unknown>;
  signal?: AbortSignal;

  // Ограничение конкурентности (для concurrent режима)
  concurrency?: number; // default: Infinity
};
```

### 4.3 Результат запуска (summary)

```ts
type TaskResult<TResult = unknown> =
  | {
      taskId: string;
      status: "done";
      startedAt: number;
      finishedAt: number;
      result: TResult;
    }
  | {
      taskId: string;
      status: "error";
      startedAt: number;
      finishedAt: number;
      error: { message: string; code?: string };
    }
  | {
      taskId: string;
      status: "aborted";
      startedAt: number;
      finishedAt: number;
      reason?: string;
    }
  | {
      taskId: string;
      status: "skipped";
      startedAt?: number;
      finishedAt: number;
      reason: TaskSkipReason;
      blockedByTaskIds?: string[];
    };

type OrchestratorRunResult = {
  runId: string;
  hook: Hook;
  trigger: Trigger;
  executionMode: ExecutionMode;
  startedAt: number;
  finishedAt: number;

  // Итог по всем таскам, которые попали в план
  tasks: TaskResult[];
};
```

### 4.4 Event‑Driven: события оркестратора

События предназначены для:

- логирования/трассировки,
- UI‑наблюдаемости (через SSE/WebSocket),
- будущей обработки результатов (commit слой, реплеи).

```ts
type OrchestratorEvent =
  | { type: "orch.run.started"; data: { runId: string; hook: Hook; trigger: Trigger } }
  | { type: "orch.plan.built"; data: { runId: string; taskIds: string[] } }
  | { type: "orch.task.started"; data: { runId: string; taskId: string } }
  | { type: "orch.task.finished"; data: { runId: string; taskId: string; status: TaskStatus } }
  | { type: "orch.task.skipped"; data: { runId: string; taskId: string; reason: TaskSkipReason } }
  | { type: "orch.task.progress"; data: { runId: string; taskId: string; payload: unknown } }
  | { type: "orch.run.finished"; data: { runId: string } };
```

**Примечание**: `orch.task.progress` эмитится не оркестратором, а самой blackbox‑операцией через `ctx.emit(...)`.

---

## 5) Планирование (filter → DAG → очереди)

### 5.1 Фильтрация задач

Оркестратор строит `planTasks` из `params.tasks` по правилам:

1. Базовый фильтр: `task.enabled === true`.
2. Пользовательский фильтр:
   - `includeTaskIds` (если задан) → оставить только их,
   - `excludeTaskIds` (если задан) → удалить их.

Задачи, отфильтрованные на этом этапе, получают `status="skipped"` с `reason="filtered_out"` (или `"disabled"`).

### 5.2 Нормализация зависимостей

- `dependsOn` нормализуется как `unique(list)` (без дублей).
- Оркестратор использует **только зависимости на таски, присутствующие в плане**.

Политика для “потерянных” зависимостей:

- если `task.dependsOn` указывает на taskId, которого нет в плане → `task` **не может стартовать** и завершается как:
  - `status="skipped"`, `reason="dependency_missing"`, `blockedByTaskIds=[...]`.

> Мотивация: при runtime‑фильтрации (по trigger/hook/feature flags) зависимость может исчезнуть. Это должно быть явно видно в логах/событиях и корректно блокировать required‑поток.

### 5.3 Очередь и детерминизм

Даже в `concurrent` режиме оркестратор должен быть **детерминированным** в выборе “кого стартовать первым” среди готовых.

Рекомендуемый tie‑break:

1. `order` (меньше = раньше)
2. `taskId` (лексикографически) — только как tie‑break

> Важно: это **порядок старта**, а не порядок “применения эффектов”. commit‑порядок относится к отдельному слою (см. v2 `effect-commit`).

---

## 6) Исполнение (execute слой)

### 6.1 Общие правила

- Таск **стартует**, когда все его зависимости завершились `status="done"`.
- Если хотя бы одна зависимость завершилась `error|aborted|skipped` → таск никогда не станет runnable и получает:
  - `status="skipped"`, `reason="dependency_not_done"`, `blockedByTaskIds=[...]`.
- Оркестратор обязан эмитить `orch.task.started`/`orch.task.finished`/`orch.task.skipped`.

### 6.2 Cancellation

- Если `AbortSignal` уже `aborted` до старта → все таски в плане получают `skipped: orchestrator_aborted`.
- Если отмена происходит во время исполнения:
  - оркестратор **не обязан** принудительно “убивать” промисы; он обязан прокинуть `signal` в `ctx`,
  - running таски должны завершиться `aborted` по контракту blackbox (или `error` по политике),
  - таски, которые ещё не стартовали, получают `skipped: orchestrator_aborted`.

### 6.3 `sequential` режим

- Concurrency = 1.
- Следующий таск выбирается из множества runnable по `(order, taskId)`.
- Граф зависимостей всё равно учитывается (т.е. “пропустить вперёд” нельзя).

### 6.4 `concurrent` режим

- Оркестратор поддерживает очередь runnable и пул running до `concurrency`.
- При освобождении слота (таск завершился) оркестратор стартует следующий runnable по `(order, taskId)`.

---

## 7) Связь с OperationProfile (как получить tasks)

Оркестратор работает с `OrchestratorTask[]`. Для v2 операций адаптер строит таски из `OperationProfile.operations`.

Минимальный маппинг (с учётом текущего кода):

- `taskId = op.opId` (UUID в `shared/types/operation-profiles.ts`)
- `name = op.name`
- `enabled = op.config.enabled`
- `required = op.config.required`
- `order = op.config.order`
- `dependsOn = op.config.dependsOn`
- `run(ctx) = executeOperation(op, ctx)` (injected handler)

> Примечание: в спеках v2 часто используется `operationId` как стабильный id. В текущей реализации профиля хранится `opId: UUID`. Оркестратор не зависит от семантики id; важно только, что id уникален внутри плана.

---

## 8) Как это применяется в чате (две фазы)

Сценарий “generate/regenerate”:

1. `before_main_llm`:
   - построить план,
   - выполнить tasks,
   - собрать summary и решить “пройден ли барьер” (это решает слой Run, а не оркестратор).
2. main LLM:
   - отдельный процесс (стриминг и сохранение).
3. `after_main_llm`:
   - выполнить post‑tasks.

Псевдокод:

```ts
const before = await runOrchestrator({ hook: "before_main_llm", ... });
if (!barrierPassed(before)) return;

await runMainLlm();

const after = await runOrchestrator({ hook: "after_main_llm", ... });
```

---

## 9) Пример DAG

Пусть есть 4 операции:

- `A` (order=10) — без зависимостей
- `B` (order=20) — зависит от `A`
- `C` (order=15) — без зависимостей
- `D` (order=30) — зависит от `B` и `C`

В `concurrent` режиме при `concurrency=2`:

1. runnable: `A`, `C` → стартуют параллельно
2. `A done` → становится runnable `B` → стартует
3. `C done` (ждём `B`) → `D` пока не runnable
4. `B done` → `D` runnable → стартует

---

## 10) Инварианты

1. **DAG**: циклы не допускаются (желательно ловить на save‑time; runtime — fail fast).
2. **Уникальность id**: `taskId` уникален в плане.
3. **Зависимости только на существующие ноды плана** (иначе таск не стартует и явно `skipped`).
4. **Зависимость требует `done`**: только `done` разрешает продолжение.
5. **Оркестратор не применяет эффекты**: любые “результаты” — это данные для внешнего обработчика.

---

## 11) Открытые вопросы (для уточнения перед имплементацией)

1. Нужно ли вводить отдельный статус `blocked` или достаточно `skipped + reason`?
2. Хотим ли мы runtime‑валидацию совместимости зависимостей по фазам/триггерам?
   - пример: “A запускается только на generate, B зависит от A, но B запускается и на regenerate”.
3. Должен ли оркестратор поддерживать “partial results” (event‑stream) как `AsyncGenerator`, или достаточно callback `onEvent`?
4. Нужен ли лимит конкурентности по умолчанию (например `4`), или `Infinity` ок в текущих сценариях?

