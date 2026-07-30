import { ActionIcon, Group, Stack, Switch, Text } from '@mantine/core';
import { useState, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { DotsSixVerticalIcon, PencilSimpleIcon, TrashIcon } from '@ui/icons';

import { movePromptOrderItem, type PromptOrderItem } from './prompt-order';
import { StPromptBlockEditorModal } from './st-prompt-block-editor-modal';
import {
	createStPromptBlockEditorSavePlan,
	createStPromptBlockEditorState,
	type StPromptBlockEditorState,
} from './st-prompt-block-editor-state';
import {
	canDeletePrompt,
	isRuntimeManagedPrompt,
	normalizePromptForEdit,
} from './st-prompt-blocks';

import type { StBasePrompt } from '@shared/types/instructions';

type StPromptBlockListProps = {
	entries: PromptOrderItem[];
	promptMap: Map<string, StBasePrompt>;
	onUpdatePreferredOrder: (updater: (order: PromptOrderItem[]) => PromptOrderItem[]) => void;
	onRemovePrompt: (identifier: string, index: number) => void;
	onUpdatePrompt: (identifier: string, patch: Partial<StBasePrompt>) => void;
};

function resolveDropSlotIndex(event: ReactDragEvent<HTMLElement>, index: number): number {
	const rect = event.currentTarget.getBoundingClientRect();
	const insertBefore = event.clientY < rect.top + rect.height / 2;
	return insertBefore ? index : index + 1;
}

function resolveDropTargetIndex(fromIndex: number, slotIndex: number): number {
	return fromIndex < slotIndex ? slotIndex - 1 : slotIndex;
}

function createCardStyle(params: {
	draggedIndex: number | null;
	dropSlotIndex: number | null;
	index: number;
}) {
	const dropBefore = params.dropSlotIndex === params.index;
	const dropAfter = params.dropSlotIndex === params.index + 1;

	return {
		border: '1px solid var(--mantine-color-gray-3)',
		borderRadius: 8,
		boxShadow: [
			dropBefore ? 'inset 0 3px 0 0 var(--mantine-color-blue-6)' : null,
			dropAfter ? 'inset 0 -3px 0 0 var(--mantine-color-blue-6)' : null,
		]
			.filter(Boolean)
			.join(', '),
		opacity: params.draggedIndex === params.index ? 0.55 : 1,
	};
}

export function StPromptBlockList({
	entries,
	promptMap,
	onUpdatePreferredOrder,
	onRemovePrompt,
	onUpdatePrompt,
}: StPromptBlockListProps) {
	const { t } = useTranslation();
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	const [dropSlotIndex, setDropSlotIndex] = useState<number | null>(null);
	const [editingPrompt, setEditingPrompt] = useState<StPromptBlockEditorState | null>(null);

	const clearDragState = () => {
		setDraggedIndex(null);
		setDropSlotIndex(null);
	};

	const commitDrop = (slotIndex: number) => {
		if (draggedIndex === null) return;

		const targetIndex = resolveDropTargetIndex(draggedIndex, slotIndex);
		if (targetIndex < 0 || targetIndex >= entries.length || targetIndex === draggedIndex) {
			clearDragState();
			return;
		}

		onUpdatePreferredOrder((order) => movePromptOrderItem(order, draggedIndex, targetIndex));
		clearDragState();
	};

	const handleDragStart = (event: ReactDragEvent<HTMLButtonElement>, index: number) => {
		setDraggedIndex(index);
		setDropSlotIndex(index);
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', String(index));
	};

	const handleDragOver = (event: ReactDragEvent<HTMLDivElement>, index: number) => {
		if (draggedIndex === null) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
		setDropSlotIndex(resolveDropSlotIndex(event, index));
	};

	const handleDrop = (event: ReactDragEvent<HTMLDivElement>, index: number) => {
		if (draggedIndex === null) return;
		event.preventDefault();
		commitDrop(resolveDropSlotIndex(event, index));
	};

	const handleReorderKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
		let targetIndex: number | null = null;

		if (event.key === 'ArrowUp') targetIndex = index - 1;
		else if (event.key === 'ArrowDown') targetIndex = index + 1;
		else if (event.key === 'Home') targetIndex = 0;
		else if (event.key === 'End') targetIndex = entries.length - 1;

		if (targetIndex === null || targetIndex < 0 || targetIndex >= entries.length || targetIndex === index) {
			return;
		}

		event.preventDefault();
		onUpdatePreferredOrder((order) => movePromptOrderItem(order, index, targetIndex));
	};

	const handlePromptSave = (draft: StPromptBlockEditorState) => {
		const savePlan = createStPromptBlockEditorSavePlan(draft);
		onUpdatePrompt(draft.identifier, savePlan.promptPatch);
	};

	return (
		<>
			{entries.map((entry, index) => {
				const prompt = normalizePromptForEdit(promptMap.get(entry.identifier), entry.identifier);
				const deletable = canDeletePrompt(entry.identifier);

				return (
					<Stack
						key={`${entry.identifier}_${index}`}
						gap={6}
						p="xs"
						style={createCardStyle({ draggedIndex, dropSlotIndex, index })}
						onDragOver={(event) => handleDragOver(event, index)}
						onDrop={(event) => handleDrop(event, index)}
					>
						<Group justify="space-between" align="center">
							<Group gap="xs" align="center" wrap="nowrap">
								<ActionIcon
									variant="subtle"
									size="sm"
									draggable
									onDragStart={(event) => handleDragStart(event, index)}
									onDragEnd={clearDragState}
									onKeyDown={(event) => handleReorderKeyDown(event, index)}
									aria-label={t('instructions.actions.reorderBlock')}
									title={t('instructions.actions.reorderBlock')}
									style={{ cursor: draggedIndex === index ? 'grabbing' : 'grab' }}
								>
									<DotsSixVerticalIcon size={16} />
								</ActionIcon>
								<Text size="sm" fw={500}>
									{prompt.name || t('instructions.defaults.unnamedPromptBlock')}
								</Text>
							</Group>

							<Group gap={4} wrap="nowrap">
								<Switch
									checked={entry.enabled}
									onChange={(event) => {
										const enabled = event.currentTarget.checked;
										onUpdatePreferredOrder((order) =>
											order.map((item, itemIndex) =>
												itemIndex === index ? { ...item, enabled } : item,
											),
										);
									}}
									size="sm"
								/>
								<ActionIcon
									variant="subtle"
									onClick={() =>
										setEditingPrompt(
											createStPromptBlockEditorState({
												prompt,
												contentReadOnly: isRuntimeManagedPrompt(prompt),
											}),
										)
									}
									aria-label={t('instructions.actions.editBlock')}
									title={t('instructions.actions.editBlock')}
								>
									<PencilSimpleIcon size={16} />
								</ActionIcon>
								{deletable ? (
									<ActionIcon
										variant="subtle"
										color="red"
										onClick={() => onRemovePrompt(entry.identifier, index)}
										aria-label={t('common.delete')}
										title={t('common.delete')}
									>
										<TrashIcon size={16} />
									</ActionIcon>
								) : null}
							</Group>
						</Group>
					</Stack>
				);
			})}

			<StPromptBlockEditorModal
				opened={editingPrompt !== null}
				value={editingPrompt}
				onClose={() => setEditingPrompt(null)}
				onSave={handlePromptSave}
			/>
		</>
	);
}
