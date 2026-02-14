import { Button, Checkbox, Collapse, Group, Paper, Stack, Text, TextInput, Textarea } from '@mantine/core';
import {
	type UserPersonContentTypeExtendedV2,
	type UserPersonContentTypeExtendedV2Block,
	type UserPersonType,
} from '@shared/types/user-person';
import { useUnit } from 'effector-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LuArrowDown, LuArrowUp, LuChevronDown, LuChevronUp, LuFolderPlus, LuPlus, LuTrash2 } from 'react-icons/lu';

import { $currentBranchId, $currentChat, $currentEntityProfile } from '@model/chat-core';
import { userPersonsModel } from '@model/user-persons';
import { Dialog } from '@ui/dialog';
import { FormInput, FormSwitch, FormTextarea } from '@ui/form-components';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';

import { BACKEND_ORIGIN } from '../../../api/chat-core';
import { prerenderInstruction } from '../../../api/instructions';
import { AvatarUpload } from '../../../features/common/avatar-upload';

import {
	buildFinalDescription,
	collectEnabledAdditionalTexts,
	createAdditionalGroup,
	createAdditionalItem,
	normalizeContentTypeExtended,
} from './additional-description-utils';

interface UserPersonEditorProps {
	opened: boolean;
	data: UserPersonType | null;
	onClose: () => void;
}

type UserPersonFormValues = {
	name: string;
	prefix: string;
	avatarUrl: string;
	baseDescription: string;
	additionalJoiner: string;
	wrapperEnabled: boolean;
	wrapperTemplate: string;
	blocks: UserPersonContentTypeExtendedV2Block[];
};

function swapItems<T>(list: T[], indexA: number, indexB: number): T[] {
	const copy = [...list];
	const tmp = copy[indexA];
	copy[indexA] = copy[indexB];
	copy[indexB] = tmp;
	return copy;
}

function errorToMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

type EditorSectionsState = {
	additionalCollapsed: boolean;
	settingsCollapsed: boolean;
	previewCollapsed: boolean;
};

const USER_PERSON_EDITOR_SECTIONS_STORAGE_KEY = 'user_person_editor_sections_v1';

function loadEditorSectionsState(): EditorSectionsState {
	if (typeof window === 'undefined') {
		return {
			additionalCollapsed: false,
			settingsCollapsed: false,
			previewCollapsed: false,
		};
	}

	try {
		const raw = window.localStorage.getItem(USER_PERSON_EDITOR_SECTIONS_STORAGE_KEY);
		if (!raw) {
			return {
				additionalCollapsed: false,
				settingsCollapsed: false,
				previewCollapsed: false,
			};
		}
		const parsed = JSON.parse(raw) as Partial<EditorSectionsState>;
		return {
			additionalCollapsed: parsed.additionalCollapsed === true,
			settingsCollapsed: parsed.settingsCollapsed === true,
			previewCollapsed: parsed.previewCollapsed === true,
		};
	} catch {
		return {
			additionalCollapsed: false,
			settingsCollapsed: false,
			previewCollapsed: false,
		};
	}
}

