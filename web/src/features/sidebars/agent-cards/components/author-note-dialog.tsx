import { Button, Tabs } from '@chakra-ui/react';
import { LuInfo } from 'react-icons/lu';

import { Avatar } from '@ui/chakra-core-ui/avatar';
import {
	DialogActionTrigger,
	DialogBody,
	DialogCloseTrigger,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogRoot,
	DialogTitle,
	DialogTrigger,
} from '@ui/chakra-core-ui/dialog';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { RenderMd } from '@ui/render-md';

export const AuthorNoteDialog = ({ note, name, avatar }: { note?: string; name: string; avatar?: string }) => {
	if (!note) return null;

	return (
		<DialogRoot size={'lg'} scrollBehavior="inside">
			<DialogTrigger asChild>
				<IconButtonWithTooltip
					aria-label="Показать заметку автора"
					variant="ghost"
					size="sm"
					tooltip="Показать заметку автора"
					icon={<LuInfo />}
				/>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle display="flex" gap="2" alignItems="center">
						{avatar && <Avatar size="lg" src={`http://localhost:5000${avatar}`} name={name} alignSelf="flex-start" />}
						{name}
					</DialogTitle>
				</DialogHeader>

				<DialogBody>
					<Tabs.Root defaultValue="markdown" variant="plain" size="sm">
						<Tabs.List bg="bg.muted" rounded="l3" p="1">
							<Tabs.Trigger value="markdown">Markdown</Tabs.Trigger>

							<Tabs.Trigger value="raw">Raw</Tabs.Trigger>
							<Tabs.Indicator rounded="l2" />
						</Tabs.List>
						<Tabs.Content value="markdown">
							<RenderMd content={note} />
						</Tabs.Content>

						<Tabs.Content value="raw">{note}</Tabs.Content>
					</Tabs.Root>
				</DialogBody>
				<DialogFooter>
					<DialogActionTrigger asChild>
						<Button variant="outline">Close</Button>
					</DialogActionTrigger>
				</DialogFooter>
				<DialogCloseTrigger />
			</DialogContent>
		</DialogRoot>
	);
};
