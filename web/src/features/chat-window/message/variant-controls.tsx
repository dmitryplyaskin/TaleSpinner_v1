import { Group, Paper, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useMemo } from 'react';
import { LuArrowLeft, LuArrowRight } from 'react-icons/lu';

import type { ChatMessageDto, MessageVariantDto } from '../../../api/chat-core';
import { $variantsByMessageId, loadVariantsFx, regenerateVariantRequested, selectVariantRequested } from '@model/chat-core';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

type Props = {
	message: ChatMessageDto;
	isLast: boolean;
};

function pickActiveIndex(variants: MessageVariantDto[], activeVariantId: string | null): number {
	if (variants.length === 0) return -1;
	if (activeVariantId) {
		const idx = variants.findIndex((v) => v.id === activeVariantId);
		if (idx >= 0) return idx;
	}
	const selectedIdx = variants.findIndex((v) => v.isSelected);
	return selectedIdx >= 0 ? selectedIdx : 0;
}

export const VariantControls: React.FC<Props> = ({ message, isLast }) => {
	const variantsById = useUnit($variantsByMessageId);
	const variants = variantsById[message.id] ?? [];

	useEffect(() => {
		if (!isLast) return;
		if (message.role !== 'assistant') return;
		if (variants.length > 0) return;
		// Best-effort: ensure we have variants loaded for swipe UI.
		void loadVariantsFx({ messageId: message.id });
	}, [isLast, message.id, message.role, variants.length]);

	if (!isLast || message.role !== 'assistant') {
		return null;
	}

	const currentIndex = useMemo(() => pickActiveIndex(variants, message.activeVariantId), [variants, message.activeVariantId]);
	const total = variants.length;

	const isFirst = currentIndex <= 0;
	const isLastVariant = total === 0 ? true : currentIndex === total - 1;

	const handleLeft = () => {
		if (total === 0) return;
		if (isFirst) return;
		const next = variants[currentIndex - 1];
		if (next) selectVariantRequested({ messageId: message.id, variantId: next.id });
	};

	const handleRight = () => {
		if (total === 0) {
			// If not loaded yet (or variants disabled), treat as regenerate.
			regenerateVariantRequested({ messageId: message.id });
			return;
		}

		if (!isLastVariant) {
			const next = variants[currentIndex + 1];
			if (next) selectVariantRequested({ messageId: message.id, variantId: next.id });
			return;
		}

		regenerateVariantRequested({ messageId: message.id });
	};

	return (
		<Paper
			withBorder
			radius="md"
			p={6}
			style={{
				marginLeft: 'auto',
				borderColor: 'var(--mantine-color-gray-3)',
				backgroundColor: 'white',
			}}
		>
			<Group gap="xs" align="center">
				<IconButtonWithTooltip
					size="xs"
					variant="ghost"
					colorPalette="violet"
					disabled={total > 0 ? isFirst : true}
					icon={<LuArrowLeft />}
					tooltip="Previous variant"
					onClick={handleLeft}
				/>

				<Text size="xs" c="dimmed">
					{total === 0 ? '—' : `${currentIndex + 1} / ${total}`}
				</Text>

				<IconButtonWithTooltip
					size="xs"
					variant="ghost"
					colorPalette="violet"
					icon={<LuArrowRight />}
					tooltip={isLastVariant ? 'Regenerate' : 'Next variant'}
					onClick={handleRight}
				/>
			</Group>
		</Paper>
	);
};

