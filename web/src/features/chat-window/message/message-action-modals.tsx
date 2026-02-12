import { Button, Group, Modal, Paper, ScrollArea, Stack, Table, Tabs, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useTranslation } from 'react-i18next';

import {
	$deleteConfirmState,
	$promptInspectorState,
	closeDeleteConfirm,
	closePromptInspectorRequested,
	confirmDeleteAction,
	deleteVariantFx,
	softDeleteEntriesBulkFx,
	softDeleteEntryFx,
	softDeletePartFx,
} from '@model/chat-entry-parts';

function formatTokenShare(value: number, total: number): string {
	if (total <= 0) return '0%';
	return `${((value / total) * 100).toFixed(1)}%`;
}

function buildRawPrompt(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): string {
	return messages.map((item) => `[${item.role.toUpperCase()}]\n${item.content}`).join('\n\n---\n\n');
}

function buildTurnCanonicalizationRaw(
	items: Array<{
		hook: 'before_main_llm' | 'after_main_llm';
		opId: string;
		beforeText: string;
		afterText: string;
		committedAt: string;
	}>,
	labels: {
		before: string;
		after: string;
		hook: string;
		opId: string;
		committedAt: string;
	},
): string {
	return items
		.map((item, idx) =>
			[
				`#${idx + 1}`,
				`${labels.hook}: ${item.hook}`,
				`${labels.opId}: ${item.opId}`,
				`${labels.committedAt}: ${item.committedAt}`,
				`[${labels.before}]`,
				item.beforeText,
				`[${labels.after}]`,
				item.afterText,
			].join('\n'),
		)
		.join('\n\n---\n\n');
}

