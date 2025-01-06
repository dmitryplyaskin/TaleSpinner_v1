import React from "react";
import { useUnit } from "effector-react";
import {
  $llmSettings,
  updateLLMSettings,
  llmSettingsFields,
  LLMSettingsState,
} from "../../model/llm-settings";

export interface LLMSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

interface LLMSettingsTabProps {
  settings: LLMSettings;
  onSettingsChange: (settings: LLMSettings) => void;
}

export const LLMSettingsTab: React.FC = () => {
  const settings = useUnit($llmSettings);

  const handleChange = (key: keyof LLMSettingsState, value: number) => {
    updateLLMSettings({ [key]: value });
  };

  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      {llmSettingsFields.map((field) => (
        <div
          key={field.key}
          className={`col-span-${field.width} bg-white p-3 rounded-lg shadow-sm border border-gray-200`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{field.label}</span>
                <div className="group relative">
                  <svg
                    className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="invisible group-hover:visible absolute z-10 w-48 p-2 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg shadow-lg left-0 top-6">
                    {field.tooltip}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Значение: {settings[field.key as keyof LLMSettingsState]}
              </div>
            </div>
          </div>
          <input
            type={field.type === "range" ? "range" : "number"}
            min={field.min}
            max={field.max}
            step={field.step}
            value={settings[field.key as keyof LLMSettingsState]}
            onChange={(e) => handleChange(
              field.key as keyof LLMSettingsState,
              field.type === "range" ? parseFloat(e.target.value) : Number(e.target.value)
            )}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      ))}
    </div>
  );
};
