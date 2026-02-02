import { Group, Paper, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useMemo } from 'react';
import { LuArrowLeft, LuArrowRight } from 'react-icons/lu';

import type { ChatEntryWithVariantDto } from '../../../api/chat-entry-parts';
import { $variantsByEntryId, loadVariantsFx, regenerateRequested, selectVariantRequested } from '@model/chat-entry-parts';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

type Props = {
	entry: ChatEntryWithVariantDto;
	isLast: boolean;
};

function pickActiveIndex(variants: Array<{ variantId: string }>, activeVariantId: string): number {
	if (variants.length === 0) return -1;
	const idx = variants.findIndex((v) => v.variantId === activeVariantId);
	return idx >= 0 ? idx : variants.length - 1;
}

export const VariantControls: React.FC<Props> = ({ entry, isLast }) => {
	const variantsById = useUnit($variantsByEntryId);
	const variants = variantsById[entry.entry.entryId] ?? [];

	const isImportedFirstMessage =
		entry.variant?.kind === 'import' &&
		typeof entry.entry.meta === 'object' &&
		entry.entry.meta !== null &&
		Boolean((entry.entry.meta as any)?.imported) &&
		((entry.entry.meta as any)?.kind === 'first_mes' || (entry.entry.meta as any)?.source === 'entity_profile_import');

	useEffect(() => {
		if (!isLast) return;
		if (entry.entry.role !== 'assistant') return;
		if (variants.length > 0) return;
		// Best-effort: ensure we have variants loaded for swipe UI.
		void loadVariantsFx({ entryId: entry.entry.entryId });
	}, [isLast, entry.entry.entryId, entry.entry.role, variants.length]);

	// Hooks must be called unconditionally (React rules of hooks).
	const currentIndex = useMemo(
		() => pickActiveIndex(variants, entry.entry.activeVariantId),
		[variants, entry.entry.activeVariantId],
	);
	const total = variants.length;
	const shouldShow = isLast && entry.entry.role === 'assistant';
	if (!shouldShow) return null;

	const isFirst = currentIndex <= 0;
	const isLastVariant = total === 0 ? true : currentIndex === total - 1;

	const handleLeft = () => {
		if (total === 0) return;
		if (isFirst) return;
		const next = variants[currentIndex - 1];
		if (next) selectVariantRequested({ entryId: entry.entry.entryId, variantId: next.variantId });
	};

	const handleRight = () => {
		if (total === 0) {
			// Variants are loaded lazily. Do not treat "no variants loaded" as regenerate.
			void loadVariantsFx({ entryId: entry.entry.entryId });
			return;
		}

		if (!isLastVariant) {
			const next = variants[currentIndex + 1];
			if (next) selectVariantRequested({ entryId: entry.entry.entryId, variantId: next.variantId });
			return;
		}

		if (isImportedFirstMessage) return;
		regenerateRequested({ entryId: entry.entry.entryId });
	};

	const rightDisabled = total === 0 ? true : isImportedFirstMessage ? isLastVariant : false;

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
					disabled={rightDisabled}
					tooltip={
						total === 0
							? 'Loading…'
							: isImportedFirstMessage && isLastVariant
								? 'Regenerate is disabled for imported greeting'
								: isLastVariant
									? 'Regenerate'
									: 'Next variant'
					}
					onClick={handleRight}
				/>
			</Group>
		</Paper>
	);
};
