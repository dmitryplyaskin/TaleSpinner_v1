import { Button, Tabs, Textarea, type TextareaProps } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { Dialog } from '@ui/dialog';
import { RenderMd } from '@ui/render-md';

interface TextareaFullscreenDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	value: string;
	onChange: (value: string) => void;
	textareaProps?: TextareaProps;
}

export const TextareaFullscreenDialog: React.FC<TextareaFullscreenDialogProps> = ({
	open,
	onOpenChange,
	value,
	onChange,
	textareaProps,
}) => {
	const { t } = useTranslation();
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={t('dialogs.textarea.title')}
			size="cover"
			footer={
				<Button variant="subtle" onClick={() => onOpenChange(false)}>
					{t('common.close')}
				</Button>
			}
		>
			<Tabs defaultValue="edit" variant="outline">
				<Tabs.List>
					<Tabs.Tab value="edit">{t('dialogs.textarea.tabs.edit')}</Tabs.Tab>
					<Tabs.Tab value="preview">{t('dialogs.textarea.tabs.preview')}</Tabs.Tab>
				</Tabs.List>

				<Tabs.Panel value="edit" pt="md">
					<Textarea
						value={value}
						onChange={(e) => onChange(e.currentTarget.value)}
						minRows={10}
						autosize
						{...textareaProps}
					/>
				</Tabs.Panel>

				<Tabs.Panel value="preview" pt="md">
					<RenderMd content={value} />
				</Tabs.Panel>
			</Tabs>
		</Dialog>
	);
};
