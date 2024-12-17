import React from 'react';

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

export const LLMSettingsTab: React.FC<LLMSettingsTabProps> = ({
  settings,
  onSettingsChange,
}) => {
  const handleChange = (key: keyof LLMSettings, value: number) => {
    const newSettings = { ...settings, [key]: value };
    onSettingsChange(newSettings);
  };

  return (
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
          step="0.1"
          value={settings.topP}
          onChange={(e) => handleChange('topP', parseFloat(e.target.value))}
          className="w-full"
        />
        <p className="text-sm text-gray-500 mt-1">
          Альтернатива температуре, контролирует разнообразие через вероятностное усечение.
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
          Снижает вероятность обсуждения уже затронутых тем.
        </p>
      </div>
    </div>
  );
};
