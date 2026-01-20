# TaleSpinner — Pipelines + Pre/Post Processing Spec (v0.1) — SSE events

> Статус: **draft** для обсуждения.  
> Цель: зафиксировать архитектуру пайплайнов и пре/постпроцессинга, совместимую с текущим chat-core флоу, чтобы дальше согласовать API и начать реализацию.

## SSE / транспортные события

### Зачем (UI “не зависло”)

Помимо стрима текста ассистента, UI должен уметь показывать “что происходит”:

- какой пайплайн/запуск сейчас выполняется,
- на каком шаге он находится,
- чем завершилось (done/aborted/error),
- чтобы пользователь не думал, что система зависла.

### Минимум v1 (совместимо с текущим)

- `llm.stream.meta` — канонические id (chat/message/variant/generation/run)
- `llm.stream.delta` — `{ content: string }`
- `llm.stream.error` — `{ message, code?, details? }`
- `llm.stream.done` — `{ status: done|aborted|error }`

### Event envelope (минимум v1)

Чтобы UI мог корректно коррелировать события и показывать прогресс/тосты, каждое событие (кроме keep-alive) должно включать:

- `chatId`
- `runId`
- `pipelineId` + “человекочитаемое” имя/тег пайплайна (`pipelineName` или `pipelineTag`)
- `trigger` (если применимо)
- `stepRunId?`, `stepType?`
- `generationId?`, `assistantMessageId?`, `assistantVariantId?`, `userMessageId?` (по ситуации)
- `status?` (для событий завершения)

> В v1 допускается не вводить `seq`/replay; порядок обеспечивается порядком доставки в одном SSE соединении.

### Pipeline progress events (v1)

Эти события предназначены в первую очередь для UI (тосты/индикаторы/таймлайн):

- `pipeline.run.started` — запуск пайплайна начался
- `pipeline.run.done` — запуск завершён успешно (`status=done`)
- `pipeline.run.aborted` — запуск прерван пользователем/abort (`status=aborted`)
- `pipeline.run.error` — запуск завершился ошибкой (`status=error`, `error{code,message,details?}`)

Рекомендация:

- `pipeline.run.started` должно приходить как можно раньше (сразу после создания `PipelineRun`), чтобы UI мог показать “Pipeline <name>: в процессе”.
- одно из `pipeline.run.(done|aborted|error)` должно приходить ровно один раз.

### Step progress events (v1)

Если нужно в UI отображать прогресс внутри пайплайна:

- `pipeline.step.started`
- `pipeline.step.done`

Для шага полезно включать:

- `stepType`
- `stepRunId`
- `status` (для `done`: `done|aborted|error`) + `error?`
- (опционально) `label`/`summary` — короткая строка для UI (“Context: preparing…”, “Post: formatting…”; RAG/tool — v2+)

### Keep-alive (v1)

SSE соединения часто обрываются прокси/браузером без трафика. Рекомендуется периодически слать keep-alive:

- SSE comment (например `: keep-alive\n\n`) или отдельное событие `ping`.

### Обрыв соединения и “resume” (v1 минимум)

В v1 не требуем replay/`Last-Event-ID`.

Если соединение оборвалось:

- UI должен уметь **перечитать** состояние из БД через обычный API (variant текст + статусы `pipeline_runs/llm_generations`)
- и восстановить индикаторы “идёт/завершено/ошибка” по статусам.

Replay/`Last-Event-ID` и детерминированное восстановление потока событий — v2+.

