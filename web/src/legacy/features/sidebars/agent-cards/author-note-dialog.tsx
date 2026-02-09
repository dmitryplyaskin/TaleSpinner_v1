import { Avatar, Button, Group, Modal, Tabs } from '@mantine/core';
import { useState } from 'react';
import { LuInfo } from 'react-icons/lu';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { RenderMd } from '@ui/render-md';
import { Z_INDEX } from '@ui/z-index';

export const AuthorNoteDialog = ({ note, name, avatar }: { note?: string; name: string; avatar?: string }) => {
	const [opened, setOpened] = useState(false);
	if (!note) return null;

	return (
		<>
			<IconButtonWithTooltip
				aria-label="Показать заметку автора"
				variant="ghost"
				size="sm"
				tooltip="Показать заметку автора"
				icon={<LuInfo />}
				onClick={() => setOpened(true)}
			/>

			<Modal
				opened={opened}
				onClose={() => setOpened(false)}
				title={
					<Group gap="sm" wrap="nowrap">
						{avatar && <Avatar size="md" src={`http://localhost:5000${avatar}`} name={name} />}
						<span>{name}</span>
					</Group>
				}
				size="lg"
				zIndex={Z_INDEX.overlay.modal}
				withinPortal
			>
				<Tabs defaultValue="markdown" variant="outline">
					<Tabs.List mb="md">
						<Tabs.Tab value="markdown">Markdown</Tabs.Tab>
						<Tabs.Tab value="raw">Raw</Tabs.Tab>
					</Tabs.List>
					<Tabs.Panel value="markdown">
						<RenderMd content={note} />
					</Tabs.Panel>
					<Tabs.Panel value="raw">{note}</Tabs.Panel>
				</Tabs>

				<Group justify="flex-end" mt="md">
					<Button variant="outline" onClick={() => setOpened(false)}>
						Close
					</Button>
				</Group>
			</Modal>
		</>
	);
};

