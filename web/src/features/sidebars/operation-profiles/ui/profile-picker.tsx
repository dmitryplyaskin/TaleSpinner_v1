import { Select } from '@mantine/core';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type ProfileOptionSource = {
	profileId: string;
	name: string;
	version: number;
};

type Props = {
	profiles: ProfileOptionSource[];
	value: string | null;
	onChange: (profileId: string | null) => void;
};

export const ProfilePicker: React.FC<Props> = ({ profiles, value, onChange }) => {
	const { t } = useTranslation();
	const options = useMemo(() => {
		return [
			{ value: '', label: t('operationProfiles.profilePicker.noneSelected') },
			...profiles.map((p) => ({ value: p.profileId, label: p.name })),
		];
	}, [profiles, t]);

	return (
		<Select
			data={options}
			value={value ?? ''}
			onChange={(v) => onChange(v && v !== '' ? v : null)}
			comboboxProps={{ withinPortal: false }}
			searchable
			placeholder={t('operationProfiles.profilePicker.select')}
			aria-label={t('operationProfiles.profilePicker.current')}
			className="op-profilePicker"
		/>
	);
};
