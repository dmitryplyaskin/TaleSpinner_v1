import { Button, Group, Paper, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuFileText } from 'react-icons/lu';

import { Dialog } from './dialog';
import { IconButtonWithTooltip } from './icon-button-with-tooltip';
import { LIQUID_DOCS_BY_CONTEXT, type LiquidDocsContextId } from './liquid-template-docs-config';
import { Z_INDEX } from './z-index';

export type { LiquidDocsContextId } from './liquid-template-docs-config';

type LiquidDocsDialogProps = {
	context: LiquidDocsContextId;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export const LiquidDocsDialog: React.FC<LiquidDocsDialogProps> = ({ context, open, onOpenChange }) => {
	const { t } = useTranslation();
	const model = LIQUID_DOCS_BY_CONTEXT[context];
	if (!model) return null;

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={t(model.titleKey)}
			size="lg"
			zIndex={Z_INDEX.overlay.modalChild}
			footer={
				<Button variant="subtle" onClick={() => onOpenChange(false)}>
					{t('common.close')}
				</Button>
			}
		>
			<Stack gap="md">
				<Stack gap={4}>
					<Text size="sm" fw={600}>
						{t('dialogs.liquidDocs.sections.usage')}
					</Text>
					<Text size="sm" c="dimmed">
						{t(model.usageKey)}
					</Text>
				</Stack>

				<Stack gap={4}>
					<Text size="sm" fw={600}>
						{t('dialogs.liquidDocs.sections.variables')}
					</Text>
					<Stack gap="xs">
						{model.variables.map((item) => (
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

				<Stack gap={4}>
					<Text size="sm" fw={600}>
						{t('dialogs.liquidDocs.sections.macros')}
					</Text>
					<Stack gap="xs">
						{model.macros.map((item) => (
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

				<Stack gap={4}>
					<Text size="sm" fw={600}>
						{t('dialogs.liquidDocs.sections.examples')}
					</Text>
					<Stack gap="xs">
						{model.examples.map((item) => (
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
					icon={<LuFileText />}
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
