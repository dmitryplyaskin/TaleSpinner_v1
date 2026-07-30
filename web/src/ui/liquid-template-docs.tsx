import { Button, Group, Paper, Stack, Text, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FileTextIcon } from '@ui/icons';

import { Dialog } from './dialog';
import { IconButtonWithTooltip } from './icon-button-with-tooltip';
import { LIQUID_DOCS_BY_CONTEXT, type LiquidDocsContextId } from './liquid-template-docs-config';
import { Z_INDEX } from './z-index';

export type { LiquidDocsContextId } from './liquid-template-docs-config';

function matchesSearch(haystack: string, query: string): boolean {
	return haystack.toLocaleLowerCase().includes(query);
}

type LiquidDocsDialogProps = {
	context: LiquidDocsContextId;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export const LiquidDocsDialog: React.FC<LiquidDocsDialogProps> = ({ context, open, onOpenChange }) => {
	const { t } = useTranslation();
	const [search, setSearch] = useState('');

	useEffect(() => {
		if (!open) setSearch('');
	}, [open]);

	const model = LIQUID_DOCS_BY_CONTEXT[context];
	if (!model) return null;

	const normalizedQuery = search.trim().toLocaleLowerCase();
	const filteredVariables =
		normalizedQuery.length === 0
			? model.variables
			: model.variables.filter(
					(item) =>
						matchesSearch(item.token, normalizedQuery) ||
						matchesSearch(t(item.descriptionKey), normalizedQuery)
			  );
	const filteredMethods =
		normalizedQuery.length === 0
			? model.methods
			: model.methods.filter(
					(item) =>
						matchesSearch(item.token, normalizedQuery) ||
						matchesSearch(t(item.descriptionKey), normalizedQuery)
			  );
	const filteredMacros =
		normalizedQuery.length === 0
			? model.macros
			: model.macros.filter(
					(item) =>
						matchesSearch(item.token, normalizedQuery) ||
						matchesSearch(t(item.descriptionKey), normalizedQuery)
			  );
	const filteredExamples =
		normalizedQuery.length === 0
			? model.examples
			: model.examples.filter(
					(item) =>
						matchesSearch(t(item.titleKey), normalizedQuery) ||
						matchesSearch(item.template, normalizedQuery)
			  );
	const hasResults =
		filteredVariables.length > 0 ||
		filteredMethods.length > 0 ||
		filteredMacros.length > 0 ||
		filteredExamples.length > 0;

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={t('dialogs.liquidDocs.title')}
			size="xl"
			zIndex={Z_INDEX.overlay.modalChild}
			footer={
				<Button variant="subtle" onClick={() => onOpenChange(false)}>
					{t('common.close')}
				</Button>
			}
		>
			<Stack gap="md">
				<TextInput
					value={search}
					onChange={(event) => setSearch(event.currentTarget.value)}
					placeholder={t('dialogs.liquidDocs.searchPlaceholder')}
				/>

				{!hasResults ? (
					<Text size="sm" c="dimmed">
						{t('dialogs.liquidDocs.noSearchResults')}
					</Text>
				) : null}

				{filteredVariables.length > 0 ? (
					<Stack gap={4}>
						<Text size="sm" fw={600}>
							{t('dialogs.liquidDocs.sections.variables')}
						</Text>
						<Stack gap="xs">
							{filteredVariables.map((item) => (
								<Paper key={item.token} withBorder p="xs" radius="md">
									<Text
										size="xs"
										style={{
											fontFamily:
												'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
											whiteSpace: 'pre-wrap',
											wordBreak: 'break-word',
										}}
									>
										{item.token}
									</Text>
									<Text size="sm" c="dimmed">
										{t(item.descriptionKey)}
									</Text>
								</Paper>
							))}
						</Stack>
					</Stack>
				) : null}

				{filteredMethods.length > 0 ? (
					<Stack gap={4}>
						<Text size="sm" fw={600}>
							{t('dialogs.liquidDocs.sections.methods')}
						</Text>
						<Stack gap="xs">
							{filteredMethods.map((item) => (
								<Paper key={item.token} withBorder p="xs" radius="md">
									<Text
										size="xs"
										style={{
											fontFamily:
												'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
											whiteSpace: 'pre-wrap',
											wordBreak: 'break-word',
										}}
									>
										{item.token}
									</Text>
									<Text size="sm" c="dimmed">
										{t(item.descriptionKey)}
									</Text>
								</Paper>
							))}
						</Stack>
					</Stack>
				) : null}

				{filteredMacros.length > 0 ? (
					<Stack gap={4}>
						<Text size="sm" fw={600}>
							{t('dialogs.liquidDocs.sections.macros')}
						</Text>
						<Stack gap="xs">
							{filteredMacros.map((item) => (
								<Paper key={item.token} withBorder p="xs" radius="md">
									<Text
										size="xs"
										style={{
											fontFamily:
												'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
											whiteSpace: 'pre-wrap',
											wordBreak: 'break-word',
										}}
									>
										{item.token}
									</Text>
									<Text size="sm" c="dimmed">
										{t(item.descriptionKey)}
									</Text>
								</Paper>
							))}
						</Stack>
					</Stack>
				) : null}

				{filteredExamples.length > 0 ? (
					<Stack gap={4}>
						<Text size="sm" fw={600}>
							{t('dialogs.liquidDocs.sections.examples')}
						</Text>
						<Stack gap="xs">
							{filteredExamples.map((item) => (
								<Paper key={item.titleKey} withBorder p="xs" radius="md">
									<Text size="sm" fw={500} mb={4}>
										{t(item.titleKey)}
									</Text>
									<Text
										size="xs"
										style={{
											fontFamily:
												'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
											whiteSpace: 'pre-wrap',
											wordBreak: 'break-word',
										}}
									>
										{item.template}
									</Text>
								</Paper>
							))}
						</Stack>
					</Stack>
				) : null}
			</Stack>
		</Dialog>
	);
};

type LiquidDocsButtonProps = {
	context: LiquidDocsContextId;
	size?: 'xs' | 'sm' | 'md' | 'lg';
	variant?: 'ghost' | 'outline' | 'solid' | 'subtle';
};

export const LiquidDocsButton: React.FC<LiquidDocsButtonProps> = ({ context, size = 'sm', variant = 'outline' }) => {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const model = LIQUID_DOCS_BY_CONTEXT[context];
	if (!model) return null;

	return (
		<>
			<Group gap={0}>
				<IconButtonWithTooltip
					aria-label={t('dialogs.liquidDocs.open')}
					icon={<FileTextIcon />}
					size={size}
					variant={variant}
					tooltip={t('dialogs.liquidDocs.open')}
					onClick={() => setOpen(true)}
				/>
			</Group>
			<LiquidDocsDialog context={context} open={open} onOpenChange={setOpen} />
		</>
	);
};
