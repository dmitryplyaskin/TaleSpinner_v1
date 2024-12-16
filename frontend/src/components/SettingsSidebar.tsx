import React, { useState, useEffect } from 'react';

interface LLMSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: LLMSettings) => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  isOpen,
  onClose,
  onSettingsChange,
}) => {
  const [settings, setSettings] = useState<LLMSettings>({
    temperature: 0.7,
    maxTokens: 2000,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
  });

  const handleChange = (key: keyof LLMSettings, value: number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 h-screen bg-white border-l border-gray-200 p-4 fixed right-0 top-0 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Настройки LLM</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Температура ({settings.temperature})
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={settings.temperature}
            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="text-sm text-gray-500 mt-1">
            Контролирует случайность ответов. Более высокие значения делают вывод более случайным.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Максимум токенов ({settings.maxTokens})
          </label>
          <input
            type="range"
            min="100"
            max="4000"
            step="100"
            value={settings.maxTokens}
            onChange={(e) => handleChange('maxTokens', parseInt(e.target.value))}
            className="w-full"
          />
          <p className="text-sm text-gray-500 mt-1">
            Максимальное количество токенов в ответе.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Top P ({settings.topP})
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.topP}
            onChange={(e) => handleChange('topP', parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="text-sm text-gray-500 mt-1">
            Альтернатива температуре, контролирует разнообразие через вероятности.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Штраф за частоту ({settings.frequencyPenalty})
          </label>
          <input
            type="range"
            min="-2"
            max="2"
            step="0.1"
            value={settings.frequencyPenalty}
            onChange={(e) => handleChange('frequencyPenalty', parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="text-sm text-gray-500 mt-1">
            Снижает вероятность повторения одних и тех же фраз.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Штраф за присутствие ({settings.presencePenalty})
          </label>
          <input
            type="range"
            min="-2"
            max="2"
            step="0.1"
            value={settings.presencePenalty}
            onChange={(e) => handleChange('presencePenalty', parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="text-sm text-gray-500 mt-1">
            Увеличивает вероятность обсуждения новых тем.
          </p>
        </div>
      </div>
    </div>
  );
};
