# TaleSpinner — Pipelines + Pre/Post Processing Spec (v0.1) — Observability

> Статус: **draft** для обсуждения.  
> Цель: зафиксировать архитектуру пайплайнов и пре/постпроцессинга, совместимую с текущим chat-core флоу, чтобы дальше согласовать API и начать реализацию.

> Примечание: это часть спеки, выделенная из монолита `pipelines-and-processing-spec-v0.1.md`.

## Наблюдаемость и воспроизводимость

### Что важно логировать (v1 минимум)

- `pipeline_runs`:
  - trigger, status, started/finished, привязки к chat/entityProfile
- `pipeline_step_runs`:
  - stepType, статус, длительность
  - inputJson/outputJson (в разумных пределах)
- `llm_generations`:
  - provider/model, paramsJson, status
  - (опционально) promptSnapshotJson, usage tokens

### Логирование `Augmentation` (pre-CoT/working-notes)

Рекомендация v1:

- хранить `Augmentation` как часть `pipeline_step_runs.outputJson` только в одном из режимов:
  - **redacted** (обрезка/маскирование),
  - **сводка** (короткий synopsis),
  - **hash-only** (если не хотим хранить содержимое).

Это позволяет воспроизводить флоу и дебажить, не сохраняя “сырые мысли” модели.

### Баланс “логировать всё” vs “не хранить секреты”

В `promptSnapshotJson` могут быть чувствительные данные (в т.ч. токены не должны туда попасть).

Рекомендация:

- снапшот хранить в redacted виде:
  - без секретов,
  - возможно с урезанием размера,
  - с хешем для сопоставления (`promptHash`).

