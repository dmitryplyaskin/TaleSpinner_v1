import { Stack, TextInput } from '@mantine/core';
import React, { useMemo, useState } from 'react';
import { LuSearch } from 'react-icons/lu';

import { OperationRow } from './operation-row';

type Props = {
	items: Array<{ opId: string; index: number }>;
	selectedOpId: string | null;
	onSelect: (opId: string) => void;
};

export const OperationList: React.FC<Props> = ({ items, selectedOpId, onSelect }) => {
	const [query, setQuery] = useState('');
	const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);

	return (
		<Stack gap="xs">
			<TextInput
				value={query}
				onChange={(e) => setQuery(e.currentTarget.value)}
				placeholder="Search operations..."
				leftSection={<LuSearch />}
			/>
			{items.map((item) => (
				<OperationRow
					key={item.opId}
					index={item.index}
					opId={item.opId}
					selected={selectedOpId === item.opId}
					onSelect={onSelect}
					query={normalizedQuery}
				/>
			))}
		</Stack>
	);
};
