import { ActionIcon, Box, Flex, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';

export type ChatAvatarPreview = {
	src: string;
	name: string;
	kind: 'user' | 'assistant';
};

type AvatarPreviewPanelProps = {
	preview: ChatAvatarPreview | null;
	onClose: () => void;
};

export const AvatarPreviewPanel: React.FC<AvatarPreviewPanelProps> = ({ preview, onClose }) => {
	const { t } = useTranslation();

	if (!preview) return null;

	return (
		<Box className="ts-chat-avatar-preview" data-kind={preview.kind}>
			<Flex align="center" justify="space-between" gap="sm" className="ts-chat-avatar-preview__header">
				<Box style={{ minWidth: 0 }}>
					<Text fw={700} truncate>
						{t('chat.avatarPreview.title')}
					</Text>
					<Text size="sm" c="dimmed" truncate>
						{preview.name}
					</Text>
				</Box>
				<ActionIcon
					variant="subtle"
					color="gray"
					onClick={onClose}
					aria-label={t('chat.avatarPreview.close')}
					title={t('chat.avatarPreview.close')}
				>
					<LuX />
				</ActionIcon>
			</Flex>

			<Box className="ts-chat-avatar-preview__image-wrap">
				<img src={preview.src} alt={preview.name} className="ts-chat-avatar-preview__image" />
			</Box>
		</Box>
	);
};
