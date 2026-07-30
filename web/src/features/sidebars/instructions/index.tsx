import { Button, Group, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { useUnit } from 'effector-react';
import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';


import { $appSettings, updateAppSettings } from '@model/app-settings';
import {
	$instructionEditorDraft,
	$instructions,
	$selectedInstructionId,
	createInstructionFx,
	deleteInstructionFx,
	instructionSelected,
	updateInstructionFx,
} from '@model/instructions';
import {
	buildStPresetFromStBase,
	createBestEffortLlmBindingPlan,
	createStBaseConfigFromPreset,
	detectStChatCompletionPreset,
	getStPresetValidationError,
	hasSensitivePresetFields,
} from '@model/instructions/st-preset';
import { Drawer } from '@ui/drawer';
import { EXPORT_FILE_ICON, IMPORT_FILE_ICON } from '@ui/file-transfer-icons';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { LinkIcon, LinkBreakIcon, PencilSimpleIcon, PlusIcon, FloppyDiskIcon, TrashIcon } from '@ui/icons';
import { toaster } from '@ui/toaster';

import { getDefaultStPreset } from '../../../api/instructions';
import { getRuntime, patchRuntime } from '../../../api/llm';

import { InstructionBundleActions } from './instruction-bundle-actions';
import { InstructionEditor } from './instruction-editor';

import type { CreateInstructionDraft, InstructionDto } from '../../../api/instructions';
import type { InstructionMeta, StBaseConfig } from '@shared/types/instructions';

type NameDialogMode = 'rename' | 'saveAs';

type NameDialogState = {
	mode: NameDialogMode;
	value: string;
	title: string;
	submitLabel: string;
};

type PendingSensitiveImport = {
	fileName: string;
	json: Record<string, unknown>;
};

type CreateDialogState = {
	kind: 'basic' | 'st_base' | null;
	name: string;
};

type InstructionViewState =
	| {
			kind: 'basic';
			name: string;
			templateText: string;
			meta?: InstructionMeta;
	  }
	| {
			kind: 'st_base';
			name: string;
			stBase: StBaseConfig;
			meta?: InstructionMeta;
	  };

function downloadJson(params: { fileName: string; data: unknown }): void {
	const blob = new Blob([JSON.stringify(params.data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = params.fileName;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

function getBasename(fileName: string): string {
	const idx = fileName.lastIndexOf('.');
	if (idx <= 0) return fileName;
	return fileName.slice(0, idx);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveCopyName(originalName: string, usedNames: Set<string>): string {
	const firstCopy = `${originalName} (copy)`;
	if (!usedNames.has(firstCopy)) return firstCopy;
	let index = 2;
	while (usedNames.has(`${originalName} (copy ${index})`)) {
		index += 1;
	}
	return `${originalName} (copy ${index})`;
}

function resolveUniqueName(name: string, usedNames: Set<string>): string {
	const trimmed = name.trim();
	if (!usedNames.has(trimmed)) return trimmed;
	return resolveCopyName(trimmed, usedNames);
}

function toInstructionViewState(instruction: InstructionDto): InstructionViewState {
	if (instruction.kind === 'st_base') {
		return {
			kind: 'st_base',
			name: instruction.name,
			stBase: instruction.stBase,
			meta: instruction.meta ?? undefined,
		};
	}

	return {
		kind: 'basic',
		name: instruction.name,
		templateText: instruction.templateText,
		meta: instruction.meta ?? undefined,
	};
}

function areInstructionValuesEqual(
	selectedInstruction: InstructionDto | null,
	draft:
		| ({
				sourceInstructionId: string;
		  } & InstructionViewState)
		| null,
): boolean {
	if (!selectedInstruction || !draft) return true;
	if (draft.sourceInstructionId !== selectedInstruction.id) return false;
	if (draft.kind !== selectedInstruction.kind) return false;
	if (draft.name !== selectedInstruction.name) return false;
	if (JSON.stringify(draft.meta ?? null) !== JSON.stringify(selectedInstruction.meta ?? null)) return false;

	if (draft.kind === 'basic' && selectedInstruction.kind === 'basic') {
		return draft.templateText === selectedInstruction.templateText;
	}

	if (draft.kind === 'st_base' && selectedInstruction.kind === 'st_base') {
		return JSON.stringify(draft.stBase) === JSON.stringify(selectedInstruction.stBase);
	}

	return false;
}

function createInstructionPayloadFromState(params: InstructionViewState): CreateInstructionDraft {
	if (params.kind === 'st_base') {
		return {
			kind: 'st_base',
			name: params.name.trim(),
			stBase: params.stBase,
			meta: params.meta,
		};
	}

	return {
		kind: 'basic',
		name: params.name.trim(),
		templateText: params.templateText,
		meta: params.meta,
	};
}

function createInstructionLabel(item: InstructionDto): string {
	return item.name;
}

export const InstructionsSidebar = () => {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [items, selectedId, draft, appSettings, onCreateInstruction, onUpdateInstruction, onDeleteInstruction] = useUnit([
		$instructions,
		$selectedInstructionId,
		$instructionEditorDraft,
		$appSettings,
		createInstructionFx,
		updateInstructionFx,
		deleteInstructionFx,
	]);

	const [createOpened, setCreateOpened] = useState(false);
	const [createDialog, setCreateDialog] = useState<CreateDialogState>({
		kind: null,
		name: '',
	});
	const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
	const [deleteOpened, setDeleteOpened] = useState(false);
	const [discardOpened, setDiscardOpened] = useState(false);
	const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(null);
	const [pendingSensitiveImport, setPendingSensitiveImport] = useState<PendingSensitiveImport | null>(null);

	const selectedInstruction = items.find((item) => item.id === selectedId) ?? null;
	const selectedValue = selectedInstruction?.id ?? null;
	const usedNames = useMemo(() => new Set(items.map((item) => item.name)), [items]);
	const options = items
		.filter((item) => typeof item.id === 'string' && item.id.trim().length > 0)
		.map((item) => ({ value: item.id, label: createInstructionLabel(item) }));

	const currentValues = useMemo<InstructionViewState | null>(() => {
		if (draft && selectedInstruction && draft.sourceInstructionId === selectedInstruction.id) {
			if (draft.kind === 'st_base') {
				return {
					kind: 'st_base',
					name: draft.name,
					stBase: draft.stBase,
					meta: draft.meta,
				};
			}
			return {
				kind: 'basic',
				name: draft.name,
				templateText: draft.templateText,
				meta: draft.meta,
			};
		}

		if (selectedInstruction) {
			return toInstructionViewState(selectedInstruction);
		}

		return null;
	}, [draft, selectedInstruction]);

	const hasUnsavedChanges = useMemo(
		() => !areInstructionValuesEqual(selectedInstruction, draft),
		[selectedInstruction, draft],
	);

	const applyBestEffortBinding = async (instruction: InstructionDto) => {
		if (!appSettings.bindChatCompletionPresetToConnection) return;
		if (instruction.kind !== 'st_base') return;

		const plan = createBestEffortLlmBindingPlan(instruction.stBase);
		try {
			if (plan.runtimePatch?.activeProviderId || typeof plan.runtimePatch?.activeModel !== 'undefined') {
				const currentRuntime = await getRuntime({ scope: 'global', scopeId: 'global' });
				await patchRuntime({
					scope: 'global',
					scopeId: 'global',
					activeProviderId: plan.runtimePatch.activeProviderId ?? currentRuntime.activeProviderId,
					activeTokenId: currentRuntime.activeTokenId,
					activeModel:
						typeof plan.runtimePatch.activeModel === 'undefined'
							? currentRuntime.activeModel
							: plan.runtimePatch.activeModel,
				});
			}
		} catch (error) {
			toaster.warning({
				title: t('instructions.toasts.bindWarningTitle'),
				description: error instanceof Error ? error.message : String(error),
			});
		}

		if (plan.warnings.length > 0) {
			toaster.warning({
				title: t('instructions.toasts.bindWarningTitle'),
				description: plan.warnings.join(' '),
			});
		}
	};

	const applySelection = async (nextId: string) => {
		instructionSelected(nextId);
		const nextInstruction = items.find((item) => item.id === nextId);
		if (nextInstruction) {
			await applyBestEffortBinding(nextInstruction);
		}
	};

	const promptForRename = () => {
		if (!currentValues) return;
		setNameDialog({
			mode: 'rename',
			value: currentValues.name,
			title: t('instructions.dialogs.renameTitle'),
			submitLabel: t('instructions.actions.rename'),
		});
	};

	const handleNameDialogSubmit = async () => {
		if (!nameDialog || !currentValues || !selectedInstruction) return;
		const nextName = nameDialog.value.trim();
		if (!nextName) return;
		const resolvedName =
			nameDialog.mode === 'rename'
				? nextName
				: resolveUniqueName(nextName, usedNames);

		const nextState: InstructionViewState = { ...currentValues, name: resolvedName } as InstructionViewState;

		try {
			if (nameDialog.mode === 'rename') {
				await onUpdateInstruction({
					id: selectedInstruction.id,
					...createInstructionPayloadFromState(nextState),
				});
				toaster.success({ title: t('instructions.toasts.savedTitle'), description: resolvedName });
			} else {
				const created = await onCreateInstruction(createInstructionPayloadFromState(nextState));
				await applyBestEffortBinding(created);
				toaster.success({ title: t('instructions.toasts.createdTitle'), description: created.name });
			}
			setNameDialog(null);
		} catch {
			// global effect watchers already show the error toast
		}
	};

	const handleUpdateCurrent = async () => {
		if (!currentValues || !selectedInstruction) return;
		try {
			await onUpdateInstruction({
				id: selectedInstruction.id,
				...createInstructionPayloadFromState(currentValues),
			});
			toaster.success({ title: t('instructions.toasts.savedTitle'), description: currentValues.name });
		} catch {
			// handled by model watcher
		}
	};

	const handleDelete = async () => {
		if (!selectedInstruction) return;
		try {
			await onDeleteInstruction({ id: selectedInstruction.id });
			setDeleteOpened(false);
		} catch {
			// handled by model watcher
		}
	};

	const openCreateDialog = () => {
		setCreateDialog({
			kind: null,
			name: resolveUniqueName(t('instructions.defaults.newPreset'), usedNames),
		});
		setCreateOpened(true);
	};

	const handleCreateBasic = async (name: string): Promise<boolean> => {
		try {
			const created = await onCreateInstruction(
				{
					kind: 'basic',
					name: resolveUniqueName(name, usedNames),
					templateText: '{{char.name}}',
				}
			);
			await applyBestEffortBinding(created);
			toaster.success({ title: t('instructions.toasts.createdTitle'), description: created.name });
			return true;
		} catch {
			// handled by model watcher
			return false;
		}
	};

	const createSillyTavernLikeInstruction = async (name: string): Promise<boolean> => {
		try {
			const defaultPreset = await getDefaultStPreset();
			const stBase = createStBaseConfigFromPreset({
				preset: defaultPreset.preset,
				fileName: defaultPreset.fileName,
				sensitiveImportMode: 'keep',
			});
			const created = await onCreateInstruction({
				kind: 'st_base',
				name: resolveUniqueName(name, usedNames),
				stBase,
			});
			await applyBestEffortBinding(created);
			toaster.success({ title: t('instructions.toasts.createdTitle'), description: created.name });
			return true;
		} catch (error) {
			toaster.error({
				title: t('instructions.toasts.createErrorTitle'),
				description: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	};

	const handleCreateSubmit = async () => {
		const nextName = createDialog.name.trim();
		if (!createDialog.kind || !nextName) return;

		let created = false;
		if (createDialog.kind === 'basic') {
			created = await handleCreateBasic(nextName);
		} else {
			created = await createSillyTavernLikeInstruction(nextName);
		}

		if (created) {
			setCreateOpened(false);
		}
	};

	const handleExport = () => {
		if (!currentValues || currentValues.kind !== 'st_base') {
			toaster.error({ title: t('instructions.toasts.exportNotPossibleTitle'), description: t('instructions.toasts.stPresetOnlyExport') });
			return;
		}

		downloadJson({
			fileName: `${currentValues.name}.json`,
			data: buildStPresetFromStBase(currentValues.stBase),
		});
	};

	const importStPreset = (fileName: string, json: Record<string, unknown>, sensitiveImportMode: 'remove' | 'keep') => {
		const stBase = createStBaseConfigFromPreset({
			preset: json,
			fileName,
			sensitiveImportMode,
		});
		void onCreateInstruction({
			kind: 'st_base',
			name: resolveUniqueName(
				getBasename(fileName).trim() || t('instructions.defaults.importedInstruction'),
				usedNames,
			),
			stBase,
		})
			.then((created) => {
				void applyBestEffortBinding(created);
				toaster.success({ title: t('instructions.toasts.importSuccessTitle'), description: created.name });
			})
			.catch(() => {
				// handled by model watcher
			});
	};

	const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (readEvent) => {
			try {
				const content = String(readEvent.target?.result ?? '');
				const json = JSON.parse(content) as unknown;

				if (
					isRecord(json) &&
					json.type === 'talespinner.instruction' &&
					isRecord(json.instruction) &&
					(json.instruction.kind === 'basic' || json.instruction.kind === 'st_base')
				) {
					const name = typeof json.instruction.name === 'string' ? json.instruction.name : t('instructions.defaults.importedInstruction');
					const meta = isRecord(json.instruction.meta) ? (json.instruction.meta as InstructionMeta) : undefined;

					if (json.instruction.kind === 'basic') {
						const templateText = typeof json.instruction.templateText === 'string' ? json.instruction.templateText : '';
						if (!templateText.trim()) {
							toaster.error({
								title: t('instructions.toasts.importErrorTitle'),
								description: t('instructions.toasts.importMissingTemplateText'),
							});
							return;
						}

						void onCreateInstruction({ kind: 'basic', name, templateText, meta })
							.then((created) => toaster.success({ title: t('instructions.toasts.importSuccessTitle'), description: created.name }))
							.catch(() => {
								// handled by model watcher
							});
						return;
					}

					if (!isRecord(json.instruction.stBase)) {
						toaster.error({
							title: t('instructions.toasts.importErrorTitle'),
							description: t('instructions.toasts.importMissingStBase'),
						});
						return;
					}

					void onCreateInstruction({
						kind: 'st_base',
						name,
						stBase: json.instruction.stBase as StBaseConfig,
						meta,
					})
						.then((created) => {
							void applyBestEffortBinding(created);
							toaster.success({ title: t('instructions.toasts.importSuccessTitle'), description: created.name });
						})
						.catch(() => {
							// handled by model watcher
						});
					return;
				}

				const stPresetValidationError = getStPresetValidationError(json);
				if (!stPresetValidationError && detectStChatCompletionPreset(json)) {
					if (hasSensitivePresetFields(json)) {
						setPendingSensitiveImport({ fileName: file.name, json });
						return;
					}

					importStPreset(file.name, json, 'keep');
					return;
				}

				toaster.error({
					title: t('instructions.toasts.importErrorTitle'),
					description: stPresetValidationError ?? t('instructions.toasts.importReadError'),
				});
			} catch (error) {
				toaster.error({
					title: t('instructions.toasts.importErrorTitle'),
					description: error instanceof Error ? error.message : t('instructions.toasts.importReadError'),
				});
			} finally {
				if (fileInputRef.current) fileInputRef.current.value = '';
			}
		};
		reader.readAsText(file);
	};

	return (
		<Drawer name="instructions" title={t('instructions.title')}>
			<Stack gap="md">
				<input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json,.settings" onChange={handleFileChange} />

				<Modal
					opened={createOpened}
					onClose={() => setCreateOpened(false)}
					title={t('instructions.dialogs.createTitle')}
					centered
				>
					<Stack gap="md">
						<Select
							label={t('instructions.fields.createInstructionType')}
							placeholder={t('instructions.placeholders.createInstructionType')}
							value={createDialog.kind}
							onChange={(value) =>
								setCreateDialog((current) => ({
									...current,
									kind: (value as CreateDialogState['kind']) ?? null,
								}))
							}
							data={[
								{ value: 'basic', label: t('instructions.actions.createBasic') },
								{ value: 'st_base', label: t('instructions.actions.createStBase') },
							]}
							allowDeselect
						/>
						<TextInput
							label={t('instructions.fields.name')}
							value={createDialog.name}
							onChange={(event) =>
								setCreateDialog((current) => ({
									...current,
									name: event.currentTarget.value,
								}))
							}
							placeholder={t('instructions.placeholders.name')}
						/>
						{createDialog.kind && (
							<Text size="sm" c="dimmed">
								{createDialog.kind === 'basic'
									? t('instructions.dialogs.createBasicHelp')
									: t('instructions.dialogs.createStBaseHelp')}
							</Text>
						)}
						<Group justify="flex-end">
							<Button variant="default" onClick={() => setCreateOpened(false)}>
								{t('common.cancel')}
							</Button>
							<Button onClick={() => void handleCreateSubmit()} disabled={!createDialog.kind || !createDialog.name.trim()}>
								{t('instructions.actions.create')}
							</Button>
						</Group>
					</Stack>
				</Modal>

				<Modal
					opened={nameDialog !== null}
					onClose={() => setNameDialog(null)}
					title={nameDialog?.title ?? ''}
					centered
				>
					<Stack gap="md">
						<TextInput
							label={t('instructions.fields.name')}
							value={nameDialog?.value ?? ''}
							onChange={(event) =>
								setNameDialog((current) =>
									current ? { ...current, value: event.currentTarget.value } : current,
								)
							}
							placeholder={t('instructions.placeholders.name')}
							autoFocus
						/>
						<Group justify="flex-end">
							<Button variant="default" onClick={() => setNameDialog(null)}>
								{t('common.cancel')}
							</Button>
							<Button onClick={() => void handleNameDialogSubmit()}>{nameDialog?.submitLabel}</Button>
						</Group>
					</Stack>
				</Modal>

				<Modal opened={deleteOpened} onClose={() => setDeleteOpened(false)} title={t('instructions.dialogs.deleteTitle')} centered>
					<Stack gap="md">
						<Text>{t('instructions.confirm.deleteInstruction')}</Text>
						<Group justify="flex-end">
							<Button variant="default" onClick={() => setDeleteOpened(false)}>
								{t('common.cancel')}
							</Button>
							<Button color="red" onClick={() => void handleDelete()}>
								{t('common.delete')}
							</Button>
						</Group>
					</Stack>
				</Modal>

				<Modal
					opened={discardOpened}
					onClose={() => {
						setDiscardOpened(false);
						setPendingSelectionId(null);
					}}
					title={t('instructions.dialogs.discardTitle')}
					centered
				>
					<Stack gap="md">
						<Text>{t('instructions.confirm.discardChanges')}</Text>
						<Group justify="flex-end">
							<Button
								variant="default"
								onClick={() => {
									setDiscardOpened(false);
									setPendingSelectionId(null);
								}}
							>
								{t('common.cancel')}
							</Button>
							<Button
								color="yellow"
								onClick={() => {
									const nextId = pendingSelectionId;
									setDiscardOpened(false);
									setPendingSelectionId(null);
									if (nextId) void applySelection(nextId);
								}}
							>
								{t('instructions.actions.discardAndSwitch')}
							</Button>
						</Group>
					</Stack>
				</Modal>

				<Modal
					opened={pendingSensitiveImport !== null}
					onClose={() => setPendingSensitiveImport(null)}
					title={t('instructions.dialogs.sensitiveImportTitle')}
					centered
				>
					<Stack gap="md">
						<Text>{t('instructions.confirm.sensitiveImportChoice')}</Text>
						<Group justify="flex-end">
							<Button variant="default" onClick={() => setPendingSensitiveImport(null)}>
								{t('common.cancel')}
							</Button>
							<Button
								variant="default"
								onClick={() => {
									if (!pendingSensitiveImport) return;
									importStPreset(pendingSensitiveImport.fileName, pendingSensitiveImport.json, 'remove');
									setPendingSensitiveImport(null);
								}}
							>
								{t('instructions.actions.importWithoutSensitive')}
							</Button>
							<Button
								onClick={() => {
									if (!pendingSensitiveImport) return;
									importStPreset(pendingSensitiveImport.fileName, pendingSensitiveImport.json, 'keep');
									setPendingSensitiveImport(null);
								}}
							>
								{t('instructions.actions.importAsIs')}
							</Button>
						</Group>
					</Stack>
				</Modal>

				<Stack gap="xs">
					<Select
						data={options}
						value={selectedValue}
						onChange={(id) => {
							if (!id || id === selectedValue) return;
							if (hasUnsavedChanges) {
								setPendingSelectionId(id);
								setDiscardOpened(true);
								return;
							}
							void applySelection(id);
						}}
						placeholder={t('instructions.placeholders.selectInstruction')}
						comboboxProps={{ withinPortal: false }}
						className="ts-sidebar-toolbar__main"
					/>

					<Group justify="flex-end" gap="xs" wrap="wrap">
						<IconButtonWithTooltip
							tooltip={t('instructions.actions.create')}
							icon={<PlusIcon size={16} />}
							aria-label={t('instructions.actions.create')}
							onClick={openCreateDialog}
						/>
						<IconButtonWithTooltip
							tooltip={
								appSettings.bindChatCompletionPresetToConnection
									? t('instructions.presets.actions.unbind')
									: t('instructions.presets.actions.bind')
							}
							icon={
								appSettings.bindChatCompletionPresetToConnection ? (
									<LinkIcon size={16} />
								) : (
									<LinkBreakIcon size={16} />
								)
							}
							aria-label={t('instructions.presets.actions.bind')}
							variant={appSettings.bindChatCompletionPresetToConnection ? 'solid' : 'subtle'}
							onClick={() =>
								updateAppSettings({
									bindChatCompletionPresetToConnection: !appSettings.bindChatCompletionPresetToConnection,
								})
							}
						/>
						<IconButtonWithTooltip
							tooltip={t('instructions.presets.actions.import')}
							icon={<IMPORT_FILE_ICON size={16} />}
							aria-label={t('instructions.presets.actions.import')}
							onClick={() => fileInputRef.current?.click()}
						/>
						<InstructionBundleActions selectedInstruction={selectedInstruction} />
						<IconButtonWithTooltip
							tooltip={t('instructions.presets.actions.export')}
							icon={<EXPORT_FILE_ICON size={16} />}
							aria-label={t('instructions.presets.actions.export')}
							disabled={currentValues?.kind !== 'st_base'}
							onClick={handleExport}
						/>
						<IconButtonWithTooltip
							tooltip={t('instructions.presets.actions.delete')}
							icon={<TrashIcon size={16} />}
							aria-label={t('instructions.presets.actions.delete')}
							color="red"
							variant="outline"
							disabled={!selectedInstruction}
							onClick={() => setDeleteOpened(true)}
						/>
						<IconButtonWithTooltip
							tooltip={t('instructions.actions.updateCurrent')}
							icon={<FloppyDiskIcon size={16} />}
							aria-label={t('instructions.actions.updateCurrent')}
							variant="solid"
							disabled={!selectedInstruction || !hasUnsavedChanges}
							onClick={() => void handleUpdateCurrent()}
						/>
						<IconButtonWithTooltip
							tooltip={t('instructions.actions.rename')}
							icon={<PencilSimpleIcon size={16} />}
							aria-label={t('instructions.actions.rename')}
							disabled={!selectedInstruction}
							onClick={promptForRename}
						/>
					</Group>
				</Stack>

				<InstructionEditor />
			</Stack>
		</Drawer>
	);
};
