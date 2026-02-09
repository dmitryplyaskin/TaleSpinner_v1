import { createStore, createEvent, createEffect, sample } from "effector";
import { type TFunction } from "i18next";
import { debounce } from "patronum/debounce";

import { apiJson } from "../api/api-json";

export interface LLMSettingField {
  key: string;
  labelKey: string;
  tooltipKey: string;
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

const llmSettingsFieldDefinitions: Array<Omit<LLMSettingField, "label" | "tooltip">> = [
  {
    key: "temperature",
    labelKey: "llmSettings.fields.temperature.label",
    type: "range",
    tooltipKey: "llmSettings.fields.temperature.tooltip",
    width: 1,
    defaultValue: 0.7,
    min: 0,
    max: 2,
    step: 0.1,
  },
  {
    key: "maxTokens",
    labelKey: "llmSettings.fields.maxTokens.label",
    type: "range",
    tooltipKey: "llmSettings.fields.maxTokens.tooltip",
    width: 2,
    defaultValue: 2000,
    min: 0,
    max: 40000,
    step: 50,
  },
  {
    key: "topP",
    labelKey: "llmSettings.fields.topP.label",
    type: "range",
    tooltipKey: "llmSettings.fields.topP.tooltip",
    width: 1,
    defaultValue: 1,
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: "frequencyPenalty",
    labelKey: "llmSettings.fields.frequencyPenalty.label",
    type: "range",
    tooltipKey: "llmSettings.fields.frequencyPenalty.tooltip",
    width: 1,
    defaultValue: 0,
    min: -2,
    max: 2,
    step: 0.1,
  },
  {
    key: "presencePenalty",
    labelKey: "llmSettings.fields.presencePenalty.label",
    type: "range",
    tooltipKey: "llmSettings.fields.presencePenalty.tooltip",
    width: 1,
    defaultValue: 0,
    min: -2,
    max: 2,
    step: 0.1,
  },
];

export const getLlmSettingsFields = (t: TFunction): LLMSettingField[] =>
  llmSettingsFieldDefinitions.map((field) => ({
    ...field,
    label: t(field.labelKey),
    tooltip: t(field.tooltipKey),
  }));

// Events
export const updateLLMSettings = createEvent<Partial<LLMSettingsState>>();
export const resetLLMSettings = createEvent();

// Effects
export const fetchSettingsFx = createEffect(async () => {
  return apiJson<LLMSettingsState>("/settings");
});

export const saveSettingsFx = createEffect(
  async (settings: LLMSettingsState) => {
    return apiJson<LLMSettingsState>("/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    });
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

sample({
  source: $llmSettings,
  clock: debouncedSaveSettings,
  target: saveSettingsFx,
});
