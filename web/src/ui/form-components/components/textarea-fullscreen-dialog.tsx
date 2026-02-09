import { Button, Tabs, Textarea, type TextareaProps } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { Dialog } from '@ui/dialog';
import { RenderMd } from '@ui/render-md';
import { Z_INDEX } from '@ui/z-index';

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
			zIndex={Z_INDEX.overlay.textareaModal}
			fullScreenContentMaxWidth={1440}
			fillBodyHeight
			footer={
				<Button variant="subtle" onClick={() => onOpenChange(false)}>
					{t('common.close')}
				</Button>
			}
		>
			<Tabs
				defaultValue="edit"
				variant="outline"
				style={{
					display: 'flex',
					flexDirection: 'column',
					flex: 1,
					minHeight: 0,
				}}
			>
				<Tabs.List style={{ flexShrink: 0 }}>
					<Tabs.Tab value="edit">{t('dialogs.textarea.tabs.edit')}</Tabs.Tab>
					<Tabs.Tab value="preview">{t('dialogs.textarea.tabs.preview')}</Tabs.Tab>
				</Tabs.List>

				<Tabs.Panel value="edit" pt="md" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
					<div style={{ height: '100%', minHeight: 0, display: 'flex' }}>
						<Textarea
							{...textareaProps}
							value={value}
							onChange={(e) => onChange(e.currentTarget.value)}
							autosize={false}
							style={{ height: '100%', flex: 1 }}
							styles={{
								root: { height: '100%', flex: 1 },
								wrapper: { height: '100%', flex: 1 },
								input: {
									height: '100%',
									minHeight: '100%',
									resize: 'none',
									overflowY: 'auto',
								},
							}}
						/>
					</div>
				</Tabs.Panel>

				<Tabs.Panel value="preview" pt="md" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
					<div style={{ height: '100%', overflowY: 'auto' }}>
						<RenderMd content={value} />
					</div>
				</Tabs.Panel>
			</Tabs>
		</Dialog>
	);
};
