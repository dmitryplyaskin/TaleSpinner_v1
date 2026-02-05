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
			{ value: '', label: 'No profile selected' },
			...profiles.map((p) => ({ value: p.profileId, label: `${p.name} (v${p.version})` })),
		];
	}, [profiles]);

	return (
		<Stack gap={4} style={{ flex: 1, minWidth: 280 }}>
			<Text className="op-commandTitle">Current profile</Text>
			<Text className="op-commandHint">Select the profile used for editing and runtime execution.</Text>
			<Select
				data={options}
				value={value ?? ''}
				onChange={(v) => onChange(v && v !== '' ? v : null)}
				comboboxProps={{ withinPortal: false }}
				searchable
				placeholder="Select profile"
			/>
		</Stack>
	);
};
