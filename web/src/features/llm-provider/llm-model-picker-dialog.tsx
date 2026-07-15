import { ActionIcon, Button, Group, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuRefreshCw, LuSearch } from 'react-icons/lu';

import { Dialog } from '@ui/dialog';

import { filterModels, getModelMetadata, type ModelFilter } from './llm-model-utils';

import type { LlmModel } from '@shared/types/llm';

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	models: LlmModel[];
	selectedModel: string | null;
	isLoading: boolean;
	onRefresh: () => Promise<void>;
	onSelect: (modelId: string) => void;
	showCapabilityFilters?: boolean;
};

const ROW_HEIGHT = 96;

export const LlmModelPickerDialog: React.FC<Props> = ({
	open,
	onOpenChange,
	models,
	selectedModel,
	isLoading,
	onRefresh,
	onSelect,
	showCapabilityFilters = true,
}) => {
	const { t } = useTranslation();
	const [query, setQuery] = useState('');
	const [filter, setFilter] = useState<ModelFilter>('all');
	const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
	const effectiveFilter = showCapabilityFilters ? filter : 'all';
	const filtered = useMemo(() => filterModels(models, query, effectiveFilter), [effectiveFilter, models, query]);
	const exactMatch = models.some((model) => model.id === query.trim());
	const canUseExactId = query.trim().includes('/') && !exactMatch;
	const virtualizer = useVirtualizer({
		count: filtered.length,
		getScrollElement: () => scrollElement,
		estimateSize: () => ROW_HEIGHT,
		overscan: 7,
		getItemKey: (index) => filtered[index]?.id ?? index,
	});

	const selectModel = (modelId: string) => {
		onSelect(modelId);
		onOpenChange(false);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={t('provider.modelPicker.title')}
			size="xl"
			showCloseButton
			closeOnInteractOutside={false}
			footer={
				<Button variant="subtle" onClick={() => onOpenChange(false)}>
					{t('common.close')}
				</Button>
			}
		>
			<Stack gap="sm">
				<Group wrap="nowrap" align="flex-end">
					<TextInput
						label={t('provider.modelPicker.searchLabel')}
						placeholder={t('provider.modelPicker.searchPlaceholder')}
						leftSection={<LuSearch />}
						value={query}
						onChange={(event) => setQuery(event.currentTarget.value)}
						style={{ flex: 1 }}
						autoFocus
					/>
					<ActionIcon
						variant="default"
						size={36}
						loading={isLoading}
						onClick={() => void onRefresh()}
						aria-label={t('provider.modelPicker.refresh')}
					>
						<LuRefreshCw />
					</ActionIcon>
				</Group>

				{showCapabilityFilters ? (
					<Group gap="xs" role="radiogroup">
						{(['all', 'free', 'vision', 'reasoning', 'tools'] as const).map((value) => (
							<Button
								key={value}
								size="compact-sm"
								variant={filter === value ? 'light' : 'subtle'}
								role="radio"
								aria-checked={filter === value}
								onClick={() => setFilter(value)}
							>
								{t(`provider.modelPicker.filters.${value}`)}
							</Button>
						))}
					</Group>
				) : null}

				<Group justify="space-between">
					<Text size="sm" c="dimmed">
						{t('provider.modelPicker.visibleCount', { visible: filtered.length, total: models.length })}
					</Text>
					{canUseExactId ? (
						<Button size="compact-sm" variant="light" onClick={() => selectModel(query.trim())}>
							{t('provider.modelPicker.useExactId')}
						</Button>
					) : null}
				</Group>

				<div ref={setScrollElement} style={{ height: 'min(52vh, 520px)', overflow: 'auto', position: 'relative' }}>
					{filtered.length === 0 ? (
						<Text c="dimmed" ta="center" py="xl">
							{isLoading ? t('provider.modelPicker.loading') : t('provider.modelPicker.empty')}
						</Text>
					) : (
						<div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
							{virtualizer.getVirtualItems().map((item) => {
								const model = filtered[item.index];
								const meta = getModelMetadata(model);
								const metrics = [
									meta.context ? t('provider.modelPicker.context', { value: meta.context }) : null,
									meta.inputPrice ? t('provider.modelPicker.inputPrice', { value: meta.inputPrice }) : null,
									meta.outputPrice ? t('provider.modelPicker.outputPrice', { value: meta.outputPrice }) : null,
								]
									.filter(Boolean)
									.join(' · ');
								const capabilities = [
									meta.vision ? t('provider.modelPicker.filters.vision') : null,
									meta.reasoning ? t('provider.modelPicker.filters.reasoning') : null,
									meta.tools ? t('provider.modelPicker.filters.tools') : null,
								]
									.filter(Boolean)
									.join(' · ');
								return (
									<UnstyledButton
										key={model.id}
										onClick={() => selectModel(model.id)}
										aria-label={model.name}
										style={{
											position: 'absolute',
											top: 0,
											left: 0,
											width: '100%',
											height: item.size,
											transform: `translateY(${item.start}px)`,
											padding: '10px 12px',
											borderBottom: '1px solid var(--mantine-color-default-border)',
											background: selectedModel === model.id ? 'var(--mantine-primary-color-light)' : undefined,
										}}
									>
										<Stack gap={2} style={{ minWidth: 0 }}>
											<Text fw={600} truncate>
												{model.name}
											</Text>
											<Text size="xs" c="dimmed" truncate>
												{model.id}
											</Text>
											{metrics ? <Text size="xs">{metrics}</Text> : null}
											{capabilities ? (
												<Text size="xs" c="dimmed">
													{capabilities}
												</Text>
											) : null}
										</Stack>
									</UnstyledButton>
								);
							})}
						</div>
					)}
				</div>
			</Stack>
		</Dialog>
	);
};
