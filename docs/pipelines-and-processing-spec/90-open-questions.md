# TaleSpinner — Pipelines + Pre/Post Processing Spec (v0.1) — Future & open questions

> Статус: **draft** для обсуждения.  
> Цель: зафиксировать архитектуру пайплайнов и пре/постпроцессинга, совместимую с текущим chat-core флоу, чтобы дальше согласовать API и начать реализацию.

> Примечание: это часть спеки, выделенная из монолита `pipelines-and-processing-spec-v0.1.md`.

## Версии и расширения (на будущее)

### v2+: DAG и многошаговая агентика

Возможные расширения:

- шаги как граф зависимостей (parallel execution),
- tool↔LLM loops,
- conditional branching (if/else) внутри pipeline definition,
- “memory” сущности (summary/notes) как отдельный тип сообщений или отдельная таблица.

### v2+: Исторические трансформации

Если появится “compaction/summarize history”, то:

- оформляется как отдельный stepType (например `history_compaction`),
- имеет строгую политику: что меняется, где хранится “до/после”,
- и обязательно логируется как отдельный action/run.

## Открытые вопросы (для согласования перед API)

1. Делаем ли пайплайны строго “один ход” (user→assistant) в v1, или закладываем многошаговые сценарии сразу?
2. Где хранится pipeline selection: на уровне chat? entityProfile? global? (и как наследуется)
3. Хотим ли мы v1 “tool step” как часть pipeline (хотя бы до LLM), или откладываем?
4. Нужны ли UI-события по шагам (`pipeline.step.*`) уже в v1?
5. Нужен ли `promptSnapshotJson` в v1 (с redaction), или достаточно `pipeline_step_runs` логов?

