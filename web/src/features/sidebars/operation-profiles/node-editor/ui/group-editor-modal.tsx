import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import React, { useMemo } from 'react';

import { DEFAULT_GROUP_COLOR_HEX, normalizeCssColorToHex } from '../utils/color';

export type GroupEditorDraft = { groupId: string; name: string; bg: string };

type Props = {
	draft: GroupEditorDraft | null;
	onClose: () => void;
	onChange: (next: GroupEditorDraft) => void;
	onDelete: (groupId: string) => void;
	onSave: (draft: GroupEditorDraft) => void;
};

export const GroupEditorModal: React.FC<Props> = ({ draft, onClose, onChange, onDelete, onSave }) => {
	const opened = Boolean(draft);
	const hexValue = useMemo(() => {
		if (!draft) return DEFAULT_GROUP_COLOR_HEX;
		return normalizeCssColorToHex(draft.bg?.trim() ? draft.bg : DEFAULT_GROUP_COLOR_HEX, DEFAULT_GROUP_COLOR_HEX);
	}, [draft]);

	return (
		<Modal opened={opened} onClose={onClose} title="Edit group" centered zIndex={5000}>
			{draft && (
				<Stack gap="sm">
					<TextInput
						label="Name"
						value={draft.name}
						onChange={(e) => onChange({ ...draft, name: e.currentTarget.value })}
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
								onChange={(e) => onChange({ ...draft, bg: e.currentTarget.value })}
								style={{ width: 44, height: 34, padding: 0, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 8 }}
							/>
							<TextInput
								style={{ flex: 1 }}
								value={draft.bg}
								onChange={(e) => onChange({ ...draft, bg: e.currentTarget.value })}
								placeholder="CSS color (alpha will be ignored)"
							/>
						</Group>
						<Text size="xs" c="dimmed" style={{ marginTop: 6 }}>
							Transparency is fixed to match default groups; your input controls only the base color.
						</Text>
					</div>

					<Group justify="space-between" wrap="nowrap" mt="xs">
						<Button color="red" variant="light" onClick={() => onDelete(draft.groupId)}>
							Delete group
						</Button>

						<Group gap="xs" wrap="nowrap">
							<Button variant="default" onClick={onClose}>
								Cancel
							</Button>
							<Button onClick={() => onSave(draft)} disabled={!draft.name.trim()}>
								Save
							</Button>
						</Group>
					</Group>
				</Stack>
			)}
		</Modal>
	);
};

