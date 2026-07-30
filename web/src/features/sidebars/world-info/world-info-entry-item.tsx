import { Accordion, Group, NumberInput, Select, Stack, TagsInput, Text } from '@mantine/core';
import React, { memo } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';


import { FormInput, FormMultiSelect, FormSwitch, FormTextarea } from '@ui/form-components';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, TrashIcon } from '@ui/icons';

import {
	parseNullableBool,
	ST_TRIGGER_OPTIONS,
	toNullableBool,
	type BookDraft,
	type EntryDraft,
	type EntryStateMode,
	type NullableBoolSelect,
	getEntryLabelFromDraft,
} from './world-info-editor-shared';

type Props = {
	index: number;
	entryId: string;
	canMoveUp: boolean;
	canMoveDown: boolean;
	isExpanded: boolean;
	onMove: (entryId: string, direction: 'up' | 'down') => void;
	onDuplicate: (entryId: string) => void;
	onDelete: (entryId: string) => void;
};

export const WorldInfoEntryItem: React.FC<Props> = memo(({ index, entryId, canMoveUp, canMoveDown, isExpanded, onMove, onDuplicate, onDelete }) => {
	const { t } = useTranslation();
	const { control, setValue } = useFormContext<BookDraft>();
	const basePath = `entries.${index}.draft` as const;

	const comment = useWatch({ control, name: `${basePath}.comment` }) as string | undefined;
	const key = useWatch({ control, name: `${basePath}.key` }) as string[] | undefined;
	const position = useWatch({ control, name: `${basePath}.position` }) as EntryDraft['position'] | undefined;
	const constant = useWatch({ control, name: `${basePath}.constant` }) as boolean | undefined;
	const vectorized = useWatch({ control, name: `${basePath}.vectorized` }) as boolean | undefined;

	const strategyMode: EntryStateMode = constant ? 'constant' : vectorized ? 'vectorized' : 'normal';
	const label = getEntryLabelFromDraft(entryId, comment, key);

	return (
		<Accordion.Item value={entryId}>
			<Accordion.Control>
				<Group justify="space-between" align="center" wrap="nowrap" style={{ width: '100%' }}>
					<Stack gap={0}>
						<Text fw={600}>{label}</Text>
						<Text size="xs" c="dimmed">
							{t('worldInfo.editor.entryTitle', { id: entryId })}
						</Text>
					</Stack>
					<Group gap={4} wrap="nowrap">
						<IconButtonWithTooltip
							icon={<ArrowUpIcon />}
							tooltip={t('worldInfo.editor.actions.moveUp')}
							aria-label={t('worldInfo.editor.actions.moveUp')}
							disabled={!canMoveUp}
							onMouseDown={(event) => {
								event.preventDefault();
								event.stopPropagation();
							}}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onMove(entryId, 'up');
							}}
						/>
						<IconButtonWithTooltip
							icon={<ArrowDownIcon />}
							tooltip={t('worldInfo.editor.actions.moveDown')}
							aria-label={t('worldInfo.editor.actions.moveDown')}
							disabled={!canMoveDown}
							onMouseDown={(event) => {
								event.preventDefault();
								event.stopPropagation();
							}}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onMove(entryId, 'down');
							}}
						/>
						<IconButtonWithTooltip
							icon={<CopyIcon />}
							tooltip={t('worldInfo.editor.duplicateEntry')}
							aria-label={t('worldInfo.editor.duplicateEntry')}
							onMouseDown={(event) => {
								event.preventDefault();
								event.stopPropagation();
							}}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onDuplicate(entryId);
							}}
						/>
						<IconButtonWithTooltip
							icon={<TrashIcon />}
							tooltip={t('worldInfo.editor.deleteEntry')}
							aria-label={t('worldInfo.editor.deleteEntry')}
							colorPalette="red"
							onMouseDown={(event) => {
								event.preventDefault();
								event.stopPropagation();
							}}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onDelete(entryId);
							}}
						/>
					</Group>
				</Group>
			</Accordion.Control>
			<Accordion.Panel>
				{isExpanded ? (
					<Stack gap="sm" pb="md">
						<FormInput name={`${basePath}.comment`} label={t('worldInfo.editor.fields.comment')} />
						<Group grow align="end">
							<Select
								label={t('worldInfo.editor.fields.strategy')}
								data={[
									{ value: 'normal', label: t('worldInfo.editor.strategy.normal') },
									{ value: 'constant', label: t('worldInfo.editor.strategy.constant') },
									{ value: 'vectorized', label: t('worldInfo.editor.strategy.vectorized') },
								]}
								value={strategyMode}
								onChange={(value) => {
									const mode = (value as EntryStateMode) ?? 'normal';
									setValue(`${basePath}.constant`, mode === 'constant', { shouldDirty: true });
									setValue(`${basePath}.vectorized`, mode === 'vectorized', { shouldDirty: true });
								}}
								comboboxProps={{ withinPortal: false }}
							/>
							<Controller
								control={control}
								name={`${basePath}.position`}
								render={({ field }) => (
									<Select
										label={t('worldInfo.editor.fields.position')}
										data={[
											{ value: '0', label: 'before' },
											{ value: '1', label: 'after' },
											{ value: '2', label: 'ANTop' },
											{ value: '3', label: 'ANBottom' },
											{ value: '4', label: '@depth' },
											{ value: '5', label: 'EMTop' },
											{ value: '6', label: 'EMBottom' },
											{ value: '7', label: 'outlet' },
										]}
										value={String(field.value ?? 0)}
										onChange={(value) => field.onChange((Number(value) || 0) as EntryDraft['position'])}
										comboboxProps={{ withinPortal: false }}
									/>
								)}
							/>
							<Controller
								control={control}
								name={`${basePath}.depth`}
								render={({ field }) => (
									<NumberInput label={t('worldInfo.editor.fields.depth')} min={0} value={field.value ?? 0} onChange={(value) => field.onChange(Math.max(0, Number(value) || 0))} />
								)}
							/>
							<Controller control={control} name={`${basePath}.order`} render={({ field }) => <NumberInput label={t('worldInfo.editor.fields.order')} value={field.value ?? 0} onChange={(value) => field.onChange(Number(value) || 0)} />} />
							<Controller control={control} name={`${basePath}.probability`} render={({ field }) => <NumberInput label={t('worldInfo.editor.fields.probability')} min={0} max={100} value={field.value ?? 0} onChange={(value) => field.onChange(Math.max(0, Math.min(100, Number(value) || 0)))} />} />
						</Group>
						<Group grow>
							<FormSwitch name={`${basePath}.useProbability`} label={t('worldInfo.editor.fields.useProbability')} />
							<FormSwitch name={`${basePath}.disable`} label={t('worldInfo.editor.fields.disable')} />
							{position === 7 ? (
								<FormInput name={`${basePath}.outletName`} label={t('worldInfo.editor.fields.outletName')} />
							) : (
								<Controller
									control={control}
									name={`${basePath}.role`}
									render={({ field }) => (
										<Select
											label={t('worldInfo.editor.fields.role')}
											data={[
												{ value: '0', label: 'system' },
												{ value: '1', label: 'user' },
												{ value: '2', label: 'assistant' },
											]}
											value={String(field.value ?? 0)}
											onChange={(value) => field.onChange((Number(value) || 0) as EntryDraft['role'])}
											comboboxProps={{ withinPortal: false }}
										/>
									)}
								/>
							)}
						</Group>
						<Controller control={control} name={`${basePath}.key`} render={({ field }) => <TagsInput label={t('worldInfo.editor.fields.key')} value={Array.isArray(field.value) ? field.value : []} onChange={(value) => field.onChange(value)} />} />
						<Group grow align="end">
							<Controller
								control={control}
								name={`${basePath}.selectiveLogic`}
								render={({ field }) => (
									<Select
										label={t('worldInfo.editor.fields.selectiveLogic')}
										data={[
											{ value: '0', label: 'AND ANY' },
											{ value: '1', label: 'NOT ALL' },
											{ value: '2', label: 'NOT ANY' },
											{ value: '3', label: 'AND ALL' },
										]}
										value={String(field.value ?? 0)}
										onChange={(value) => field.onChange((Number(value) || 0) as EntryDraft['selectiveLogic'])}
										comboboxProps={{ withinPortal: false }}
									/>
								)}
							/>
							<FormSwitch name={`${basePath}.selective`} label={t('worldInfo.editor.fields.selective')} />
						</Group>
						<Controller control={control} name={`${basePath}.keysecondary`} render={({ field }) => <TagsInput label={t('worldInfo.editor.fields.keysecondary')} value={Array.isArray(field.value) ? field.value : []} onChange={(value) => field.onChange(value)} />} />
						<Group grow align="end">
							<Controller control={control} name={`${basePath}.scanDepth`} render={({ field }) => <NumberInput label={t('worldInfo.editor.fields.scanDepth')} min={0} value={field.value ?? ''} onChange={(value) => field.onChange(value === '' ? null : Number(value) || 0)} />} />
							<Controller control={control} name={`${basePath}.caseSensitive`} render={({ field }) => <Select label={t('worldInfo.editor.fields.caseSensitive')} data={[{ value: 'inherit', label: t('worldInfo.editor.inherit') }, { value: 'true', label: t('worldInfo.editor.true') }, { value: 'false', label: t('worldInfo.editor.false') }]} value={toNullableBool((field.value as boolean | null) ?? null)} onChange={(value) => field.onChange(parseNullableBool((value as NullableBoolSelect) ?? 'inherit'))} comboboxProps={{ withinPortal: false }} />} />
							<Controller control={control} name={`${basePath}.matchWholeWords`} render={({ field }) => <Select label={t('worldInfo.editor.fields.matchWholeWords')} data={[{ value: 'inherit', label: t('worldInfo.editor.inherit') }, { value: 'true', label: t('worldInfo.editor.true') }, { value: 'false', label: t('worldInfo.editor.false') }]} value={toNullableBool((field.value as boolean | null) ?? null)} onChange={(value) => field.onChange(parseNullableBool((value as NullableBoolSelect) ?? 'inherit'))} comboboxProps={{ withinPortal: false }} />} />
							<Controller control={control} name={`${basePath}.useGroupScoring`} render={({ field }) => <Select label={t('worldInfo.editor.fields.useGroupScoring')} data={[{ value: 'inherit', label: t('worldInfo.editor.inherit') }, { value: 'true', label: t('worldInfo.editor.true') }, { value: 'false', label: t('worldInfo.editor.false') }]} value={toNullableBool((field.value as boolean | null) ?? null)} onChange={(value) => field.onChange(parseNullableBool((value as NullableBoolSelect) ?? 'inherit'))} comboboxProps={{ withinPortal: false }} />} />
							<FormInput name={`${basePath}.automationId`} label={t('worldInfo.editor.fields.automationId')} />
						</Group>
						<Group grow>
							<FormSwitch name={`${basePath}.excludeRecursion`} label={t('worldInfo.editor.fields.excludeRecursion')} />
							<FormSwitch name={`${basePath}.preventRecursion`} label={t('worldInfo.editor.fields.preventRecursion')} />
							<FormSwitch name={`${basePath}.ignoreBudget`} label={t('worldInfo.editor.fields.ignoreBudget')} />
							<Controller control={control} name={`${basePath}.delayUntilRecursion`} render={({ field }) => <NumberInput label={t('worldInfo.editor.fields.delayUntilRecursion')} min={0} value={field.value ?? 0} onChange={(value) => field.onChange(Math.max(0, Number(value) || 0))} />} />
						</Group>
						<FormTextarea name={`${basePath}.content`} label={t('worldInfo.editor.fields.content')} liquidDocsContext="world_info_entry" textareaProps={{ minRows: 8, autosize: true }} />
						<Group grow align="end">
							<FormInput name={`${basePath}.group`} label={t('worldInfo.editor.fields.group')} />
							<FormSwitch name={`${basePath}.groupOverride`} label={t('worldInfo.editor.fields.groupOverride')} />
							<Controller control={control} name={`${basePath}.groupWeight`} render={({ field }) => <NumberInput label={t('worldInfo.editor.fields.groupWeight')} min={0} value={field.value ?? 0} onChange={(value) => field.onChange(Math.max(0, Number(value) || 0))} />} />
							<Controller control={control} name={`${basePath}.sticky`} render={({ field }) => <NumberInput label={t('worldInfo.editor.fields.sticky')} min={0} value={field.value ?? ''} onChange={(value) => field.onChange(value === '' ? null : Number(value) || 0)} />} />
							<Controller control={control} name={`${basePath}.cooldown`} render={({ field }) => <NumberInput label={t('worldInfo.editor.fields.cooldown')} min={0} value={field.value ?? ''} onChange={(value) => field.onChange(value === '' ? null : Number(value) || 0)} />} />
							<Controller control={control} name={`${basePath}.delay`} render={({ field }) => <NumberInput label={t('worldInfo.editor.fields.delay')} min={0} value={field.value ?? ''} onChange={(value) => field.onChange(value === '' ? null : Number(value) || 0)} />} />
						</Group>
						<Group grow>
							<FormSwitch name={`${basePath}.characterFilter.isExclude`} label={t('worldInfo.editor.fields.characterFilterExclude')} />
							<Controller control={control} name={`${basePath}.characterFilter.names`} render={({ field }) => <TagsInput label={t('worldInfo.editor.fields.characterFilterNames')} value={Array.isArray(field.value) ? field.value : []} onChange={(value) => field.onChange(value)} />} />
							<Controller control={control} name={`${basePath}.characterFilter.tags`} render={({ field }) => <TagsInput label={t('worldInfo.editor.fields.characterFilterTags')} value={Array.isArray(field.value) ? field.value : []} onChange={(value) => field.onChange(value)} />} />
						</Group>
						<FormMultiSelect
							name={`${basePath}.triggers`}
							label={t('worldInfo.editor.fields.triggers')}
							multiSelectProps={{
								options: ST_TRIGGER_OPTIONS,
								clearable: true,
								comboboxProps: { withinPortal: false },
							}}
						/>
						<Accordion variant="separated">
							<Accordion.Item value="additional-matching-sources">
								<Accordion.Control>{t('worldInfo.editor.fields.additionalMatchingSources')}</Accordion.Control>
								<Accordion.Panel>
									<Group grow>
										<FormSwitch name={`${basePath}.matchPersonaDescription`} label={t('worldInfo.editor.fields.matchPersonaDescription')} />
										<FormSwitch name={`${basePath}.matchCharacterDescription`} label={t('worldInfo.editor.fields.matchCharacterDescription')} />
										<FormSwitch name={`${basePath}.matchCharacterPersonality`} label={t('worldInfo.editor.fields.matchCharacterPersonality')} />
									</Group>
									<Group grow>
										<FormSwitch name={`${basePath}.matchCharacterDepthPrompt`} label={t('worldInfo.editor.fields.matchCharacterDepthPrompt')} />
										<FormSwitch name={`${basePath}.matchScenario`} label={t('worldInfo.editor.fields.matchScenario')} />
										<FormSwitch name={`${basePath}.matchCreatorNotes`} label={t('worldInfo.editor.fields.matchCreatorNotes')} />
									</Group>
								</Accordion.Panel>
							</Accordion.Item>
							<Accordion.Item value="advanced">
								<Accordion.Control>{t('worldInfo.editor.fields.advanced')}</Accordion.Control>
								<Accordion.Panel>
									<Stack gap="sm">
										<Controller control={control} name={`${basePath}.uid`} render={({ field }) => <NumberInput label={t('worldInfo.editor.fields.uid')} min={0} value={field.value ?? 0} onChange={(value) => field.onChange(Math.max(0, Number(value) || 0))} />} />
										<FormTextarea name={`${basePath}.extensionsJson`} label={t('worldInfo.editor.fields.extensionsJson')} textareaProps={{ minRows: 6, autosize: true }} />
									</Stack>
								</Accordion.Panel>
							</Accordion.Item>
						</Accordion>
					</Stack>
				) : null}
			</Accordion.Panel>
		</Accordion.Item>
	);
});

WorldInfoEntryItem.displayName = 'WorldInfoEntryItem';
