# Operation Orchestrator (DAG + Events)

Этот модуль реализует **универсальный оркестратор исполнения DAG** для `OrchestratorTask[]`:

- фильтрация задач (`enabled`, `includeTaskIds`, `excludeTaskIds`);
- построение плана и графа зависимостей (`dependsOn`);
- исполнение в режимах `sequential` / `concurrent` с лимитом `concurrency`;
- поток событий жизненного цикла (через `onEvent`);
- поддержка отмены через `AbortSignal`.

Оркестратор **не содержит бизнес‑логики**: любые side‑effects выполняются внутри `task.run(ctx)`.

## Быстрый старт

```ts
import { runOrchestrator } from "@core/operation-orchestrator";
import type { OrchestratorTask } from "@core/operation-orchestrator";

const tasks: OrchestratorTask[] = [
  {
    taskId: "A",
    enabled: true,
    required: false,
    order: 10,
    run: async () => "ok",
  },
  {
    taskId: "B",
    enabled: true,
    required: false,
    order: 20,
    dependsOn: ["A"],
    run: async () => "ok",
  },
];

const result = await runOrchestrator(
  {
    runId: "run-1",
    hook: "before_main_llm",
    trigger: "generate",
    executionMode: "concurrent",
    concurrency: 2,
    tasks,
  },
  {
    onEvent: (e) => console.log(e.type, e.data),
  }
);
```

## Детерминизм

Даже в `concurrent` режиме выбор “кого стартовать первым” среди runnable задач детерминирован:

1. `order` (меньше = раньше)
2. `taskId` (лексикографически) — tie‑break

## Семантика зависимостей

- Таск runnable только если **все зависимости завершились `done`**.
- Если хотя бы одна зависимость завершается `error|aborted|skipped`, зависимые задачи получают:
  - `status="skipped"`, `reason="dependency_not_done"`.
- Если `dependsOn` указывает на таск, которого нет в плане (из‑за runtime‑фильтрации), задача получает:
  - `status="skipped"`, `reason="dependency_missing"`, `blockedByTaskIds=[...]`.

## Cancellation

- Если `signal.aborted === true` до старта исполнения — все задачи **в плане** будут `skipped: orchestrator_aborted`.
- Если отмена происходит во время исполнения — новые задачи не стартуют, а оставшиеся pending задачи становятся
  `skipped: orchestrator_aborted`. Running задачи получают `ctx.signal`.

## Extension points

В `runOrchestrator(..., options)` доступны:

- `onEvent(event)` — подключение логирования/SSE/WebSocket и т.п.
- `now()` — инъекция часов (удобно для тестов).
- `classifyAbortError(error, { signal })` — политика, как классифицировать reject как `aborted` vs `error`.

