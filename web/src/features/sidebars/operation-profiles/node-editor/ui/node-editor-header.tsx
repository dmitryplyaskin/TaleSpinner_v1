import { Badge, Button, Group, Stack, Text } from '@mantine/core';
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
		<Group justify="space-between" wrap="wrap" className="opNodeHeader">
			<Stack gap={2}>
				<Group gap="xs" wrap="wrap">
					<Text fw={800} size="lg">
						Node Editor
					</Text>
					<Badge variant="light">{profileName}</Badge>
					{isDirty && <Badge color="yellow">Unsaved</Badge>}
				</Group>
				<Text size="sm" c="dimmed">
					Nodes represent operations. Edges represent dependsOn links. Select a node to edit details.
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
