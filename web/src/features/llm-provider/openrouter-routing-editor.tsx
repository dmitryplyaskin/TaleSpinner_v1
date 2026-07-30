import { ActionIcon, Button, Group, MultiSelect, Select, Stack, Switch, Text } from '@mantine/core';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ArrowDownIcon, ArrowUpIcon, XIcon } from '@ui/icons';

import { LlmDisclosureSection } from './llm-disclosure-section';
import { formatContextLength, formatPricePerMillion } from './llm-model-utils';

import type { LlmOpenRouterEndpoint, LlmOpenRouterRoutingConfig } from '@shared/types/llm';

type Props = {
	modelId: string | null;
	value?: LlmOpenRouterRoutingConfig;
	endpoints: LlmOpenRouterEndpoint[];
	isLoading: boolean;
	onReload: () => Promise<void>;
	onChange: (value: LlmOpenRouterRoutingConfig) => void;
};

const DEFAULT_ROUTING: LlmOpenRouterRoutingConfig = { strategy: 'auto', allowFallbacks: true };

export const OpenRouterRoutingEditor: React.FC<Props> = ({
	modelId,
	value,
	endpoints,
	isLoading,
	onReload,
	onChange,
}) => {
	const { t } = useTranslation();
	const routing = value ?? DEFAULT_ROUTING;
	const providerOrder = routing.providerOrder ?? [];
	const endpointByTag = useMemo(() => new Map(endpoints.map((endpoint) => [endpoint.tag, endpoint])), [endpoints]);
	const endpointOptions = useMemo(
		() => endpoints.map((endpoint) => ({ value: endpoint.tag, label: `${endpoint.providerName} · ${endpoint.tag}` })),
		[endpoints],
	);
	const requiresProviders = routing.strategy === 'priority' || routing.strategy === 'only';

	const patch = (next: Partial<LlmOpenRouterRoutingConfig>) => onChange({ ...routing, ...next });
	const move = (index: number, direction: -1 | 1) => {
		const target = index + direction;
		if (target < 0 || target >= providerOrder.length) return;
		const next = [...providerOrder];
		[next[index], next[target]] = [next[target], next[index]];
		patch({ providerOrder: next });
	};

	return (
		<Stack gap="sm">
			<Text fw={650}>{t('provider.routing.title')}</Text>

			<Select
				label={t('provider.routing.strategy')}
				value={routing.strategy}
				onChange={(strategy) => patch({ strategy: (strategy ?? 'auto') as LlmOpenRouterRoutingConfig['strategy'] })}
				allowDeselect={false}
				data={[
					{ value: 'auto', label: t('provider.routing.strategies.auto') },
					{ value: 'price', label: t('provider.routing.strategies.price') },
					{ value: 'latency', label: t('provider.routing.strategies.latency') },
					{ value: 'throughput', label: t('provider.routing.strategies.throughput') },
					{ value: 'priority', label: t('provider.routing.strategies.priority') },
					{ value: 'only', label: t('provider.routing.strategies.only') },
				]}
				comboboxProps={{ withinPortal: false }}
			/>

			{requiresProviders ? (
				<Stack gap="xs">
					<Group justify="space-between" align="flex-end">
						<Text size="sm" fw={600}>
							{t('provider.routing.providers')}
						</Text>
						<Button
							size="compact-sm"
							variant="subtle"
							loading={isLoading}
							disabled={!modelId}
							onClick={() => void onReload()}
						>
							{t('provider.routing.refreshProviders')}
						</Button>
					</Group>
					<MultiSelect
						data={endpointOptions}
						value={providerOrder}
						onChange={(providerOrderValue) => patch({ providerOrder: providerOrderValue })}
						placeholder={modelId ? t('provider.routing.providerPlaceholder') : t('provider.routing.selectModelFirst')}
						disabled={!modelId}
						searchable
						comboboxProps={{ withinPortal: false }}
						error={providerOrder.length === 0 ? t('provider.routing.providerRequired') : undefined}
					/>

					{providerOrder.length > 0 ? (
						<Stack gap={0}>
							{providerOrder.map((tag, index) => {
								const endpoint = endpointByTag.get(tag);
								const meta = [
									formatContextLength(endpoint?.contextLength),
									formatPricePerMillion(endpoint?.pricing?.prompt),
									endpoint?.uptimeLast30m ? `${endpoint.uptimeLast30m.toFixed(1)}%` : null,
								]
									.filter(Boolean)
									.join(' · ');
								return (
									<Group
										key={tag}
										justify="space-between"
										wrap="nowrap"
										py="xs"
										style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
									>
										<Stack gap={0} style={{ minWidth: 0 }}>
											<Text size="sm" fw={600} truncate>
												{endpoint?.providerName ?? tag}
											</Text>
											<Text size="xs" c="dimmed" truncate>
												{tag}
												{meta ? ` · ${meta}` : ''}
											</Text>
										</Stack>
										<Group gap={2} wrap="nowrap">
											<ActionIcon
												variant="subtle"
												disabled={index === 0}
												onClick={() => move(index, -1)}
												aria-label={t('provider.routing.moveUp')}
											>
												<ArrowUpIcon />
											</ActionIcon>
											<ActionIcon
												variant="subtle"
												disabled={index === providerOrder.length - 1}
												onClick={() => move(index, 1)}
												aria-label={t('provider.routing.moveDown')}
											>
												<ArrowDownIcon />
											</ActionIcon>
											<ActionIcon
												variant="subtle"
												color="red"
												onClick={() => patch({ providerOrder: providerOrder.filter((item) => item !== tag) })}
												aria-label={t('common.delete')}
											>
												<XIcon />
											</ActionIcon>
										</Group>
									</Group>
								);
							})}
						</Stack>
					) : null}
				</Stack>
			) : null}

			<Switch
				checked={routing.allowFallbacks !== false}
				onChange={(event) => patch({ allowFallbacks: event.currentTarget.checked })}
				label={t('provider.routing.allowFallbacks')}
			/>

			<LlmDisclosureSection title={t('provider.routing.privacyTitle')}>
				<Switch
					checked={routing.zdr === true}
					onChange={(event) => patch({ zdr: event.currentTarget.checked })}
					label={t('provider.routing.zdr')}
				/>
				<Switch
					checked={routing.requireParameters === true}
					onChange={(event) => patch({ requireParameters: event.currentTarget.checked })}
					label={t('provider.routing.requireParameters')}
				/>
				<Select
					label={t('provider.routing.dataCollection')}
					value={routing.dataCollection ?? 'allow'}
					onChange={(dataCollection) => patch({ dataCollection: dataCollection === 'deny' ? 'deny' : 'allow' })}
					allowDeselect={false}
					data={[
						{ value: 'allow', label: t('provider.routing.dataCollectionAllow') },
						{ value: 'deny', label: t('provider.routing.dataCollectionDeny') },
					]}
					comboboxProps={{ withinPortal: false }}
				/>
			</LlmDisclosureSection>
		</Stack>
	);
};
