import React, { useEffect, useState } from 'react';
import { useStoreMap, useUnit } from 'effector-react';
import { $llmSettings, llmSettingsFields, LLMSettingsState, LLMSettingField } from '../../model/llm-settings';
import { Box, SimpleGrid, Text, Icon, Flex, Input } from '@chakra-ui/react';
import { LuCopy, LuInfo, LuPlus, LuTrash2 } from 'react-icons/lu';
import { Tooltip } from '../../ui/chakra-core-ui/tooltip';
import { Slider } from '../../ui/chakra-core-ui/slider';
import { Select } from 'chakra-react-select';
import { createEmptySampler, samplersModel } from '@model/samplers';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { SamplerItemSettingsType, SamplersItemType } from '@shared/types/samplers';

export interface LLMSettings {
	temperature: number;
	maxTokens: number;
	topP: number;
	frequencyPenalty: number;
	presencePenalty: number;
}

export const LLMSettingsTab: React.FC = () => {
	const settings = useUnit(samplersModel.$settings);
	const items = useUnit(samplersModel.$items);
	const [state, setState] = useState<SamplerItemSettingsType>({});

	const handleChange = (key: keyof LLMSettingsState, value: number) => {
		setState({ [key]: value });
		// updateLLMSettings({ [key]: value });
	};

	useEffect(() => {
		samplersModel.getItemsFx();
		samplersModel.getSettingsFx();
	}, []);

	const options = items.map((item) => ({
		label: item.name,
		value: item.id,
	}));

	return (
		<Flex flexDirection="column" gap={4}>
			<Flex gap={4}>
				<Select
					value={settings?.selectedId ? options.find((instr) => instr.value === settings.selectedId) : null}
					onChange={(selected) => samplersModel.updateSettingsFx({ ...settings, selectedId: selected?.value })}
					options={options}
					placeholder="Выберите алгоритм"
				/>
				<Box display="flex" gap={2} alignSelf="flex-end">
					<IconButtonWithTooltip
						tooltip="Создать шаблон"
						icon={<LuPlus />}
						aria-label="Create template"
						onClick={() => samplersModel.createItemFx(createEmptySampler(state))}
					/>
					<IconButtonWithTooltip
						tooltip="Дублировать шаблон"
						icon={<LuCopy />}
						aria-label="Duplicate template"
						disabled={!settings.selectedId}
						onClick={() =>
							samplersModel.duplicateItemFx(items.find((instr) => instr.id === settings.selectedId) as SamplersItemType)
						}
					/>

					<IconButtonWithTooltip
						tooltip="Удалить шаблон"
						icon={<LuTrash2 />}
						aria-label="Delete template"
						disabled={!settings.selectedId}
						onClick={() => samplersModel.deleteItemFx(settings.selectedId as string)}
					/>
				</Box>
			</Flex>

			<SimpleGrid columns={3} gap={4}>
				{llmSettingsFields.map((field) => (
					<Item key={field.key} field={field} handleChange={handleChange} />
				))}
			</SimpleGrid>
		</Flex>
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
		<Box key={field.key} gridColumn={`span ${field.width}`} p={3} borderWidth="1px" borderRadius="lg" shadow="sm">
			<Flex alignItems="flex-start" justifyContent="space-between" mb={2}>
				<Box flex="1">
					<Flex alignItems="center" gap={2}>
						<Text fontSize="sm" fontWeight="medium" color="gray.700">
							{field.label}
						</Text>
						<Tooltip content={field.tooltip} positioning={{ placement: 'bottom' }} showArrow>
							<Icon w={4} h={4} color="gray.400" cursor="help">
								<LuInfo />
							</Icon>
						</Tooltip>
					</Flex>
				</Box>
			</Flex>
			<Slider
				min={field.min}
				max={field.max}
				step={field.step}
				size="md"
				zIndex={2}
				variant="outline"
				colorPalette="purple"
				value={[value]}
				onChange={(value) => {
					handleChange(field.key as keyof LLMSettingsState, Number(value.target.value));
				}}
			/>
			<Input
				type="number"
				size="sm"
				min={field.min}
				max={field.max}
				step={field.step}
				value={value}
				onChange={(e) => {
					handleChange(field.key as keyof LLMSettingsState, Number(e.target.value));
				}}
				onBlur={(e) => {
					handleChange(field.key as keyof LLMSettingsState, Number(e.target.value));
				}}
			/>
		</Box>
	);
};
