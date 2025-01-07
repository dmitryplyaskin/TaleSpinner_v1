import { createStore, createEvent, createEffect, sample } from "effector";
import { debounce } from "patronum/debounce";
import { BASE_URL } from "../const";

export interface LLMSettingField {
  key: string;
  label: string;
  type: "range" | "number" | "text";
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
    key: "temperature",
    label: "Температура",
    type: "range",
    tooltip:
      "Контролирует случайность ответов. Более высокие значения делают вывод более случайным.",
    width: 1,
    defaultValue: 0.7,
    min: 0,
    max: 2,
    step: 0.1,
  },
  {
    key: "maxTokens",
    label: "Максимум токенов",
    type: "range",
    tooltip: "Максимальное количество токенов в ответе модели.",
    width: 2,
    defaultValue: 2000,
    min: 0,
    max: 40000,
    step: 50,
  },
  {
    key: "topP",
    label: "Top P",
    type: "range",
    tooltip:
      "Контролирует разнообразие через nucleus sampling. Меньшие значения делают вывод более сфокусированным.",
    width: 1,
    defaultValue: 1,
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: "frequencyPenalty",
    label: "Штраф частоты",
    type: "range",
    tooltip: "Снижает вероятность повторения одних и тех же фраз.",
    width: 1,
    defaultValue: 0,
    min: -2,
    max: 2,
    step: 0.1,
  },
  {
    key: "presencePenalty",
    label: "Штраф присутствия",
    type: "range",
    tooltip: "Поощряет модель говорить о новых темах.",
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

// Effects
export const fetchSettingsFx = createEffect(async () => {
  const response = await fetch(`${BASE_URL}/settings`);
  if (!response.ok) {
    throw new Error("Failed to fetch settings");
  }
  return response.json();
});

export const saveSettingsFx = createEffect(
  async (settings: LLMSettingsState) => {
    const response = await fetch(`${BASE_URL}/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      throw new Error("Failed to save settings");
    }
    return response.json();
  }
);

// Debounced save effect
export const debouncedSaveSettings = debounce({
  source: updateLLMSettings,
  timeout: 1000,
});

// Store
export const $llmSettings = createStore<LLMSettingsState>(defaultSettings);

// Store updates
$llmSettings
  .on(updateLLMSettings, (state, payload) => ({
    ...state,
    ...payload,
  }))
  .on(fetchSettingsFx.doneData, (_, payload) => payload)
  .reset(resetLLMSettings);

// Initialize settings on app start
fetchSettingsFx();

sample({
  source: $llmSettings,
  clock: debouncedSaveSettings,
  target: saveSettingsFx,
});
