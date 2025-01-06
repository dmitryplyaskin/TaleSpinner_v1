import { createStore, createEvent } from 'effector';

export interface LLMSettingField {
  key: string;
  label: string;
  type: 'range' | 'number' | 'text';
  tooltip: string;
  width: 1 | 2 | 3;
  defaultValue: number | string;
  min?: number;
  max?: number;
  step?: number;
}

export interface LLMSettingsState {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export const defaultSettings: LLMSettingsState = {
  temperature: 0.7,
  maxTokens: 2000,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

export const llmSettingsFields: LLMSettingField[] = [
  {
    key: 'temperature',
    label: 'Температура',
    type: 'range',
    tooltip: 'Контролирует случайность ответов. Более высокие значения делают вывод более случайным.',
    width: 2,
    defaultValue: 0.7,
    min: 0,
    max: 2,
    step: 0.1,
  },
  {
    key: 'maxTokens',
    label: 'Максимум токенов',
    type: 'range',
    tooltip: 'Максимальное количество токенов в ответе модели.',
    width: 2,
    defaultValue: 2000,
    min: 100,
    max: 4000,
    step: 100,
  },
  {
    key: 'topP',
    label: 'Top P',
    type: 'range',
    tooltip: 'Контролирует разнообразие через nucleus sampling. Меньшие значения делают вывод более сфокусированным.',
    width: 1,
    defaultValue: 1,
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: 'frequencyPenalty',
    label: 'Штраф частоты',
    type: 'range',
    tooltip: 'Снижает вероятность повторения одних и тех же фраз.',
    width: 1,
    defaultValue: 0,
    min: -2,
    max: 2,
    step: 0.1,
  },
  {
    key: 'presencePenalty',
    label: 'Штраф присутствия',
    type: 'range',
    tooltip: 'Поощряет модель говорить о новых темах.',
    width: 1,
    defaultValue: 0,
    min: -2,
    max: 2,
    step: 0.1,
  },
];

// Events
export const updateLLMSettings = createEvent<Partial<LLMSettingsState>>();
export const resetLLMSettings = createEvent();

// Store
export const $llmSettings = createStore<LLMSettingsState>(defaultSettings)

$llmSettings.on(updateLLMSettings, (state, payload) => ({
    ...state,
    ...payload,
  }))
  .reset(resetLLMSettings);


  $llmSettings.watch(console.log)