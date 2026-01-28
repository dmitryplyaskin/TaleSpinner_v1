import { Button, Group, Stack, Text } from '@mantine/core';
import React from 'react';
import { LuLayoutDashboard, LuSave, LuX } from 'react-icons/lu';

type Props = {
	profileName: string;
	isDirty: boolean;
	onAutoLayout: () => void;
	onSave: () => void;
	onClose: () => void;
};

export const NodeEditorHeader: React.FC<Props> = ({ profileName, isDirty, onAutoLayout, onSave, onClose }) => {
	return (
		<Group justify="space-between" wrap="nowrap">
			<Stack gap={2}>
				<Text fw={800} size="lg">
					Node editor — {profileName}
				</Text>
				<Text size="sm" c="dimmed">
					Ноды — операции, связи — dependsOn. Клик по ноде открывает редактор справа.
				</Text>
			</Stack>

			<Group gap="xs" wrap="nowrap">
				<Button variant="light" leftSection={<LuLayoutDashboard />} onClick={onAutoLayout}>
					Auto layout
				</Button>
				<Button leftSection={<LuSave />} disabled={!isDirty} onClick={onSave}>
					Save
				</Button>
				<Button variant="default" leftSection={<LuX />} onClick={onClose}>
					Close
				</Button>
			</Group>
		</Group>
	);
};

