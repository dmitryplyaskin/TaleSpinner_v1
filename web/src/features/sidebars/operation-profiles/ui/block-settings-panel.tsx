import { Badge, Collapse, Stack, Text, UnstyledButton } from '@mantine/core';
import React from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LuChevronDown } from 'react-icons/lu';

import { FormInput, FormSwitch } from '@ui/form-components';

type Props = {
	operationCount: number;
};

export const BlockSettingsPanel: React.FC<Props> = ({ operationCount }) => {
	const { t } = useTranslation();
	const [opened, setOpened] = React.useState(false);
	const [name, enabled] = useWatch({ name: ['name', 'enabled'] }) as [unknown, unknown];
	const blockName = typeof name === 'string' && name.trim() ? name.trim() : t('operationProfiles.blocks.blockSettingsTitle');

	return (
		<section className="op-settingsPanel">
			<UnstyledButton
				className="op-settingsSummary op-focusRing"
				onClick={() => setOpened((value) => !value)}
				aria-expanded={opened}
			>
				<div className="op-settingsIdentity">
					<LuChevronDown className="op-settingsChevron" data-opened={opened || undefined} />
					<Stack gap={1} className="op-settingsCopy">
						<Text fw={650} lineClamp={1}>
							{blockName}
						</Text>
						<Text size="xs" c="dimmed">
							{t('operationProfiles.blocks.operationCount', { count: operationCount })}
						</Text>
					</Stack>
				</div>
				<Badge variant="light" color={enabled ? 'teal' : 'gray'}>
					{enabled ? t('operationProfiles.status.enabled') : t('operationProfiles.status.disabled')}
				</Badge>
			</UnstyledButton>

			<Collapse in={opened}>
				<div className="op-settingsFields">
					<FormInput name="name" label={t('operationProfiles.blocks.blockName')} />
					<FormInput name="description" label={t('operationProfiles.sectionsLabels.description')} />
					<div className="op-switchField">
						<FormSwitch name="enabled" label={t('operationProfiles.blocks.blockEnabled')} />
					</div>
				</div>
			</Collapse>
		</section>
	);
};
