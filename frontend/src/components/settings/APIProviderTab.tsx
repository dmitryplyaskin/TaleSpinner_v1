import React from 'react';
import { OpenRouterConfig } from '../api';

interface APIProviderTabProps {
  config: OpenRouterConfig | null;
  onConfigChange: (config: OpenRouterConfig) => void;
}

export const APIProviderTab: React.FC<APIProviderTabProps> = ({
  config,
  onConfigChange,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (config) {
      onConfigChange({
        ...config,
        [e.target.name]: e.target.value,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          API Provider
        </label>
        <select
          className="w-full p-2 border border-gray-300 rounded-md"
          value="openrouter"
          disabled
        >
          <option value="openrouter">OpenRouter</option>
        </select>
        <p className="text-sm text-gray-500 mt-1">
          В настоящее время поддерживается только OpenRouter
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          API Key
        </label>
        <input
          type="password"
          name="apiKey"
          value={config?.apiKey || ''}
          onChange={handleInputChange}
          placeholder="Введите API ключ"
          className="w-full p-2 border border-gray-300 rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Model ID
        </label>
        <input
          type="text"
          name="modelId"
          value={config?.modelId || ''}
          onChange={handleInputChange}
          placeholder="Введите ID модели"
          className="w-full p-2 border border-gray-300 rounded-md"
        />
      </div>
    </div>
  );
};
