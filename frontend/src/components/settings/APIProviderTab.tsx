import React, { useEffect, useState } from 'react';
import { OpenRouterConfig, OpenRouterModel, getOpenRouterModels } from '../../api/openRouter';

interface APIProviderTabProps {
  config: OpenRouterConfig | null;
  onConfigChange: (config: OpenRouterConfig) => void;
}

export const APIProviderTab: React.FC<APIProviderTabProps> = ({
  config,
  onConfigChange,
}) => {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        const modelsList = await getOpenRouterModels();
        setModels(modelsList);
      } catch (error) {
        console.error('Error fetching models:', error);
      } finally {
        setLoading(false);
      }
    };

    if (config?.apiKey) {
      fetchModels();
    }
  }, [config?.apiKey]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
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
          Model
        </label>
        <select
          name="modelId"
          value={config?.modelId || ''}
          onChange={handleInputChange}
          className="w-full p-2 border border-gray-300 rounded-md"
          disabled={loading || !config?.apiKey}
        >
          <option value="">Выберите модель</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} ({model.pricing.prompt} / {model.pricing.completion})
            </option>
          ))}
        </select>
        {loading && (
          <p className="text-sm text-gray-500 mt-1">
            Загрузка списка моделей...
          </p>
        )}
        {!config?.apiKey && (
          <p className="text-sm text-gray-500 mt-1">
            Введите API ключ для загрузки списка моделей
          </p>
        )}
      </div>
    </div>
  );
};
