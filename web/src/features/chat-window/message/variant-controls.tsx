import { Group, Paper, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuArrowLeft, LuArrowRight } from 'react-icons/lu';

import { $variantsByEntryId, $variantsLoadingByEntryId, loadVariantsRequested, regenerateRequested, selectVariantRequested } from '@model/chat-entry-parts';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import type { ChatEntryWithVariantDto } from '../../../api/chat-entry-parts';

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
	const { t } = useTranslation();
	const variantsById = useUnit($variantsByEntryId);
	const variantsLoadingById = useUnit($variantsLoadingByEntryId);
	const variants = useMemo(() => variantsById[entry.entry.entryId] ?? [], [variantsById, entry.entry.entryId]);
	const isLoading = Boolean(variantsLoadingById[entry.entry.entryId]);

	const isImportedFirstMessage =
		entry.variant?.kind === 'import' &&
		typeof entry.entry.meta === 'object' &&
		entry.entry.meta !== null &&
		Boolean((entry.entry.meta as any)?.imported) &&
		((entry.entry.meta as any)?.kind === 'first_mes' || (entry.entry.meta as any)?.source === 'entity_profile_import');

	useEffect(() => {
		if (entry.entry.role !== 'assistant') return;
		if (!isLast) return;
		if (variants.length > 0) return;
		if (isLoading) return;
		loadVariantsRequested({ entryId: entry.entry.entryId });
	}, [isLast, entry.entry.entryId, entry.entry.role, isLoading, variants.length]);

	const currentIndex = useMemo(
		() => pickActiveIndex(variants, entry.entry.activeVariantId),
		[variants, entry.entry.activeVariantId],
	);
	const total = variants.length;
	const fallbackTotal = entry.variant ? 1 : 0;
	const activeIndexInList = useMemo(
		() => variants.findIndex((v) => v.variantId === entry.entry.activeVariantId),
		[variants, entry.entry.activeVariantId],
	);
	const hasActiveOutsideList =
		total > 0 && activeIndexInList < 0 && Boolean(entry.variant && entry.variant.variantId === entry.entry.activeVariantId);
	const displayTotal = hasActiveOutsideList ? total + 1 : total > 0 ? total : fallbackTotal;
	const displayCurrent = hasActiveOutsideList ? total + 1 : total > 0 ? currentIndex + 1 : fallbackTotal > 0 ? 1 : 0;
	const shouldShow = entry.entry.role === 'assistant' && isLast;
	if (!shouldShow) return null;

	const isFirst = currentIndex <= 0;
	const isLastVariant = total === 0 ? true : hasActiveOutsideList ? true : currentIndex === total - 1;

	const handleLeft = () => {
		if (total === 0) return;
		if (hasActiveOutsideList) {
			const prev = variants[total - 1];
			if (prev) selectVariantRequested({ entryId: entry.entry.entryId, variantId: prev.variantId });
			return;
		}
		if (isFirst) return;
		const next = variants[currentIndex - 1];
		if (next) selectVariantRequested({ entryId: entry.entry.entryId, variantId: next.variantId });
	};

	const handleRight = () => {
		if (total === 0) {
			if (isLoading) return;
			loadVariantsRequested({ entryId: entry.entry.entryId });
			return;
		}

		if (hasActiveOutsideList) {
			if (isImportedFirstMessage) return;
			regenerateRequested({ entryId: entry.entry.entryId });
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

	const rightDisabled = total === 0 ? isLoading : isImportedFirstMessage ? isLastVariant : false;
	const leftDisabled = total > 0 ? (!hasActiveOutsideList && isFirst) : true;
	return (
		<Paper withBorder radius="md" p={6} style={{ marginLeft: 'auto', borderColor: 'var(--ts-border-soft)', backgroundColor: 'var(--ts-surface-elevated)' }}>
			<Group gap="xs" align="center">
				<IconButtonWithTooltip
					size="xs"
					variant="ghost"
					colorPalette="cyan"
					disabled={leftDisabled}
					icon={<LuArrowLeft />}
					tooltip={t('chat.variants.previous')}
					onClick={handleLeft}
				/>

				<Text size="xs" c="dimmed">
					{displayTotal === 0 ? '—' : `${displayCurrent} / ${displayTotal}`}
				</Text>

				<IconButtonWithTooltip
					size="xs"
					variant="ghost"
					colorPalette="cyan"
					icon={<LuArrowRight />}
					disabled={rightDisabled}
					tooltip={
						total === 0
							? isLoading
								? t('chat.variants.loading')
								: t('chat.variants.next')
							: isImportedFirstMessage && isLastVariant
								? t('chat.variants.regenerateBlocked')
								: isLastVariant
									? t('chat.variants.regenerate')
									: t('chat.variants.next')
					}
					onClick={handleRight}
				/>
			</Group>
		</Paper>
	);
};
