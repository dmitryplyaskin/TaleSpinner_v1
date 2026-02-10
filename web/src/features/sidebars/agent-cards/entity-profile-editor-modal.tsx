import {
	Button,
	Group,
	Paper,
	Select,
	Stack,
	Tabs,
	TagsInput,
	Text,
	Textarea,
} from '@mantine/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, Controller, useController, useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LuArrowDown, LuArrowUp, LuDownload, LuExpand, LuPlus, LuStar, LuTrash2 } from 'react-icons/lu';

import { Dialog } from '@ui/dialog';
import { FormInput, FormTextarea } from '@ui/form-components';
import { TextareaFullscreenDialog } from '@ui/form-components/components/textarea-fullscreen-dialog';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { BACKEND_ORIGIN } from '../../../api/chat-core';
import { AvatarUpload } from '../../common/avatar-upload';

import { parseSpec } from './spec-utils';

import type { EntityProfileDto } from '../../../api/chat-core';
import type { Control } from 'react-hook-form';

type GreetingField = { value: string };
type EditorTab = 'basic' | 'chat' | 'greetings' | 'system' | 'worldInfo' | 'advanced';

type FormValues = {
	name: string;
	description: string;
	personality: string;
	scenario: string;
	firstMes: string;
	mesExample: string;
	tags: string[];
	alternateGreetings: GreetingField[];
	systemPrompt: string;
	postHistoryInstructions: string;
	creatorNotes: string;
	creator: string;
	characterVersion: string;
	extensionsJson: string;
	characterBookJson: string;
};

type Props = {
	opened: boolean;
	profile: EntityProfileDto | null;
	saving: boolean;
	updating: boolean;
	deleting: boolean;
	exporting: boolean;
	onClose: () => void;
	onSave: (payload: { id: string; name: string; spec: unknown }) => void;
	onToggleFavorite: (profile: EntityProfileDto) => void;
	onDelete: (profile: EntityProfileDto) => void;
	onAvatarChange: (profile: EntityProfileDto, avatarUrl: string) => void;
	onAvatarRemove: (profile: EntityProfileDto) => void;
	onExport: (profile: EntityProfileDto, format: 'json' | 'png') => void;
	worldInfoBooks: Array<{
		id: string;
		name: string;
		slug: string;
	}>;
	worldInfoBookId: string | null;
	worldInfoBindingPending: boolean;
	onWorldInfoBindingChange: (profile: EntityProfileDto, bookId: string | null) => void;
	onOpenWorldInfoSidebar: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatJson(value: unknown): string {
	if (typeof value === 'undefined') return '';
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return '';
	}
}

type GreetingItemFieldProps = {
	control: Control<FormValues>;
	index: number;
	total: number;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onRemove: () => void;
	disabled: boolean;
	label: string;
	openFullscreenLabel: string;
	moveUpLabel: string;
	moveDownLabel: string;
	removeLabel: string;
};

