import { Select } from '@mantine/core';
import React, { useMemo } from 'react';

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
	const options = useMemo(() => {
		return [
			{ value: '', label: 'No profile selected' },
			...profiles.map((p) => ({ value: p.profileId, label: `${p.name} (v${p.version})` })),
		];
	}, [profiles]);

	return (
		<Select
			data={options}
			value={value ?? ''}
			onChange={(v) => onChange(v && v !== '' ? v : null)}
			comboboxProps={{ withinPortal: false }}
			searchable
			placeholder="Select profile"
			aria-label="Current profile"
			className="op-profilePicker"
		/>
	);
};
