# TaleSpinner — Pipelines + Pre/Post Processing Spec (v0.1) — Observability

> Статус: **draft** для обсуждения.  
> Цель: зафиксировать архитектуру пайплайнов и пре/постпроцессинга, совместимую с текущим chat-core флоу, чтобы дальше согласовать API и начать реализацию.

> Примечание: это часть спеки, выделенная из монолита `pipelines-and-processing-spec-v0.1.md`.

## Наблюдаемость и воспроизводимость

Подробные правила логирования вынесены отдельно, чтобы не раздувать остальные разделы спеки: см. `55-logging-and-reproducibility.md`.

### Что важно логировать (v1 минимум)

- `pipeline_runs`:
  - trigger, status, started/finished, привязки к chat/entityProfile
- `pipeline_step_runs`:
  - stepType, статус, длительность
  - inputJson/outputJson (в разумных пределах)
- `llm_generations`:
  - provider/model, paramsJson, status
  - (опционально) promptSnapshotJson, usage tokens

Дополнения (redaction, augmentation, `promptHash`, лимиты/retention) — см. `55-logging-and-reproducibility.md`.

