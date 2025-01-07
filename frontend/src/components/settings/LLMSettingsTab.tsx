import React from "react";
import { useStoreMap } from "effector-react";
import {
  $llmSettings,
  updateLLMSettings,
  llmSettingsFields,
  LLMSettingsState,
  LLMSettingField,
} from "../../model/llm-settings";
import { Box, SimpleGrid, Text, Icon, Flex, Input } from "@chakra-ui/react";
import { LuInfo } from "react-icons/lu";
import { Tooltip } from "../ui/tooltip";
import { Slider } from "../ui/slider";

export interface LLMSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

// interface LLMSettingsTabProps {
//   settings: LLMSettings;
//   onSettingsChange: (settings: LLMSettings) => void;
// }

export const LLMSettingsTab: React.FC = () => {
  const handleChange = (key: keyof LLMSettingsState, value: number) => {
    updateLLMSettings({ [key]: value });
  };

  return (
    <SimpleGrid columns={3} gap={4}>
      {llmSettingsFields.map((field) => (
        <Item key={field.key} field={field} handleChange={handleChange} />
      ))}
    </SimpleGrid>
  );
};

type ItemProps = {
  field: LLMSettingField;
  handleChange: (key: keyof LLMSettingsState, value: number) => void;
};

const Item: React.FC<ItemProps> = ({ field, handleChange }) => {
  const value = useStoreMap({
    store: $llmSettings,
    keys: [field.key],
    fn: (llmSettings, key) => llmSettings[key as keyof LLMSettingsState],
  });

  return (
    <Box
      key={field.key}
      gridColumn={`span ${field.width}`}
      p={3}
      borderWidth="1px"
      borderRadius="lg"
      shadow="sm"
    >
      <Flex alignItems="flex-start" justifyContent="space-between" mb={2}>
        <Box flex="1">
          <Flex alignItems="center" gap={2}>
            <Text fontSize="sm" fontWeight="medium" color="gray.700">
              {field.label}
            </Text>
            <Tooltip
              content={field.tooltip}
              positioning={{ placement: "bottom" }}
              showArrow
            >
              <Icon w={4} h={4} color="gray.400" cursor="help">
                <LuInfo />
              </Icon>
            </Tooltip>
          </Flex>
          <Text fontSize="sm" color="gray.500" mt={1}>
            Значение: {value}
          </Text>
        </Box>
      </Flex>
      <Slider
        min={field.min}
        max={field.max}
        step={field.step}
        size="md"
        variant="outline"
        colorPalette="purple"
        value={[value]}
        onChange={(value) => {
          handleChange(
            field.key as keyof LLMSettingsState,
            Number(value.target.value)
          );
        }}
      />
      <Input
        type="number"
        size="sm"
        marginTop={2}
        min={field.min}
        max={field.max}
        step={field.step}
        value={value}
        onChange={(e) => {
          handleChange(
            field.key as keyof LLMSettingsState,
            Number(e.target.value)
          );
        }}
        onBlur={(e) => {
          handleChange(
            field.key as keyof LLMSettingsState,
            Number(e.target.value)
          );
        }}
      />
    </Box>
  );
};
