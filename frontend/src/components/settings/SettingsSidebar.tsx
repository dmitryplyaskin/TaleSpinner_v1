import React, { useState } from 'react';
import { LLMSettingsTab, LLMSettings } from './LLMSettingsTab';
import { APIProviderTab } from './APIProviderTab';
import { OpenRouterConfig } from '../api';

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onLLMSettingsChange: (settings: LLMSettings) => void;
  onAPIConfigChange: (config: OpenRouterConfig) => void;
  apiConfig: OpenRouterConfig | null;
}

type TabType = 'llm' | 'provider';

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  isOpen,
  onClose,
  onLLMSettingsChange,
  onAPIConfigChange,
  apiConfig,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('llm');
  const [llmSettings, setLLMSettings] = useState<LLMSettings>({
    temperature: 0.7,
    maxTokens: 2000,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
  });

  const handleLLMSettingsChange = (newSettings: LLMSettings) => {
    setLLMSettings(newSettings);
    onLLMSettingsChange(newSettings);
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 h-screen bg-white border-l border-gray-200 p-4 fixed right-0 top-0 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Настройки</h2>
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

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('llm')}
              className={`mr-4 py-2 px-1 border-b-2 ${
                activeTab === 'llm'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Настройки LLM
            </button>
            <button
              onClick={() => setActiveTab('provider')}
              className={`py-2 px-1 border-b-2 ${
                activeTab === 'provider'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              API Provider
            </button>
          </nav>
        </div>
      </div>

      <div>
        {activeTab === 'llm' && (
          <LLMSettingsTab
            settings={llmSettings}
            onSettingsChange={handleLLMSettingsChange}
          />
        )}
        {activeTab === 'provider' && (
          <APIProviderTab
            config={apiConfig}
            onConfigChange={onAPIConfigChange}
          />
        )}
      </div>
    </div>
  );
};
