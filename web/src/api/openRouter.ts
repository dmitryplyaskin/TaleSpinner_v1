import { BASE_URL } from "../const";

export interface OpenRouterConfig {
  apiKey: string;
  modelId: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string;
    completion: string;
  };
}

export const getOpenRouterConfig = async (): Promise<OpenRouterConfig> => {
  const response = await fetch(`${BASE_URL}/config/openrouter`);
  if (!response.ok) {
    throw new Error('Failed to fetch OpenRouter config');
  }
  return response.json();
};

export const updateOpenRouterConfig = async (config: OpenRouterConfig): Promise<void> => {
  const response = await fetch(`${BASE_URL}/config/openrouter`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error('Failed to update OpenRouter config');
  }
};

export const getOpenRouterModels = async (): Promise<OpenRouterModel[]> => {
  const response = await fetch(`${BASE_URL}/models`);
  if (!response.ok) {
    throw new Error('Failed to fetch OpenRouter models');
  }
  return response.json();
};