export const UserPersonEditor: React.FC<UserPersonEditorProps> = ({ opened, data, onClose }) => {
	const { t } = useTranslation();
	const [currentChat, currentBranchId, currentEntityProfile] = useUnit([$currentChat, $currentBranchId, $currentEntityProfile]);
	const loadedPersonIdRef = useRef<string | null>(null);
	const [sectionsState, setSectionsState] = useState<EditorSectionsState>(() => loadEditorSectionsState());
	const methods = useForm<UserPersonFormValues>({
		defaultValues: {
			name: '',
			prefix: '',
			avatarUrl: '',
			baseDescription: '',
			additionalJoiner: '\\n\\n',
			wrapperEnabled: false,
			wrapperTemplate: '<tag>{{PROMPT}}</tag>',
			blocks: [],
		},
	});

	const watchedBaseDescription = useWatch({ control: methods.control, name: 'baseDescription' });
	const watchedAdditionalJoiner = useWatch({ control: methods.control, name: 'additionalJoiner' });
	const watchedWrapperEnabled = useWatch({ control: methods.control, name: 'wrapperEnabled' });
	const watchedWrapperTemplate = useWatch({ control: methods.control, name: 'wrapperTemplate' });
	const watchedBlocks = useWatch({ control: methods.control, name: 'blocks' });
	const watchedName = useWatch({ control: methods.control, name: 'name' });
	const watchedAvatarUrl = useWatch({ control: methods.control, name: 'avatarUrl' });

	const preview = useMemo(() => {
		const state: UserPersonContentTypeExtendedV2 = {
			version: 2,
			baseDescription: watchedBaseDescription ?? '',
			settings: {
				additionalJoiner: watchedAdditionalJoiner ?? '\\n\\n',
				wrapperEnabled: watchedWrapperEnabled === true,
				wrapperTemplate: watchedWrapperTemplate ?? '<tag>{{PROMPT}}</tag>',
			},
			blocks: Array.isArray(watchedBlocks) ? watchedBlocks : [],
		};
		return buildFinalDescription(state);
	}, [watchedAdditionalJoiner, watchedBaseDescription, watchedBlocks, watchedWrapperEnabled, watchedWrapperTemplate]);

	useEffect(() => {
		if (!opened || !data) return;
		if (loadedPersonIdRef.current === data.id) return;
		const normalized = normalizeContentTypeExtended({
			contentTypeExtended: data.contentTypeExtended,
			contentTypeDefault: data.contentTypeDefault,
		});
		methods.reset({
			name: data.name,
			prefix: data.prefix ?? '',
			avatarUrl: data.avatarUrl ?? '',
			baseDescription: normalized.baseDescription,
			additionalJoiner: normalized.settings.additionalJoiner,
			wrapperEnabled: normalized.settings.wrapperEnabled,
			wrapperTemplate: normalized.settings.wrapperTemplate,
			blocks: normalized.blocks,
		});
		loadedPersonIdRef.current = data.id;
	}, [data, methods, opened]);

	useEffect(() => {
		if (!opened) {
			loadedPersonIdRef.current = null;
		}
	}, [opened]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		try {
			window.localStorage.setItem(USER_PERSON_EDITOR_SECTIONS_STORAGE_KEY, JSON.stringify(sectionsState));
		} catch {
			// ignore storage write errors
		}
	}, [sectionsState]);

	const updateBlocks = (nextBlocks: UserPersonContentTypeExtendedV2Block[]) => {
		methods.setValue('blocks', nextBlocks, { shouldDirty: true });
	};

	const toggleSection = (key: keyof EditorSectionsState) => {
		setSectionsState((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const addTopLevelItem = () => {
		const current = methods.getValues('blocks') ?? [];
		updateBlocks([...current, createAdditionalItem(t('userPersons.additional.defaults.item', { index: current.length + 1 }))]);
	};

	const addTopLevelGroup = () => {
		const current = methods.getValues('blocks') ?? [];
		updateBlocks([...current, createAdditionalGroup(t('userPersons.additional.defaults.group', { index: current.length + 1 }))]);
	};

	const moveTopLevelBlock = (index: number, direction: -1 | 1) => {
		const current = methods.getValues('blocks') ?? [];
		const nextIndex = index + direction;
		if (nextIndex < 0 || nextIndex >= current.length) return;
		updateBlocks(swapItems(current, index, nextIndex));
	};

	const removeTopLevelBlock = (index: number) => {
		const current = methods.getValues('blocks') ?? [];
		updateBlocks(current.filter((_, idx) => idx !== index));
	};

	const addItemToGroup = (groupIndex: number) => {
		const current = methods.getValues('blocks') ?? [];
		const block = current[groupIndex];
		if (!block || block.type !== 'group') return;
		const nextItems = [...block.items, createAdditionalItem(t('userPersons.additional.defaults.item', { index: block.items.length + 1 }))];
		const nextBlocks = [...current];
		nextBlocks[groupIndex] = { ...block, items: nextItems };
		updateBlocks(nextBlocks);
	};

	const moveGroupItem = (groupIndex: number, itemIndex: number, direction: -1 | 1) => {
		const current = methods.getValues('blocks') ?? [];
		const block = current[groupIndex];
		if (!block || block.type !== 'group') return;
		const nextIndex = itemIndex + direction;
		if (nextIndex < 0 || nextIndex >= block.items.length) return;
		const nextItems = swapItems(block.items, itemIndex, nextIndex);
		const nextBlocks = [...current];
		nextBlocks[groupIndex] = { ...block, items: nextItems };
		updateBlocks(nextBlocks);
	};

	const removeGroupItem = (groupIndex: number, itemIndex: number) => {
		const current = methods.getValues('blocks') ?? [];
		const block = current[groupIndex];
		if (!block || block.type !== 'group') return;
		const nextItems = block.items.filter((_, idx) => idx !== itemIndex);
		const nextBlocks = [...current];
		nextBlocks[groupIndex] = { ...block, items: nextItems };
		updateBlocks(nextBlocks);
	};

	const runSoftLiquidValidation = async (state: UserPersonContentTypeExtendedV2): Promise<void> => {
		const templates = [
			state.baseDescription,
			...collectEnabledAdditionalTexts(state),
			state.settings.wrapperEnabled ? state.settings.wrapperTemplate : '',
		]
			.map((item) => item.trim())
			.filter((item) => item.length > 0);

		if (templates.length === 0) return;
		const uniqueTemplates = [...new Set(templates)];
		const results = await Promise.allSettled(
			uniqueTemplates.map((templateText) =>
				prerenderInstruction({
					templateText,
					chatId: currentChat?.id,
					branchId: currentBranchId ?? undefined,
					entityProfileId: currentEntityProfile?.id,
				}),
			),
		);
		const errors = results
			.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
			.map((result) => errorToMessage(result.reason));

		if (errors.length === 0) return;
		const description = errors.slice(0, 2).join('\n');
		toaster.warning({
			title: t('userPersons.toasts.liquidWarningsTitle'),
			description:
				errors.length > 2
					? t('userPersons.toasts.liquidWarningsDescriptionWithMore', { details: description, more: errors.length - 2 })
					: t('userPersons.toasts.liquidWarningsDescription', { details: description }),
			duration: 5000,
		});
	};

	const savePerson = async (options: { closeAfterSave: boolean; validateLiquid: boolean }) => {
		if (!data) return;
		const values = methods.getValues();
		const state: UserPersonContentTypeExtendedV2 = {
			version: 2,
			baseDescription: values.baseDescription,
			settings: {
				additionalJoiner: values.additionalJoiner,
				wrapperEnabled: values.wrapperEnabled,
				wrapperTemplate: values.wrapperTemplate,
			},
			blocks: values.blocks,
		};
		const { finalDescription, normalized } = buildFinalDescription(state);

		try {
			await userPersonsModel.updateItemFx({
				...data,
				type: 'default',
				name: values.name,
				prefix: values.prefix,
				avatarUrl: values.avatarUrl || undefined,
				contentTypeDefault: finalDescription,
				contentTypeExtended: normalized,
			});

			if (options.validateLiquid) {
				await runSoftLiquidValidation(normalized);
			}

			if (options.closeAfterSave) {
				onClose();
			}
		} catch (error) {
			toaster.error({
				title: t('userPersons.toasts.saveError'),
				description: errorToMessage(error),
			});
		}
	};

	const handleAvatarChange = async (avatarUrl: string) => {
		methods.setValue('avatarUrl', avatarUrl, { shouldDirty: true });
		await savePerson({ closeAfterSave: false, validateLiquid: false });
	};

	const submit = methods.handleSubmit(async () => {
		await savePerson({ closeAfterSave: true, validateLiquid: true });
	});

	if (!data) return null;

	return (
		<Dialog
			open={opened}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			title={t('userPersons.editor.title')}
			size="cover"
			fullScreenContentMaxWidth={1320}
			fillBodyHeight
			footer={<></>}
		>
			<FormProvider {...methods}>
				<form
					id="dialog-form"
					onSubmit={submit}
					style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}
				>
					<Stack gap="md" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
						<Group align="center" wrap="nowrap">
							<AvatarUpload
								size="2xl"
								name={watchedName || data.name}
								src={watchedAvatarUrl || undefined}
								baseUrl={BACKEND_ORIGIN}
								onAvatarChange={handleAvatarChange}
								saveFolder="user-persons"
							/>
							<Stack gap="sm" style={{ flex: 1 }}>
								<FormInput name="name" label={t('userPersons.fields.name')} />
								<FormInput name="prefix" label={t('userPersons.fields.prefix')} />
							</Stack>
						</Group>

						<Paper withBorder p="md" radius="md">
							<Stack gap="sm">
								<FormTextarea
									name="baseDescription"
									label={t('userPersons.fields.baseDescription')}
									textareaProps={{ minRows: 6, autosize: true }}
								/>
							</Stack>
						</Paper>

						<Paper withBorder p="md" radius="md">
							<Stack gap="sm">
								<Group justify="space-between" align="center">
									<Text fw={600}>{t('userPersons.additional.title')}</Text>
									<Group gap="xs">
										{!sectionsState.additionalCollapsed && (
											<>
												<IconButtonWithTooltip
													icon={<LuPlus />}
													tooltip={t('userPersons.additional.actions.addItem')}
													aria-label={t('userPersons.additional.actions.addItem')}
													onClick={addTopLevelItem}
													size="sm"
													variant="outline"
												/>
												<IconButtonWithTooltip
													icon={<LuFolderPlus />}
													tooltip={t('userPersons.additional.actions.addGroup')}
													aria-label={t('userPersons.additional.actions.addGroup')}
													onClick={addTopLevelGroup}
													size="sm"
													variant="outline"
												/>
											</>
										)}
										<IconButtonWithTooltip
											icon={sectionsState.additionalCollapsed ? <LuChevronDown /> : <LuChevronUp />}
											tooltip={
												sectionsState.additionalCollapsed
													? t('userPersons.additional.actions.expand')
													: t('userPersons.additional.actions.collapse')
											}
											aria-label={
												sectionsState.additionalCollapsed
													? t('userPersons.additional.actions.expand')
													: t('userPersons.additional.actions.collapse')
											}
											onClick={() => toggleSection('additionalCollapsed')}
											size="sm"
											variant="outline"
										/>
									</Group>
								</Group>

								<Collapse in={!sectionsState.additionalCollapsed}>
									{Array.isArray(watchedBlocks) && watchedBlocks.length > 0 ? (
									<Stack gap="sm">
										{watchedBlocks.map((block, blockIndex) => {
											if (block.type === 'group') {
												return (
													<Paper withBorder p="sm" radius="md" key={block.id}>
														<Stack gap="sm">
															<Group justify="space-between" align="center" wrap="nowrap">
																<Controller
																	control={methods.control}
																	name={`blocks.${blockIndex}.title`}
																	render={({ field }) => (
																		<TextInput
																			style={{ flex: 1 }}
																			label={t('userPersons.additional.fields.groupTitle')}
																			value={typeof field.value === 'string' ? field.value : ''}
																			onChange={(event) => field.onChange(event.currentTarget.value)}
																		/>
																	)}
																/>
																<Group gap={6} wrap="nowrap" style={{ marginTop: 24 }}>
																	<Controller
																		control={methods.control}
																		name={`blocks.${blockIndex}.enabled`}
																		render={({ field }) => (
																			<Checkbox
																				label={t('common.enabled')}
																				checked={field.value === true}
																				onChange={(event) => field.onChange(event.currentTarget.checked)}
																			/>
																		)}
																	/>
																	<IconButtonWithTooltip
																		icon={<LuArrowUp />}
																		tooltip={t('common.up')}
																		aria-label={t('common.up')}
																		onClick={() => moveTopLevelBlock(blockIndex, -1)}
																		size="sm"
																		variant="ghost"
																		disabled={blockIndex === 0}
																	/>
																	<IconButtonWithTooltip
																		icon={<LuArrowDown />}
																		tooltip={t('common.down')}
																		aria-label={t('common.down')}
																		onClick={() => moveTopLevelBlock(blockIndex, 1)}
																		size="sm"
																		variant="ghost"
																		disabled={blockIndex >= watchedBlocks.length - 1}
																	/>
																	<IconButtonWithTooltip
																		icon={<LuTrash2 />}
																		tooltip={t('common.delete')}
																		aria-label={t('common.delete')}
																		onClick={() => removeTopLevelBlock(blockIndex)}
																		size="sm"
																		variant="ghost"
																		colorPalette="red"
																	/>
																	<IconButtonWithTooltip
																		icon={block.collapsed ? <LuChevronDown /> : <LuChevronUp />}
																		tooltip={
																			block.collapsed
																				? t('userPersons.additional.actions.expand')
																				: t('userPersons.additional.actions.collapse')
																		}
																		aria-label={
																			block.collapsed
																				? t('userPersons.additional.actions.expand')
																				: t('userPersons.additional.actions.collapse')
																		}
																		onClick={() =>
																			methods.setValue(`blocks.${blockIndex}.collapsed`, !block.collapsed, {
																				shouldDirty: true,
																			})
																		}
																		size="sm"
																		variant="ghost"
																	/>
																</Group>
															</Group>

															{!block.collapsed && (
																<>
																	<Group justify="space-between" align="center">
																		<Text size="sm" fw={600}>
																			{t('userPersons.additional.groupItems')}
																		</Text>
																		<Button
																			variant="light"
																			size="xs"
																			leftSection={<LuPlus />}
																			onClick={() => addItemToGroup(blockIndex)}
																		>
																			{t('userPersons.additional.actions.addItem')}
																		</Button>
																	</Group>

																	{block.items.length > 0 ? (
																		<Stack gap="sm">
																			{block.items.map((item, itemIndex) => (
																				<Paper withBorder p="sm" radius="md" key={item.id}>
																					<Stack gap="sm">
																						<Group justify="space-between" align="center" wrap="nowrap">
																							<Controller
																								control={methods.control}
																								name={`blocks.${blockIndex}.items.${itemIndex}.title`}
																								render={({ field }) => (
																									<TextInput
																										style={{ flex: 1 }}
																										label={t('userPersons.additional.fields.itemTitle')}
																										value={typeof field.value === 'string' ? field.value : ''}
																										onChange={(event) => field.onChange(event.currentTarget.value)}
																									/>
																								)}
																							/>
																							<Group gap={6} wrap="nowrap" style={{ marginTop: 24 }}>
																								<Controller
																									control={methods.control}
																									name={`blocks.${blockIndex}.items.${itemIndex}.enabled`}
																									render={({ field }) => (
																										<Checkbox
																											label={t('common.enabled')}
																											checked={field.value === true}
																											onChange={(event) => field.onChange(event.currentTarget.checked)}
																										/>
																									)}
																								/>
																								<IconButtonWithTooltip
																									icon={<LuArrowUp />}
																									tooltip={t('common.up')}
																									aria-label={t('common.up')}
																									onClick={() => moveGroupItem(blockIndex, itemIndex, -1)}
																									size="sm"
																									variant="ghost"
																									disabled={itemIndex === 0}
																								/>
																								<IconButtonWithTooltip
																									icon={<LuArrowDown />}
																									tooltip={t('common.down')}
																									aria-label={t('common.down')}
																									onClick={() => moveGroupItem(blockIndex, itemIndex, 1)}
																									size="sm"
																									variant="ghost"
																									disabled={itemIndex >= block.items.length - 1}
																								/>
																								<IconButtonWithTooltip
																									icon={<LuTrash2 />}
																									tooltip={t('common.delete')}
																									aria-label={t('common.delete')}
																									onClick={() => removeGroupItem(blockIndex, itemIndex)}
																									size="sm"
																									variant="ghost"
																									colorPalette="red"
																								/>
																								<IconButtonWithTooltip
																									icon={item.collapsed ? <LuChevronDown /> : <LuChevronUp />}
																									tooltip={
																										item.collapsed
																											? t('userPersons.additional.actions.expand')
																											: t('userPersons.additional.actions.collapse')
																									}
																									aria-label={
																										item.collapsed
																											? t('userPersons.additional.actions.expand')
																											: t('userPersons.additional.actions.collapse')
																									}
																									onClick={() =>
																										methods.setValue(
																											`blocks.${blockIndex}.items.${itemIndex}.collapsed`,
																											!item.collapsed,
																											{ shouldDirty: true },
																										)
																									}
																									size="sm"
																									variant="ghost"
																								/>
																							</Group>
																						</Group>

																						{!item.collapsed && (
																							<FormTextarea
																								name={`blocks.${blockIndex}.items.${itemIndex}.text`}
																								label={t('userPersons.additional.fields.itemText')}
																								textareaProps={{ minRows: 3, autosize: true }}
																							/>
																						)}
																					</Stack>
																				</Paper>
																			))}
																		</Stack>
																	) : (
																		<Text size="sm" c="dimmed">
																			{t('userPersons.additional.emptyGroup')}
																		</Text>
																	)}
																</>
															)}
														</Stack>
													</Paper>
												);
											}

											return (
												<Paper withBorder p="sm" radius="md" key={block.id}>
													<Stack gap="sm">
														<Group justify="space-between" align="center" wrap="nowrap">
															<Controller
																control={methods.control}
																name={`blocks.${blockIndex}.title`}
																render={({ field }) => (
																	<TextInput
																		style={{ flex: 1 }}
																		label={t('userPersons.additional.fields.itemTitle')}
																		value={typeof field.value === 'string' ? field.value : ''}
																		onChange={(event) => field.onChange(event.currentTarget.value)}
																	/>
																)}
															/>
															<Group gap={6} wrap="nowrap" style={{ marginTop: 24 }}>
																<Controller
																	control={methods.control}
																	name={`blocks.${blockIndex}.enabled`}
																	render={({ field }) => (
																		<Checkbox
																			label={t('common.enabled')}
																			checked={field.value === true}
																			onChange={(event) => field.onChange(event.currentTarget.checked)}
																		/>
																	)}
																/>
																<IconButtonWithTooltip
																	icon={<LuArrowUp />}
																	tooltip={t('common.up')}
																	aria-label={t('common.up')}
																	onClick={() => moveTopLevelBlock(blockIndex, -1)}
																	size="sm"
																	variant="ghost"
																	disabled={blockIndex === 0}
																/>
																<IconButtonWithTooltip
																	icon={<LuArrowDown />}
																	tooltip={t('common.down')}
																	aria-label={t('common.down')}
																	onClick={() => moveTopLevelBlock(blockIndex, 1)}
																	size="sm"
																	variant="ghost"
																	disabled={blockIndex >= watchedBlocks.length - 1}
																/>
																<IconButtonWithTooltip
																	icon={<LuTrash2 />}
																	tooltip={t('common.delete')}
																	aria-label={t('common.delete')}
																	onClick={() => removeTopLevelBlock(blockIndex)}
																	size="sm"
																	variant="ghost"
																	colorPalette="red"
																/>
																<IconButtonWithTooltip
																	icon={block.collapsed ? <LuChevronDown /> : <LuChevronUp />}
																	tooltip={block.collapsed ? t('userPersons.additional.actions.expand') : t('userPersons.additional.actions.collapse')}
																	aria-label={block.collapsed ? t('userPersons.additional.actions.expand') : t('userPersons.additional.actions.collapse')}
																	onClick={() =>
																		methods.setValue(`blocks.${blockIndex}.collapsed`, !block.collapsed, { shouldDirty: true })
																	}
																	size="sm"
																	variant="ghost"
																/>
															</Group>
														</Group>

														{!block.collapsed && (
															<FormTextarea
																name={`blocks.${blockIndex}.text`}
																label={t('userPersons.additional.fields.itemText')}
																textareaProps={{ minRows: 3, autosize: true }}
															/>
														)}
													</Stack>
												</Paper>
											);
										})}
									</Stack>
									) : (
										<Text size="sm" c="dimmed">
											{t('userPersons.additional.empty')}
										</Text>
									)}
								</Collapse>
							</Stack>
						</Paper>

						<Paper withBorder p="md" radius="md">
							<Stack gap="sm">
								<Group justify="space-between" align="center">
									<Text fw={600}>{t('userPersons.settings.title')}</Text>
									<IconButtonWithTooltip
										icon={sectionsState.settingsCollapsed ? <LuChevronDown /> : <LuChevronUp />}
										tooltip={
											sectionsState.settingsCollapsed
												? t('userPersons.additional.actions.expand')
												: t('userPersons.additional.actions.collapse')
										}
										aria-label={
											sectionsState.settingsCollapsed
												? t('userPersons.additional.actions.expand')
												: t('userPersons.additional.actions.collapse')
										}
										onClick={() => toggleSection('settingsCollapsed')}
										size="sm"
										variant="outline"
									/>
								</Group>
								<Collapse in={!sectionsState.settingsCollapsed}>
									<Stack gap="sm">
										<FormInput
											name="additionalJoiner"
											label={t('userPersons.settings.additionalJoiner')}
											inputProps={{ placeholder: '\\n\\n' }}
										/>
										<FormSwitch name="wrapperEnabled" label={t('userPersons.settings.wrapperEnabled')} />
										{watchedWrapperEnabled && (
											<FormTextarea
												name="wrapperTemplate"
												label={t('userPersons.settings.wrapperTemplate')}
												textareaProps={{ minRows: 3, autosize: true }}
											/>
										)}
									</Stack>
								</Collapse>
							</Stack>
						</Paper>

						<Paper withBorder p="md" radius="md">
							<Stack gap="sm">
								<Group justify="space-between" align="center">
									<Text fw={600}>{t('userPersons.preview.title')}</Text>
									<IconButtonWithTooltip
										icon={sectionsState.previewCollapsed ? <LuChevronDown /> : <LuChevronUp />}
										tooltip={
											sectionsState.previewCollapsed
												? t('userPersons.additional.actions.expand')
												: t('userPersons.additional.actions.collapse')
										}
										aria-label={
											sectionsState.previewCollapsed
												? t('userPersons.additional.actions.expand')
												: t('userPersons.additional.actions.collapse')
										}
										onClick={() => toggleSection('previewCollapsed')}
										size="sm"
										variant="outline"
									/>
								</Group>
								<Collapse in={!sectionsState.previewCollapsed}>
									<Stack gap="sm">
										<Text size="xs" c="dimmed">
											{t('userPersons.preview.info', { count: preview.enabledTexts.length })}
										</Text>
										<Textarea value={preview.finalDescription} readOnly autosize minRows={8} />
									</Stack>
								</Collapse>
							</Stack>
						</Paper>

						<Group justify="flex-end" gap="sm">
							<Button type="button" variant="subtle" onClick={onClose}>
								{t('common.cancel')}
							</Button>
							<Button type="submit">{t('common.save')}</Button>
						</Group>
					</Stack>
				</form>
			</FormProvider>
		</Dialog>
	);
};
