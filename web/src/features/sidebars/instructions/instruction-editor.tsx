import { Accordion, Button, Group, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';


import { $currentBranchId, $currentChat, $currentEntityProfile } from '@model/chat-core';
import { $selectedInstruction, instructionEditorDraftChanged } from '@model/instructions';
import {
	createEmptyStBaseConfig,
	resolvePreferredPromptOrder,
} from '@model/instructions/st-preset';
import { PlusIcon } from '@ui/icons';
import { LiquidDocsButton } from '@ui/liquid-template-docs';

import { prerenderInstruction } from '../../../api/instructions';

import { StPromptBlockCreateModal } from './st-prompt-block-create-modal';
import { StPromptBlockList } from './st-prompt-block-list';
import {
	createCustomPrompt,
	normalizePromptForEdit,
	type PromptBlockFields,
} from './st-prompt-blocks';

import type { StBaseConfig, StBasePrompt } from '@shared/types/instructions';

export const InstructionEditor = () => {
	const { t } = useTranslation();
	const instruction = useUnit($selectedInstruction);
	const [chat, branchId, profile] = useUnit([$currentChat, $currentBranchId, $currentEntityProfile]);

	const [basicTemplateText, setBasicTemplateText] = useState('');
	const [stBase, setStBase] = useState<StBaseConfig | null>(null);
	const [createBlockOpened, setCreateBlockOpened] = useState(false);
	const [preview, setPreview] = useState('');
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);

	const lastResetInstructionIdRef = useRef<string | null>(null);

	useEffect(() => {
		const nextInstruction = instruction;
		const nextInstructionId = nextInstruction?.id ?? null;

		if (nextInstructionId === null) {
			lastResetInstructionIdRef.current = null;
			setBasicTemplateText('');
			setStBase(null);
			return;
		}

		if (!nextInstruction || lastResetInstructionIdRef.current === nextInstructionId) return;
		lastResetInstructionIdRef.current = nextInstructionId;

		if (nextInstruction.kind === 'basic') {
			setBasicTemplateText(nextInstruction.templateText);
			setStBase(null);
		} else {
			setBasicTemplateText('');
			setStBase(structuredClone(nextInstruction.stBase));
		}

		setCreateBlockOpened(false);
		setPreview('');
		setPreviewError(null);
	}, [instruction]);

	useEffect(() => {
		if (!instruction) {
			instructionEditorDraftChanged(null);
			return;
		}

		if (instruction.kind === 'basic') {
			instructionEditorDraftChanged({
				sourceInstructionId: instruction.id,
				kind: 'basic',
				name: instruction.name,
				templateText: basicTemplateText,
				meta: instruction.meta ?? undefined,
			});
			return;
		}

		instructionEditorDraftChanged({
			sourceInstructionId: instruction.id,
			kind: 'st_base',
			name: instruction.name,
			stBase: stBase ?? createEmptyStBaseConfig(),
			meta: instruction.meta ?? undefined,
		});
	}, [basicTemplateText, instruction, stBase]);

	const preferredOrder = useMemo(() => {
		if (!stBase) return null;
		return resolvePreferredPromptOrder(stBase);
	}, [stBase]);

	const promptMap = useMemo(() => {
		const map = new Map<string, StBasePrompt>();
		for (const prompt of stBase?.prompts ?? []) {
			map.set(prompt.identifier, prompt);
		}
		return map;
	}, [stBase]);

	const rawPresetJson = useMemo(() => {
		if (!stBase) return '';
		try {
			return JSON.stringify(stBase.rawPreset ?? {}, null, 2);
		} catch {
			return '{}';
		}
	}, [stBase]);

	if (!instruction) return null;

	const updatePreferredOrder = (
		updater: (
			order: Array<{ identifier: string; enabled: boolean }>,
		) => Array<{ identifier: string; enabled: boolean }>,
	) => {
		setStBase((current) => {
			if (!current) return current;

			const selectedOrder = resolvePreferredPromptOrder(current);
			const nextOrder = updater(selectedOrder.order.map((item) => ({ ...item })));
			const existingIndex = current.promptOrder.findIndex((item) => item.character_id === selectedOrder.character_id);
			const nextPromptOrder = [...current.promptOrder];

			if (existingIndex >= 0) {
				nextPromptOrder[existingIndex] = {
					...nextPromptOrder[existingIndex],
					order: nextOrder,
				};
			} else {
				nextPromptOrder.unshift({
					character_id: selectedOrder.character_id,
					order: nextOrder,
				});
			}

			return {
				...current,
				promptOrder: nextPromptOrder,
			};
		});
	};

	const upsertPrompt = (prompt: StBasePrompt) => {
		setStBase((current) => {
			if (!current) return current;

			const index = current.prompts.findIndex((item) => item.identifier === prompt.identifier);
			if (index >= 0) {
				const prompts = [...current.prompts];
				prompts[index] = { ...prompts[index], ...prompt };
				return { ...current, prompts };
			}

			return {
				...current,
				prompts: [...current.prompts, prompt],
			};
		});
	};

	const addPromptToPreferredOrder = (identifier: string) => {
		updatePreferredOrder((order) => {
			if (order.some((item) => item.identifier === identifier)) {
				return order.map((item) => (item.identifier === identifier ? { ...item, enabled: true } : item));
			}

			return [...order, { identifier, enabled: true }];
		});
	};

	const updatePrompt = (identifier: string, patch: Partial<StBasePrompt>) => {
		const existing = normalizePromptForEdit(promptMap.get(identifier), identifier);
		upsertPrompt({
			...existing,
			...patch,
		});
	};

	const removePrompt = (identifier: string, index: number) => {
		setStBase((current) => {
			if (!current) return current;

			const selectedOrder = resolvePreferredPromptOrder(current);
			const nextOrder = selectedOrder.order.filter((_, itemIndex) => itemIndex !== index);
			const existingIndex = current.promptOrder.findIndex((item) => item.character_id === selectedOrder.character_id);
			const nextPromptOrder = [...current.promptOrder];

			if (existingIndex >= 0) {
				nextPromptOrder[existingIndex] = {
					...nextPromptOrder[existingIndex],
					order: nextOrder,
				};
			} else {
				nextPromptOrder.unshift({
					character_id: selectedOrder.character_id,
					order: nextOrder,
				});
			}

			const stillUsed = nextPromptOrder.some((item) =>
				item.order.some((orderItem) => orderItem.identifier === identifier),
			);

			return {
				...current,
				promptOrder: nextPromptOrder,
				prompts: stillUsed
					? current.prompts
					: current.prompts.filter((item) => item.identifier !== identifier),
			};
		});
	};

	const handleCreatePrompt = (fields: PromptBlockFields) => {
		const prompt = createCustomPrompt(fields);
		upsertPrompt(prompt);
		addPromptToPreferredOrder(prompt.identifier);
		setCreateBlockOpened(false);
	};

	const onPrerender = async () => {
		setPreviewLoading(true);
		setPreviewError(null);
		try {
			const data = await prerenderInstruction({
				templateText: basicTemplateText,
				chatId: chat?.id ?? undefined,
				branchId: branchId ?? undefined,
				entityProfileId: profile?.id ?? undefined,
				historyLimit: 50,
			});
			setPreview(data.rendered);
		} catch (e) {
			setPreview('');
			setPreviewError(e instanceof Error ? e.message : String(e));
		} finally {
			setPreviewLoading(false);
		}
	};

	return (
		<Stack gap="md" mt="md">
			<Stack gap={2}>
				<Text fw={600}>{instruction.name}</Text>
				<Text size="sm" c="dimmed">
					{instruction.kind === 'st_base'
						? t('instructions.fields.stBaseTypeDescription')
						: t('instructions.fields.basicTypeDescription')}
				</Text>
			</Stack>

			{instruction.kind === 'basic' ? (
				<>
					<Textarea
						label={
							<Group gap={6} wrap="nowrap" align="center">
								{t('instructions.fields.templateText')}
								<LiquidDocsButton context="instruction" />
							</Group>
						}
						description={t('instructions.fields.templateTextDescription')}
						value={basicTemplateText}
						onChange={(e) => setBasicTemplateText(e.currentTarget.value)}
						minRows={14}
						autosize
						styles={{ input: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } }}
					/>

					{previewError ? (
						<Text c="red" size="sm">
							{previewError}
						</Text>
					) : null}

					{preview.length > 0 ? (
						<Textarea
							label={t('instructions.fields.prerender')}
							description={t('instructions.fields.prerenderDescription')}
							value={preview}
							readOnly
							minRows={10}
							autosize
							styles={{ input: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } }}
						/>
					) : null}

					<Group justify="flex-end">
						<Button variant="light" loading={previewLoading} onClick={onPrerender}>
							{t('instructions.actions.prerender')}
						</Button>
					</Group>
				</>
			) : null}

			{instruction.kind === 'st_base' && stBase && preferredOrder ? (
				<Stack gap="sm">
					<Group justify="space-between" align="center">
						<Text fw={600}>{t('instructions.fields.promptBlocks')}</Text>
						<Button
							size="sm"
							variant={createBlockOpened ? 'default' : 'light'}
							leftSection={<PlusIcon size={14} />}
							onClick={() => setCreateBlockOpened(true)}
						>
							{t('instructions.actions.addPromptBlock')}
						</Button>
					</Group>

					<StPromptBlockList
						entries={preferredOrder.order}
						promptMap={promptMap}
						onUpdatePreferredOrder={updatePreferredOrder}
						onRemovePrompt={removePrompt}
						onUpdatePrompt={updatePrompt}
					/>

					<StPromptBlockCreateModal
						opened={createBlockOpened}
						onClose={() => setCreateBlockOpened(false)}
						onCreate={handleCreatePrompt}
					/>

					<Accordion variant="separated">
						<Accordion.Item value="details">
							<Accordion.Control>{t('instructions.fields.details')}</Accordion.Control>
							<Accordion.Panel>
								<Stack gap="sm">
									<Group grow align="flex-start">
										<TextInput label={t('instructions.fields.importSource')} value={stBase.importInfo.source} readOnly />
										<TextInput label={t('instructions.fields.importFileName')} value={stBase.importInfo.fileName} readOnly />
										<TextInput label={t('instructions.fields.importedAt')} value={stBase.importInfo.importedAt} readOnly />
									</Group>
									<Textarea
										label={t('instructions.fields.rawPreset')}
										value={rawPresetJson}
										readOnly
										minRows={6}
										autosize
										styles={{ input: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } }}
									/>
								</Stack>
							</Accordion.Panel>
						</Accordion.Item>
					</Accordion>
				</Stack>
			) : null}
		</Stack>
	);
}
