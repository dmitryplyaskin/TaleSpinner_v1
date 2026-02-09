import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Z_INDEX } from '@ui/z-index';

import { DEFAULT_GROUP_COLOR_HEX, normalizeCssColorToHex } from '../utils/color';

export type GroupEditorDraft = { groupId: string; name: string; bg: string };

type Props = {
	draft: GroupEditorDraft | null;
	onClose: () => void;
	onDelete: (groupId: string) => void;
	onSave: (draft: GroupEditorDraft) => void;
};

export const GroupEditorModal: React.FC<Props> = ({ draft, onClose, onDelete, onSave }) => {
	const { t } = useTranslation();
	const opened = Boolean(draft);
	const [localDraft, setLocalDraft] = useState<GroupEditorDraft | null>(draft);

	useEffect(() => {
		setLocalDraft(draft ? { ...draft } : null);
	}, [draft]);

	const hexValue = useMemo(() => {
		if (!localDraft) return DEFAULT_GROUP_COLOR_HEX;
		return normalizeCssColorToHex(localDraft.bg?.trim() ? localDraft.bg : DEFAULT_GROUP_COLOR_HEX, DEFAULT_GROUP_COLOR_HEX);
	}, [localDraft]);

	return (
		<Modal opened={opened} onClose={onClose} title={t('operationProfiles.groupEditor.title')} centered zIndex={Z_INDEX.overlay.modalChild}>
			{localDraft && (
				<Stack gap="sm">
					<TextInput
						label={t('operationProfiles.groupEditor.name')}
						value={localDraft.name}
						onChange={(e) => {
							const nextName = e.currentTarget.value;
							setLocalDraft((prev) => (prev ? { ...prev, name: nextName } : prev));
						}}
						placeholder={t('operationProfiles.groupEditor.namePlaceholder')}
						autoFocus
					/>

					<div>
						<Text size="sm" fw={600} style={{ marginBottom: 6 }}>
							{t('operationProfiles.groupEditor.background')}
						</Text>
						<Group gap="xs" wrap="nowrap">
							<input
								type="color"
								value={hexValue}
								onChange={(e) => {
									const nextBg = e.currentTarget.value;
									setLocalDraft((prev) => (prev ? { ...prev, bg: nextBg } : prev));
								}}
								style={{ width: 44, height: 34, padding: 0, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 8 }}
							/>
							<TextInput
								style={{ flex: 1 }}
								value={localDraft.bg}
								onChange={(e) => {
									const nextBg = e.currentTarget.value;
									setLocalDraft((prev) => (prev ? { ...prev, bg: nextBg } : prev));
								}}
								placeholder={t('operationProfiles.groupEditor.backgroundPlaceholder')}
							/>
						</Group>
						<Text size="xs" c="dimmed" style={{ marginTop: 6 }}>
							{t('operationProfiles.groupEditor.backgroundHint')}
						</Text>
					</div>

					<Group justify="space-between" wrap="nowrap" mt="xs">
						<Button
							color="red"
							variant="light"
							onClick={() => {
								if (!window.confirm(t('operationProfiles.confirm.deleteGroup'))) return;
								onDelete(localDraft.groupId);
							}}
						>
							{t('operationProfiles.groupEditor.delete')}
						</Button>

						<Group gap="xs" wrap="nowrap">
							<Button variant="default" onClick={onClose}>
								{t('common.cancel')}
							</Button>
							<Button onClick={() => onSave(localDraft)} disabled={!localDraft.name.trim()}>
								{t('common.save')}
							</Button>
						</Group>
					</Group>
				</Stack>
			)}
		</Modal>
	);
};

