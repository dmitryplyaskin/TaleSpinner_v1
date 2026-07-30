import { Collapse, Stack, Text, UnstyledButton } from '@mantine/core';
import React from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';


import { FormInput, FormSelect, FormSwitch } from '@ui/form-components';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { CaretDownIcon, ArrowCounterClockwiseIcon } from '@ui/icons';
import { TOOLTIP_PORTAL_SETTINGS } from '@ui/z-index';

type Props = {
	blockCount: number;
	onResetSessionId: () => void;
};

export const ProfileSettingsPanel: React.FC<Props> = ({ blockCount, onResetSessionId }) => {
	const { t } = useTranslation();
	const [opened, setOpened] = React.useState(false);
	const executionModeDescriptionId = React.useId();
	const [name, executionMode] = useWatch({ name: ['name', 'executionMode'] }) as [unknown, unknown];
	const profileName = typeof name === 'string' && name.trim() ? name.trim() : t('operationProfiles.profileSettings.title');
	const modeLabel =
		executionMode === 'sequential'
			? t('operationProfiles.profileSettings.executionModeSequential')
			: t('operationProfiles.profileSettings.executionModeConcurrent');
	const modeDescription =
		executionMode === 'sequential'
			? t('operationProfiles.profileSettings.executionModeSequentialDescription')
			: t('operationProfiles.profileSettings.executionModeConcurrentDescription');

	return (
		<section className="op-settingsPanel">
			<div className="op-settingsHeader">
				<UnstyledButton
					className="op-settingsSummary op-focusRing"
					onClick={() => setOpened((value) => !value)}
					aria-expanded={opened}
				>
					<div className="op-settingsIdentity">
						<CaretDownIcon className="op-settingsChevron" data-opened={opened || undefined} />
						<Stack gap={1} className="op-settingsCopy">
							<Text fw={650} lineClamp={1}>
								{profileName}
							</Text>
							<Text size="xs" c="dimmed">
								{modeLabel} · {t('operationProfiles.profileSettings.blockCount', { count: blockCount })}
							</Text>
						</Stack>
					</div>
				</UnstyledButton>
				<div className="op-profileEnabledToggle">
					<FormSwitch
						name="enabled"
						label={t('operationProfiles.profileSettings.profileEnabled')}
						switchProps={{ size: 'sm' }}
					/>
				</div>
			</div>

			<Collapse expanded={opened}>
				<div className="op-profileSettingsFields">
					<div className="op-profileIdentityFields">
						<FormInput name="name" label={t('operationProfiles.profileSettings.profileName')} />
						<FormInput name="description" label={t('operationProfiles.sectionsLabels.description')} />
					</div>
					<div className="op-profileRuntimeFields">
						<div>
							<FormSelect
								name="executionMode"
								label={t('operationProfiles.profileSettings.executionMode')}
								selectProps={{
									'aria-describedby': executionModeDescriptionId,
									comboboxProps: { withinPortal: false },
									options: [
										{ value: 'concurrent', label: t('operationProfiles.profileSettings.executionModeConcurrent') },
										{ value: 'sequential', label: t('operationProfiles.profileSettings.executionModeSequential') },
									],
								}}
							/>
							<Text id={executionModeDescriptionId} size="xs" c="dimmed" mt={4} lh={1.35}>
								{modeDescription}
							</Text>
						</div>
					</div>
					<div className="op-sessionIdRow op-profileSessionId">
						<FormInput
							name="operationProfileSessionId"
							label={t('operationProfiles.profileSettings.sessionId')}
							infoTip={t('operationProfiles.profileSettings.sessionIdInfo')}
						/>
						<IconButtonWithTooltip
							aria-label={t('operationProfiles.actions.resetSessionId')}
							tooltip={t('operationProfiles.actions.resetSessionId')}
							icon={<ArrowCounterClockwiseIcon />}
							size="input-sm"
							variant="ghost"
							tooltipSettings={TOOLTIP_PORTAL_SETTINGS}
							onClick={onResetSessionId}
						/>
					</div>
				</div>
			</Collapse>
		</section>
	);
};
