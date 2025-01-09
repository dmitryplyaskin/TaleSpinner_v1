import React, { useState } from "react";
import { LLMSettingsTab, LLMSettings } from "./LLMSettingsTab";
import { APIProviderTab } from "./APIProviderTab";
import { OpenRouterConfig } from "../api";
import { Button, Flex, Heading, Tabs, Icon } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";
import {
  DrawerRoot,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
} from "../../ui/chakra-core-ui/drawer";
import { $sidebars, closeSidebar } from "@/model/sidebars";
import { useUnit } from "effector-react";

interface SettingsSidebarProps {
  onLLMSettingsChange: (settings: LLMSettings) => void;
  onAPIConfigChange: (config: OpenRouterConfig) => void;
  apiConfig: OpenRouterConfig | null;
}

type TabType = "llm" | "provider";

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  onLLMSettingsChange,
  onAPIConfigChange,
  apiConfig,
}) => {
  const { settings: isOpen } = useUnit($sidebars);
  const handleClose = () => {
    closeSidebar("settings");
  };
  const [activeTab, setActiveTab] = useState<TabType>("llm");
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
    <DrawerRoot open={isOpen} onClose={handleClose} placement="end" size="lg">
      <DrawerContent>
        <DrawerHeader borderBottomWidth="1px">
          <Flex justify="space-between" align="center">
            <Heading size="md">Settings</Heading>
            <Button
              variant="ghost"
              onClick={handleClose}
              size="sm"
              aria-label="Закрыть"
            >
              <Icon>
                <LuX />
              </Icon>
            </Button>
          </Flex>
        </DrawerHeader>

        <DrawerBody>
          <Tabs.Root
            colorPalette={"purple"}
            size={"md"}
            variant={"enclosed"}
            // index={activeTab === "llm" ? 0 : 1}
          >
            <Tabs.List mb={6}>
              <Tabs.Trigger
                value="settings"
                onClick={() => setActiveTab("llm")}
              >
                Настройки LLM
              </Tabs.Trigger>
              <Tabs.Trigger
                value="provider"
                onClick={() => setActiveTab("provider")}
              >
                API Provider
              </Tabs.Trigger>
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
