import React, { useState } from "react";
import { LLMSettingsTab, LLMSettings } from "./settings-tab";
import { APIProviderTab } from "./api-provoder-tab";
import { OpenRouterConfig } from "../api";
import { Flex, Heading, Tabs } from "@chakra-ui/react";

import {
  DrawerRoot,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
} from "../../ui/chakra-core-ui/drawer";
import { $sidebars, closeSidebar } from "@model/sidebars";
import { useUnit } from "effector-react";
import { CloseButton } from "@ui/chakra-core-ui/close-button";

interface SettingsSidebarProps {
  onLLMSettingsChange: (settings: LLMSettings) => void;
  onAPIConfigChange: (config: OpenRouterConfig) => void;
  apiConfig: OpenRouterConfig | null;
}

type TabType = "settings" | "provider";

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  onLLMSettingsChange,
  onAPIConfigChange,
  apiConfig,
}) => {
  const { settings: isOpen } = useUnit($sidebars);
  const handleClose = () => {
    closeSidebar("settings");
  };
  const [activeTab, setActiveTab] = useState<TabType>("settings");

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
    <DrawerRoot
      open={isOpen}
      placement="end"
      size="lg"
      onOpenChange={handleClose}
    >
      <DrawerContent>
        <DrawerHeader borderBottomWidth="1px">
          <Flex justify="space-between" align="center">
            <Heading size="md">Settings</Heading>
            <CloseButton onClick={handleClose} />
          </Flex>
        </DrawerHeader>

        <DrawerBody>
          <Tabs.Root
            colorPalette={"purple"}
            size={"md"}
            variant={"enclosed"}
            value={activeTab}
            onValueChange={(e) => setActiveTab(e.value as TabType)}
          >
            <Tabs.List mb={6}>
              <Tabs.Trigger value="settings">Настройки LLM</Tabs.Trigger>
              <Tabs.Trigger value="provider">API Provider</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="settings" p={0}>
              <LLMSettingsTab
                settings={llmSettings}
                onSettingsChange={handleLLMSettingsChange}
              />
            </Tabs.Content>
            <Tabs.Content value="provider">
              <APIProviderTab
                config={apiConfig}
                onConfigChange={onAPIConfigChange}
              />
            </Tabs.Content>
          </Tabs.Root>
        </DrawerBody>
      </DrawerContent>
    </DrawerRoot>
  );
};