const GreetingItemField = ({
	control,
	index,
	total,
	onMoveUp,
	onMoveDown,
	onRemove,
	disabled,
	label,
	openFullscreenLabel,
	moveUpLabel,
	moveDownLabel,
	removeLabel,
}: GreetingItemFieldProps) => {
	const [fullscreenOpen, setFullscreenOpen] = useState(false);
	const { field, fieldState } = useController({
		control,
		name: `alternateGreetings.${index}.value` as const,
	});
	const errorMessage = typeof fieldState.error?.message === 'string' ? fieldState.error.message : '';

	return (
		<Paper withBorder p="sm" radius="md">
			<Stack gap="xs">
				<Group justify="space-between" align="center" style={{ marginBottom: 2 }}>
					<Text fw={600} size="sm" style={{ marginBottom: 2 }}>
						{label}
					</Text>
					<Group gap={4} wrap="nowrap">
						<IconButtonWithTooltip
							icon={<LuExpand />}
							tooltip={openFullscreenLabel}
							aria-label={openFullscreenLabel}
							size="sm"
							variant="outline"
							disabled={disabled}
							onClick={() => setFullscreenOpen(true)}
						/>
						<IconButtonWithTooltip
							icon={<LuArrowUp />}
							tooltip={moveUpLabel}
							aria-label={moveUpLabel}
							size="sm"
							variant="ghost"
							disabled={disabled || index === 0}
							onClick={onMoveUp}
						/>
						<IconButtonWithTooltip
							icon={<LuArrowDown />}
							tooltip={moveDownLabel}
							aria-label={moveDownLabel}
							size="sm"
							variant="ghost"
							disabled={disabled || index === total - 1}
							onClick={onMoveDown}
						/>
						<IconButtonWithTooltip
							icon={<LuTrash2 />}
							tooltip={removeLabel}
							aria-label={removeLabel}
							colorPalette="red"
							size="sm"
							variant="ghost"
							disabled={disabled}
							onClick={onRemove}
						/>
					</Group>
				</Group>
				<Textarea
					name={field.name}
					ref={field.ref}
					value={field.value ?? ''}
					onBlur={field.onBlur}
					onChange={(event) => field.onChange(event.currentTarget.value)}
					minRows={4}
					autosize
				/>
				{errorMessage.length > 0 && (
					<Text c="red" size="xs">
						{errorMessage}
					</Text>
				)}
			</Stack>
			<TextareaFullscreenDialog
				open={fullscreenOpen}
				onOpenChange={setFullscreenOpen}
				value={field.value ?? ''}
				onChange={field.onChange}
			/>
		</Paper>
	);
};

