import { Select, Stack, Text } from '@mantine/core';
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
			{ value: '', label: '(none)' },
			...profiles.map((p) => ({ value: p.profileId, label: `${p.name} (v${p.version})` })),
		];
	}, [profiles]);

	return (
		<Stack gap="xs">
			<Text fw={700}>Current profile</Text>
			<Select
				data={options}
				value={value ?? ''}
				onChange={(v) => onChange(v && v !== '' ? v : null)}
				comboboxProps={{ withinPortal: false }}
			/>
		</Stack>
	);
};

