# TaleSpinner — Pipelines + Pre/Post Processing Spec (v0.1) — SSE events

> Статус: **draft** для обсуждения.  
> Цель: зафиксировать архитектуру пайплайнов и пре/постпроцессинга, совместимую с текущим chat-core флоу, чтобы дальше согласовать API и начать реализацию.

> Примечание: это часть спеки, выделенная из монолита `pipelines-and-processing-spec-v0.1.md`.

## SSE / транспортные события

### Минимум v1 (совместимо с текущим)

- `llm.stream.meta` — канонические id (chat/message/variant/generation/run)
- `llm.stream.delta` — `{ content: string }`
- `llm.stream.error` — `{ message, code?, details? }`
- `llm.stream.done` — `{ status: done|aborted|error }`

### Опционально (v1.1+): статус шагов

Если нужно в UI отображать progress:

- `pipeline.step.started`
- `pipeline.step.done`

Это не обязательно для реализации пайплайна как такового, но улучшает UX.