export const EntityProfileEditorModal = ({
	opened,
	profile,
	saving,
	updating,
	deleting,
	exporting,
	onClose,
	onSave,
	onToggleFavorite,
	onDelete,
	onAvatarChange,
	onAvatarRemove,
	onExport,
	worldInfoBooks,
	worldInfoBookId,
	worldInfoBindingPending,
	onWorldInfoBindingChange,
	onOpenWorldInfoSidebar,
}: Props) => {
	const { t } = useTranslation();
	const parsedSpec = useMemo(() => parseSpec(profile?.spec), [profile?.spec]);
	const [jsonError, setJsonError] = useState<string | null>(null);
	const [exportFormat, setExportFormat] = useState<'json' | 'png'>('png');
	const [activeTab, setActiveTab] = useState<EditorTab>('basic');
	const wasOpenedRef = useRef(false);
	const loadedProfileIdRef = useRef<string | null>(null);

	const methods = useForm<FormValues>({
		defaultValues: {
			name: profile?.name ?? '',
			description: parsedSpec.description,
			personality: parsedSpec.personality,
			scenario: parsedSpec.scenario,
			firstMes: parsedSpec.firstMes,
			mesExample: parsedSpec.mesExample,
			tags: parsedSpec.tags,
			alternateGreetings: parsedSpec.alternateGreetings.map((value) => ({ value })),
			systemPrompt: parsedSpec.systemPrompt,
			postHistoryInstructions: parsedSpec.postHistoryInstructions,
			creatorNotes: parsedSpec.creatorNotes,
			creator: parsedSpec.creator,
			characterVersion: parsedSpec.characterVersion,
			extensionsJson: formatJson(parsedSpec.extensions),
			characterBookJson: formatJson(parsedSpec.characterBook),
		},
	});

	const { fields, append, remove, move } = useFieldArray({
		control: methods.control,
		name: 'alternateGreetings',
	});

	const worldInfoOptions = useMemo(
		() => [
			{ value: '__none__', label: t('agentCards.worldInfo.none') },
			...worldInfoBooks.map((book) => ({ value: book.id, label: book.name })),
		],
		[t, worldInfoBooks],
	);

	const selectedWorldInfoBook = useMemo(
		() => worldInfoBooks.find((book) => book.id === worldInfoBookId) ?? null,
		[worldInfoBookId, worldInfoBooks],
	);

	useEffect(() => {
		const justOpened = opened && !wasOpenedRef.current;
		wasOpenedRef.current = opened;

		if (!opened || !profile) {
			if (!opened) loadedProfileIdRef.current = null;
			return;
		}

		const profileChanged = loadedProfileIdRef.current !== profile.id;
		if (!justOpened && !profileChanged) return;

		const current = parseSpec(profile.spec);
		methods.reset({
			name: profile.name,
			description: current.description,
			personality: current.personality,
			scenario: current.scenario,
			firstMes: current.firstMes,
			mesExample: current.mesExample,
			tags: current.tags,
			alternateGreetings: current.alternateGreetings.map((value) => ({ value })),
			systemPrompt: current.systemPrompt,
			postHistoryInstructions: current.postHistoryInstructions,
			creatorNotes: current.creatorNotes,
			creator: current.creator,
			characterVersion: current.characterVersion,
			extensionsJson: formatJson(current.extensions),
			characterBookJson: formatJson(current.characterBook),
		});
		loadedProfileIdRef.current = profile.id;
		setJsonError(null);
		setExportFormat('png');
		setActiveTab('basic');
	}, [methods, opened, profile]);

	const submit = methods.handleSubmit((values) => {
		if (!profile) return;
		setJsonError(null);

		let extensions: unknown;
		let characterBook: unknown;

		try {
			const extText = values.extensionsJson.trim();
			extensions = extText.length > 0 ? JSON.parse(extText) : undefined;
		} catch {
			setJsonError(t('agentCards.editor.errors.invalidExtensionsJson'));
			return;
		}

		try {
			const bookText = values.characterBookJson.trim();
			characterBook = bookText.length > 0 ? JSON.parse(bookText) : undefined;
		} catch {
			setJsonError(t('agentCards.editor.errors.invalidCharacterBookJson'));
			return;
		}

		const baseSpec = isRecord(profile.spec) ? profile.spec : {};
		const alternateGreetings = values.alternateGreetings
			.map((item) => item.value.trim())
			.filter((item) => item.length > 0);

		const nextSpec: Record<string, unknown> = {
			...baseSpec,
			name: values.name,
			description: values.description,
			personality: values.personality,
			scenario: values.scenario,
			first_mes: values.firstMes,
			mes_example: values.mesExample,
			tags: values.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0),
			alternate_greetings: alternateGreetings,
			system_prompt: values.systemPrompt,
			post_history_instructions: values.postHistoryInstructions,
			creator_notes: values.creatorNotes,
			creator: values.creator,
			character_version: values.characterVersion,
		};

		if (typeof extensions === 'undefined') {
			delete nextSpec.extensions;
		} else {
			nextSpec.extensions = extensions;
		}

		if (typeof characterBook === 'undefined') {
			delete nextSpec.character_book;
		} else {
			nextSpec.character_book = characterBook;
		}

		onSave({ id: profile.id, name: values.name, spec: nextSpec });
	});

	const isBusy = saving || updating || deleting || exporting;

	return (
		<Dialog
			open={opened}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			title={t('agentCards.editor.title')}
			size="cover"
			fullScreenContentMaxWidth={1440}
			fillBodyHeight
			footer={<></>}
		>
			<FormProvider {...methods}>
				<form id="dialog-form" onSubmit={submit} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
					<Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
						{profile && (
							<Group justify="space-between" align="flex-start" wrap="wrap">
								<Group gap="md" align="center" wrap="nowrap">
									<AvatarUpload
										size={80}
										name={profile.name}
										src={profile.avatarAssetId ?? undefined}
										baseUrl={BACKEND_ORIGIN}
										saveFolder="entity-profiles"
										onAvatarChange={(avatarUrl) => onAvatarChange(profile, avatarUrl)}
									/>
									<Stack gap={4}>
										<Text fw={600}>{profile.name}</Text>
										<Text c="dimmed" size="sm">
											{t('agentCards.editor.avatarHint')}
										</Text>
										<Group gap="xs">
											<Button
												type="button"
												variant="subtle"
												color="red"
												size="xs"
												disabled={!profile.avatarAssetId || isBusy}
												onClick={() => onAvatarRemove(profile)}
											>
												{t('agentCards.editor.actions.removeAvatar')}
											</Button>
										</Group>
									</Stack>
								</Group>

								<Group gap="xs" align="center" wrap="wrap">
									<IconButtonWithTooltip
										icon={<LuStar />}
										tooltip={profile.isFavorite ? t('agentCards.actions.unfavorite') : t('agentCards.actions.favorite')}
										aria-label={profile.isFavorite ? t('agentCards.actions.unfavorite') : t('agentCards.actions.favorite')}
										active={profile.isFavorite}
										colorPalette={profile.isFavorite ? 'yellow' : undefined}
										disabled={isBusy}
										onClick={() => onToggleFavorite(profile)}
									/>
									<IconButtonWithTooltip
										icon={<LuTrash2 />}
										tooltip={t('common.delete')}
										aria-label={t('common.delete')}
										colorPalette="red"
										disabled={isBusy}
										onClick={() => onDelete(profile)}
									/>
									<Select
										w={110}
										data={[
											{ value: 'json', label: 'JSON' },
											{ value: 'png', label: 'PNG' },
										]}
										value={exportFormat}
										onChange={(value) => setExportFormat((value as 'json' | 'png') ?? 'json')}
										comboboxProps={{ withinPortal: false }}
									/>
									<Button
										type="button"
										leftSection={<LuDownload />}
										variant="light"
										disabled={isBusy}
										loading={exporting}
										onClick={() => onExport(profile, exportFormat)}
									>
										{t('common.export')}
									</Button>
								</Group>
							</Group>
						)}

						<Tabs
							value={activeTab}
							onChange={(value) => setActiveTab((value as EditorTab | null) ?? 'basic')}
							keepMounted={false}
							variant="outline"
							style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
						>
							<Tabs.List>
								<Tabs.Tab value="basic">{t('agentCards.editor.tabs.basic')}</Tabs.Tab>
								<Tabs.Tab value="chat">{t('agentCards.editor.tabs.chat')}</Tabs.Tab>
								<Tabs.Tab value="greetings">{t('agentCards.editor.tabs.greetings')}</Tabs.Tab>
								<Tabs.Tab value="system">{t('agentCards.editor.tabs.system')}</Tabs.Tab>
								<Tabs.Tab value="worldInfo">{t('agentCards.editor.tabs.worldInfo')}</Tabs.Tab>
								<Tabs.Tab value="advanced">{t('agentCards.editor.tabs.advanced')}</Tabs.Tab>
							</Tabs.List>

							<Tabs.Panel value="basic" pt="md" style={{ overflowY: 'auto' }}>
								<Stack gap="md">
									<FormInput name="name" label={t('agentCards.editor.fields.name')} />
									<FormTextarea
										name="description"
										label={t('agentCards.editor.fields.description')}
										textareaProps={{ minRows: 4, autosize: true }}
									/>
									<Controller
										name="tags"
										control={methods.control}
										render={({ field }) => (
											<TagsInput
												label={t('agentCards.editor.fields.tags')}
												value={field.value}
												onChange={field.onChange}
												clearable
												splitChars={[',']}
											/>
										)}
									/>
								</Stack>
							</Tabs.Panel>

							<Tabs.Panel value="chat" pt="md" style={{ overflowY: 'auto' }}>
								<Stack gap="md">
									<FormTextarea
										name="firstMes"
										label={t('agentCards.editor.fields.firstMes')}
										textareaProps={{ minRows: 4, autosize: true }}
									/>
									<FormTextarea
										name="mesExample"
										label={t('agentCards.editor.fields.mesExample')}
										textareaProps={{ minRows: 4, autosize: true }}
									/>
									<FormTextarea
										name="personality"
										label={t('agentCards.editor.fields.personality')}
										textareaProps={{ minRows: 4, autosize: true }}
									/>
									<FormTextarea
										name="scenario"
										label={t('agentCards.editor.fields.scenario')}
										textareaProps={{ minRows: 4, autosize: true }}
									/>
								</Stack>
							</Tabs.Panel>

							<Tabs.Panel value="greetings" pt="md" style={{ overflowY: 'auto' }}>
								<Stack gap="md">
									<Group justify="space-between" align="center">
										<Text fw={600} style={{ marginBottom: 2 }}>
											{t('agentCards.editor.fields.alternateGreetings')}
										</Text>
										<Button
											type="button"
											size="xs"
											variant="light"
											leftSection={<LuPlus />}
											onClick={() => append({ value: '' })}
											disabled={isBusy}
										>
											{t('agentCards.editor.actions.addGreeting')}
										</Button>
									</Group>

									{fields.length === 0 ? (
										<Text c="dimmed" size="sm">
											{t('agentCards.editor.emptyGreetings')}
										</Text>
									) : (
										<Stack gap="sm">
											{fields.map((field, index) => (
												<GreetingItemField
													key={field.id}
													control={methods.control}
													index={index}
													total={fields.length}
													onMoveUp={() => move(index, index - 1)}
													onMoveDown={() => move(index, index + 1)}
													onRemove={() => remove(index)}
													disabled={isBusy}
													label={t('agentCards.editor.greetingLabel', { index: index + 1 })}
													openFullscreenLabel={t('dialogs.textarea.openFullscreen')}
													moveUpLabel={t('agentCards.editor.actions.moveUp')}
													moveDownLabel={t('agentCards.editor.actions.moveDown')}
													removeLabel={t('common.delete')}
												/>
											))}
										</Stack>
									)}
								</Stack>
							</Tabs.Panel>

							<Tabs.Panel value="system" pt="md" style={{ overflowY: 'auto' }}>
								<Stack gap="md">
									<FormTextarea
										name="systemPrompt"
										label={t('agentCards.editor.fields.systemPrompt')}
										textareaProps={{ minRows: 4, autosize: true }}
									/>
									<FormTextarea
										name="postHistoryInstructions"
										label={t('agentCards.editor.fields.postHistoryInstructions')}
										textareaProps={{ minRows: 4, autosize: true }}
									/>
									<FormTextarea
										name="creatorNotes"
										label={t('agentCards.editor.fields.creatorNotes')}
										textareaProps={{ minRows: 4, autosize: true }}
									/>
									<FormInput name="creator" label={t('agentCards.editor.fields.creator')} />
									<FormInput name="characterVersion" label={t('agentCards.editor.fields.characterVersion')} />
								</Stack>
							</Tabs.Panel>

							<Tabs.Panel value="worldInfo" pt="md" style={{ overflowY: 'auto' }}>
								<Stack gap="md">
									<Select
										label={t('agentCards.worldInfo.bindingLabel')}
										value={worldInfoBookId ?? '__none__'}
										data={worldInfoOptions}
										disabled={!profile || isBusy || worldInfoBindingPending}
										comboboxProps={{ withinPortal: false }}
										onChange={(value) => {
											if (!profile) return;
											onWorldInfoBindingChange(profile, value === '__none__' ? null : value ?? null);
										}}
									/>

									{selectedWorldInfoBook ? (
										<Stack gap={4}>
											<Text size="sm" fw={600}>
												{selectedWorldInfoBook.name}
											</Text>
											<Text size="xs" c="dimmed">
												slug: {selectedWorldInfoBook.slug}
											</Text>
										</Stack>
									) : (
										<Text size="sm" c="dimmed">
											{t('agentCards.worldInfo.notBound')}
										</Text>
									)}

									<Button type="button" variant="light" onClick={onOpenWorldInfoSidebar}>
										{t('agentCards.worldInfo.openEditor')}
									</Button>
								</Stack>
							</Tabs.Panel>

							<Tabs.Panel value="advanced" pt="md" style={{ overflowY: 'auto' }}>
								<Stack gap="md">
									<FormTextarea
										name="extensionsJson"
										label={t('agentCards.editor.fields.extensionsJson')}
										fieldProps={{ description: t('agentCards.editor.fields.extensionsJsonDescription') }}
										textareaProps={{ minRows: 8, autosize: true }}
									/>
									<FormTextarea
										name="characterBookJson"
										label={t('agentCards.editor.fields.characterBookJson')}
										fieldProps={{ description: t('agentCards.editor.fields.characterBookJsonDescription') }}
										textareaProps={{ minRows: 8, autosize: true }}
									/>
								</Stack>
							</Tabs.Panel>
						</Tabs>

						{jsonError && (
							<Text c="red" size="sm">
								{jsonError}
							</Text>
						)}

						<Group justify="flex-end">
							<Button type="button" variant="subtle" onClick={onClose} disabled={isBusy}>
								{t('common.cancel')}
							</Button>
							<Button type="submit" loading={saving} disabled={isBusy && !saving}>
								{t('common.save')}
							</Button>
						</Group>
					</Stack>
				</form>
			</FormProvider>
		</Dialog>
	);
};
