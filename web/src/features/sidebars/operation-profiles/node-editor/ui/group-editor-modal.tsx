import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import React, { useEffect, useMemo, useState } from 'react';

import { DEFAULT_GROUP_COLOR_HEX, normalizeCssColorToHex } from '../utils/color';

export type GroupEditorDraft = { groupId: string; name: string; bg: string };

type Props = {
	draft: GroupEditorDraft | null;
	onClose: () => void;
	onDelete: (groupId: string) => void;
	onSave: (draft: GroupEditorDraft) => void;
};

export const GroupEditorModal: React.FC<Props> = ({ draft, onClose, onDelete, onSave }) => {
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
		<Modal opened={opened} onClose={onClose} title="Edit group" centered zIndex={5000}>
			{localDraft && (
				<Stack gap="sm">
					<TextInput
						label="Name"
						value={localDraft.name}
						onChange={(e) => {
							const nextName = e.currentTarget.value;
							setLocalDraft((prev) => (prev ? { ...prev, name: nextName } : prev));
						}}
						placeholder="Group name"
						autoFocus
					/>

					<div>
						<Text size="sm" fw={600} style={{ marginBottom: 6 }}>
							Background
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
								placeholder="CSS color (alpha will be ignored)"
							/>
						</Group>
						<Text size="xs" c="dimmed" style={{ marginTop: 6 }}>
							Transparency is fixed to match default groups; your input controls only the base color.
						</Text>
					</div>

					<Group justify="space-between" wrap="nowrap" mt="xs">
						<Button
							color="red"
							variant="light"
							onClick={() => {
								if (!window.confirm('Delete this group?')) return;
								onDelete(localDraft.groupId);
							}}
						>
							Delete group
						</Button>

						<Group gap="xs" wrap="nowrap">
							<Button variant="default" onClick={onClose}>
								Cancel
							</Button>
							<Button onClick={() => onSave(localDraft)} disabled={!localDraft.name.trim()}>
								Save
							</Button>
						</Group>
					</Group>
				</Stack>
			)}
		</Modal>
	);
};

