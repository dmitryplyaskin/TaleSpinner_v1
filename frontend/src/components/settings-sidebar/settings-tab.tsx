import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { llmSettingsFields, LLMSettingField } from '../../model/llm-settings';
import { Box, SimpleGrid, Text, Icon, Flex, Input } from '@chakra-ui/react';
import { LuCopy, LuInfo, LuPlus, LuSave, LuTrash2 } from 'react-icons/lu';
import { Tooltip } from '../../ui/chakra-core-ui/tooltip';
import { Slider } from '../../ui/chakra-core-ui/slider';
import { Select } from 'chakra-react-select';
import { createEmptySampler, samplersModel } from '@model/samplers';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { SamplerItemSettingsType, SamplersItemType } from '@shared/types/samplers';
import { FormProvider, useController, useForm, UseFormReturn } from 'react-hook-form';

export interface LLMSettings {
	temperature: number;
	maxTokens: number;
	topP: number;
	frequencyPenalty: number;
	presencePenalty: number;
}

export const SamplerSettingsTab: React.FC = () => {
	const settings = useUnit(samplersModel.$settings);
	const items = useUnit(samplersModel.$items);

	const methods = useForm<SamplerItemSettingsType>({
		defaultValues: items.find((instr) => instr.id === settings.selectedId)?.settings,
	});

	useEffect(() => {
		methods.reset(items.find((instr) => instr.id === settings.selectedId)?.settings);
	}, [settings.selectedId]);

	const handleSave = () => {
		const item = items.find((instr) => instr.id === settings.selectedId) as SamplersItemType;
		const newItem = { ...item, settings: methods.getValues() } as SamplersItemType;

		samplersModel.updateItemFx(newItem);
	};

	useEffect(() => {
		const { unsubscribe } = methods.watch((data) => {
			const item = items.find((instr) => instr.id === settings.selectedId) as SamplersItemType;
			const newItem = { ...item, settings: data } as SamplersItemType;

			samplersModel.changeItemDebounced(newItem);
		});
		return () => {
			unsubscribe();
		};
	}, [methods.watch]);

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
						tooltip="Сохранить шаблон"
						icon={<LuSave />}
						aria-label="Save template"
						onClick={handleSave}
					/>
					<IconButtonWithTooltip
						tooltip="Создать шаблон"
						icon={<LuPlus />}
						aria-label="Create template"
						onClick={() => samplersModel.createItemFx(createEmptySampler(methods.getValues()))}
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

			<FormProvider {...methods}>
				<SimpleGrid columns={3} gap={4}>
					{llmSettingsFields.map((field) => (
						<Item key={field.key} field={field} methods={methods} />
					))}
				</SimpleGrid>
			</FormProvider>
		</Flex>
	);
};

type ItemProps = {
	field: LLMSettingField;
	methods: UseFormReturn<SamplerItemSettingsType>;
};

const Item: React.FC<ItemProps> = ({ field, methods }) => {
	const formField = useController({
		name: field.key,
		control: methods.control,
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
				variant="outline"
				colorPalette="purple"
				value={[formField.field.value]}
				onChange={(value) => {
					formField.field.onChange(Number(value.target.value));
				}}
			/>
			<Input
				type="number"
				size="sm"
				min={field.min}
				max={field.max}
				step={field.step}
				value={formField.field.value}
				onChange={(e) => {
					formField.field.onChange(Number(e.target.value));
				}}
				onBlur={(e) => {
					formField.field.onBlur();
				}}
			/>
		</Box>
	);
};
