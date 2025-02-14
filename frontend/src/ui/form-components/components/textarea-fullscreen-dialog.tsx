import { Button, Tabs } from '@chakra-ui/react';
import {
	DialogActionTrigger,
	DialogBody,
	DialogCloseTrigger,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogRoot,
	DialogTitle,
} from '@ui/chakra-core-ui/dialog';
import { Textarea, TextareaProps } from '@chakra-ui/react';

import { RenderMd } from '@ui/render-md';

interface TextareaFullscreenDialogProps {
	isOpen: boolean;
	onModalChange: (open: boolean) => void;
	value: string;
	onChange: (value: string) => void;
	textareaProps?: TextareaProps;
}

export const TextareaFullscreenDialog: React.FC<TextareaFullscreenDialogProps> = ({
	isOpen,
	onModalChange,
	value,
	onChange,
	textareaProps,
}) => {
	return (
		<DialogRoot open={isOpen} onOpenChange={(x) => onModalChange(x.open)} size="full">
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Редактирование</DialogTitle>
				</DialogHeader>

				<DialogBody>
					<Tabs.Root defaultValue="edit" variant="plain" size="sm" h="calc(100vh - 210px)">
						<Tabs.List bg="bg.muted" rounded="l3" p="1">
							<Tabs.Trigger value="edit">Редактировать</Tabs.Trigger>
							<Tabs.Trigger value="preview">Предпросмотр</Tabs.Trigger>
							<Tabs.Indicator rounded="l2" />
						</Tabs.List>

						<Tabs.Content value="edit" pt="4" h="100%">
							<Textarea
								value={value}
								onChange={(e) => onChange(e.target.value)}
								h="100%"
								minH="calc(100vh - 300px)"
								{...textareaProps}
							/>
						</Tabs.Content>

						<Tabs.Content value="preview" pt="4">
							<RenderMd content={value} />
						</Tabs.Content>
					</Tabs.Root>
				</DialogBody>

				<DialogFooter>
					<DialogActionTrigger asChild>
						<Button>Закрыть</Button>
					</DialogActionTrigger>
				</DialogFooter>
				<DialogCloseTrigger />
			</DialogContent>
		</DialogRoot>
	);
};
