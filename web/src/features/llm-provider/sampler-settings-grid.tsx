import { ActionIcon, Box, Group, NumberInput, Select, SimpleGrid, Slider, Switch, Text, Tooltip } from '@mantine/core';
import React from 'react';
import { useController, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { InfoIcon } from '@ui/icons';

import type { LLMSettingField } from '@model/llm-settings';

type Props = {
	control: Control<any>;
	fields: LLMSettingField[];
	fieldPrefix?: string;
	columns?: number;
};

function buildFieldName(prefix: string | undefined, key: string): string {
	return prefix && prefix.length > 0 ? `${prefix}.${key}` : key;
}

function toNumber(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

export const SamplerSettingsGrid: React.FC<Props> = ({ control, fields, fieldPrefix, columns = 3 }) => {
	return (
		<SimpleGrid cols={columns} spacing="sm">
			{fields.map((field) => (
				<SamplerSettingsGridItem
					key={field.key}
					columns={columns}
					control={control}
					field={field}
					name={buildFieldName(fieldPrefix, field.key)}
				/>
			))}
		</SimpleGrid>
	);
};

type ItemProps = {
	columns: number;
	control: Control<any>;
	field: LLMSettingField;
	name: string;
};

const FIELD_CONTAINER_STYLE = {
	border: '1px solid var(--mantine-color-default-border)',
	borderRadius: 'var(--mantine-radius-md)',
	background: 'var(--mantine-color-body)',
} as const;

const NUMBER_INPUT_WIDTH = 108;

const SamplerSettingsGridItem: React.FC<ItemProps> = ({ columns, control, field, name }) => {
	const { t } = useTranslation();
	const formField = useController({
		name,
		control,
	});
	const numericFallback = typeof field.defaultValue === 'number' ? field.defaultValue : 0;
	const boolFallback = typeof field.defaultValue === 'boolean' ? field.defaultValue : false;
	const textFallback = typeof field.defaultValue === 'string' ? field.defaultValue : '';
	const numericValue = toNumber(formField.field.value, numericFallback);
	const boolValue = toBoolean(formField.field.value, boolFallback);
	const textValue = typeof formField.field.value === 'string' ? formField.field.value : textFallback;
	const span = Math.min(field.width, columns);

	return (
		<Box p="sm" style={{ ...FIELD_CONTAINER_STYLE, gridColumn: `span ${span}` }}>
			<Group gap={6} mb={8} wrap="nowrap">
				<Text size="sm" fw={500} style={{ flex: 1, minWidth: 0 }}>
					{field.label}
				</Text>
				<Tooltip label={field.tooltip} position="bottom" withArrow>
					<ActionIcon variant="subtle" size="sm" aria-label={t('common.info')}>
							<InfoIcon />
						</ActionIcon>
					</Tooltip>
			</Group>

			{field.type === 'switch' ? (
				<Switch
					size="md"
					checked={boolValue}
					onChange={(event) => {
						formField.field.onChange(event.currentTarget.checked);
					}}
				/>
			) : null}

			{field.type === 'select' ? (
				<Select
					size="sm"
					data={field.options?.map((option) => ({ value: option.value, label: option.label })) ?? []}
					value={textValue}
					onChange={(nextValue) => {
						formField.field.onChange(nextValue ?? textFallback);
					}}
					allowDeselect={false}
					comboboxProps={{ withinPortal: false }}
				/>
			) : null}

			{field.type === 'number' ? (
				<NumberInput
					size="sm"
					min={field.min}
					max={field.max}
					step={field.step}
					value={numericValue}
					onChange={(nextValue) => {
						formField.field.onChange(typeof nextValue === 'number' ? nextValue : numericFallback);
					}}
					onBlur={() => {
						formField.field.onBlur();
					}}
				/>
			) : null}

			{field.type === 'range' ? (
				<Group gap="sm" align="center" wrap="nowrap">
					<Box style={{ flex: 1, minWidth: 0, paddingInline: 4 }}>
						<Slider
							size="sm"
							min={field.min}
							max={field.max}
							step={field.step}
							value={numericValue}
							onChange={(nextValue) => {
								formField.field.onChange(nextValue);
							}}
						/>
					</Box>
					<NumberInput
						size="sm"
						min={field.min}
						max={field.max}
						step={field.step}
						value={numericValue}
						style={{ width: NUMBER_INPUT_WIDTH, flex: `0 0 ${NUMBER_INPUT_WIDTH}px` }}
						onChange={(nextValue) => {
							formField.field.onChange(typeof nextValue === 'number' ? nextValue : numericFallback);
						}}
						onBlur={() => {
							formField.field.onBlur();
						}}
					/>
				</Group>
			) : null}
		</Box>
	);
};