export const MessageActionModals = () => {
	const { t } = useTranslation();
	const [
		deleteState,
		closeDelete,
		confirmDelete,
		deleteEntryPending,
		deleteVariantPending,
		deletePartPending,
		deleteBulkPending,
		promptInspector,
		closePromptInspector,
	] = useUnit([
		$deleteConfirmState,
		closeDeleteConfirm,
		confirmDeleteAction,
		softDeleteEntryFx.pending,
		deleteVariantFx.pending,
		softDeletePartFx.pending,
		softDeleteEntriesBulkFx.pending,
		$promptInspectorState,
		closePromptInspectorRequested,
	]);

	const deleteBusy =
		deleteState?.kind === 'entry'
			? deleteEntryPending
			: deleteState?.kind === 'variant'
				? deleteVariantPending
				: deleteState?.kind === 'part'
					? deletePartPending
					: deleteState?.kind === 'bulkEntries'
						? deleteBulkPending
						: false;

	const deleteTitle =
		deleteState?.kind === 'entry'
			? t('chat.confirm.deleteMessageTitle')
			: deleteState?.kind === 'variant'
				? t('chat.confirm.deleteVariantTitle')
				: deleteState?.kind === 'part'
					? t('chat.confirm.deletePartTitle')
					: t('chat.confirm.deleteBulkMessagesTitle');
	const deleteBody =
		deleteState?.kind === 'entry'
			? t('chat.confirm.deleteMessageBody')
			: deleteState?.kind === 'variant'
				? t('chat.confirm.deleteVariantBody')
				: deleteState?.kind === 'part'
					? t('chat.confirm.deletePartBody')
					: t('chat.confirm.deleteBulkMessagesBody', { count: deleteState?.kind === 'bulkEntries' ? deleteState.count : 0 });

	const total = promptInspector.data?.prompt.approxTokens.total ?? 0;
	const roleRows = promptInspector.data
		? [
				{
					label: t('chat.promptInspector.roles.system'),
					value: promptInspector.data.prompt.approxTokens.byRole.system,
				},
				{
					label: t('chat.promptInspector.roles.user'),
					value: promptInspector.data.prompt.approxTokens.byRole.user,
				},
				{
					label: t('chat.promptInspector.roles.assistant'),
					value: promptInspector.data.prompt.approxTokens.byRole.assistant,
				},
			]
		: [];
	const sectionRows = promptInspector.data
		? [
				{
					label: t('chat.promptInspector.sections.systemInstruction'),
					value: promptInspector.data.prompt.approxTokens.sections.systemInstruction,
				},
				{
					label: t('chat.promptInspector.sections.chatHistory'),
					value: promptInspector.data.prompt.approxTokens.sections.chatHistory,
				},
				{
					label: t('chat.promptInspector.sections.worldInfoBefore'),
					value: promptInspector.data.prompt.approxTokens.sections.worldInfoBefore,
				},
				{
					label: t('chat.promptInspector.sections.worldInfoAfter'),
					value: promptInspector.data.prompt.approxTokens.sections.worldInfoAfter,
				},
				{
					label: t('chat.promptInspector.sections.worldInfoDepth'),
					value: promptInspector.data.prompt.approxTokens.sections.worldInfoDepth,
				},
				{
					label: t('chat.promptInspector.sections.worldInfoOutlets'),
					value: promptInspector.data.prompt.approxTokens.sections.worldInfoOutlets,
				},
				{
					label: t('chat.promptInspector.sections.worldInfoAN'),
					value: promptInspector.data.prompt.approxTokens.sections.worldInfoAN,
				},
				{
					label: t('chat.promptInspector.sections.worldInfoEM'),
					value: promptInspector.data.prompt.approxTokens.sections.worldInfoEM,
				},
			]
		: [];
	const turnCanonicalizations = promptInspector.data?.turnCanonicalizations ?? [];

	return (
		<>
			{deleteState && (
				<Modal opened onClose={() => closeDelete()} title={deleteTitle} centered closeOnClickOutside={!deleteBusy} closeOnEscape={!deleteBusy}>
					<Stack gap="md">
						<Text size="sm">{deleteBody}</Text>
						<Group justify="flex-end">
							<Button variant="subtle" onClick={() => closeDelete()} disabled={deleteBusy}>
								{t('common.cancel')}
							</Button>
							<Button color="red" onClick={() => confirmDelete()} loading={deleteBusy}>
								{t('common.delete')}
							</Button>
						</Group>
					</Stack>
				</Modal>
			)}

			<Modal
				opened={promptInspector.open}
				onClose={() => closePromptInspector()}
				title={t('chat.promptInspector.title')}
				centered
				size="xl"
			>
				<Stack gap="sm">
					{promptInspector.loading && <Text size="sm">{t('chat.promptInspector.loading')}</Text>}
					{!promptInspector.loading && promptInspector.error && (
						<Text size="sm" c="red">
							{t('chat.promptInspector.error')}: {promptInspector.error}
						</Text>
					)}
					{!promptInspector.loading && !promptInspector.error && promptInspector.data && (
						<>
							<Group justify="space-between" align="flex-start">
								<Stack gap={0}>
									<Text size="sm">
										{t('chat.promptInspector.generationId')}: {promptInspector.data.generationId}
									</Text>
									<Text size="xs" c="dimmed">
										{t('chat.promptInspector.estimator')}: {promptInspector.data.estimator}
									</Text>
								</Stack>
								<Text size="sm">
									{t('chat.promptInspector.totalTokens')}: {promptInspector.data.prompt.approxTokens.total}
								</Text>
							</Group>
							<Tabs defaultValue="tokens">
								<Tabs.List>
									<Tabs.Tab value="tokens">{t('chat.promptInspector.tabs.tokens')}</Tabs.Tab>
									<Tabs.Tab value="raw">{t('chat.promptInspector.tabs.raw')}</Tabs.Tab>
								</Tabs.List>
								<Tabs.Panel value="tokens" pt="sm">
									<Stack gap="sm">
										<Paper withBorder p="sm" radius="md">
											<Text size="sm" fw={600} mb={6}>
												{t('chat.promptInspector.byRole')}
											</Text>
											<Table striped highlightOnHover withTableBorder>
												<Table.Thead>
													<Table.Tr>
														<Table.Th>{t('chat.promptInspector.column.part')}</Table.Th>
														<Table.Th>{t('chat.promptInspector.column.tokens')}</Table.Th>
														<Table.Th>{t('chat.promptInspector.column.share')}</Table.Th>
													</Table.Tr>
												</Table.Thead>
												<Table.Tbody>
													{roleRows.map((row) => (
														<Table.Tr key={row.label}>
															<Table.Td>{row.label}</Table.Td>
															<Table.Td>{row.value}</Table.Td>
															<Table.Td>{formatTokenShare(row.value, total)}</Table.Td>
														</Table.Tr>
													))}
												</Table.Tbody>
											</Table>
										</Paper>
										<Paper withBorder p="sm" radius="md">
											<Text size="sm" fw={600} mb={6}>
												{t('chat.promptInspector.bySections')}
											</Text>
											<Table striped highlightOnHover withTableBorder>
												<Table.Thead>
													<Table.Tr>
														<Table.Th>{t('chat.promptInspector.column.part')}</Table.Th>
														<Table.Th>{t('chat.promptInspector.column.tokens')}</Table.Th>
														<Table.Th>{t('chat.promptInspector.column.share')}</Table.Th>
													</Table.Tr>
												</Table.Thead>
												<Table.Tbody>
													{sectionRows.map((row) => (
														<Table.Tr key={row.label}>
															<Table.Td>{row.label}</Table.Td>
															<Table.Td>{row.value}</Table.Td>
															<Table.Td>{formatTokenShare(row.value, total)}</Table.Td>
														</Table.Tr>
													))}
												</Table.Tbody>
											</Table>
										</Paper>
									</Stack>
								</Tabs.Panel>
								<Tabs.Panel value="raw" pt="sm">
									<Stack gap="sm">
										<Paper withBorder p="sm" radius="md">
											<ScrollArea.Autosize mah={420}>
												<Text
													size="sm"
													style={{
														whiteSpace: 'pre-wrap',
														wordBreak: 'break-word',
														fontFamily:
															'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
													}}
												>
													{buildRawPrompt(promptInspector.data.prompt.messages)}
												</Text>
											</ScrollArea.Autosize>
										</Paper>
										{turnCanonicalizations.length > 0 && (
											<Paper withBorder p="sm" radius="md">
												<Text size="sm" fw={600} mb={6}>
													{t('chat.promptInspector.turnCanonicalization.title')}
												</Text>
												<ScrollArea.Autosize mah={260}>
													<Text
														size="sm"
														style={{
															whiteSpace: 'pre-wrap',
															wordBreak: 'break-word',
															fontFamily:
																'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
														}}
													>
														{buildTurnCanonicalizationRaw(turnCanonicalizations, {
															before: t('chat.promptInspector.turnCanonicalization.before'),
															after: t('chat.promptInspector.turnCanonicalization.after'),
															hook: t('chat.promptInspector.turnCanonicalization.hook'),
															opId: t('chat.promptInspector.turnCanonicalization.opId'),
															committedAt: t('chat.promptInspector.turnCanonicalization.committedAt'),
														})}
													</Text>
												</ScrollArea.Autosize>
											</Paper>
										)}
									</Stack>
								</Tabs.Panel>
							</Tabs>
						</>
					)}
					{!promptInspector.loading && !promptInspector.error && !promptInspector.data && (
						<Text size="sm" c="dimmed">
							{t('chat.promptInspector.empty')}
						</Text>
					)}
				</Stack>
			</Modal>
		</>
	);
};
