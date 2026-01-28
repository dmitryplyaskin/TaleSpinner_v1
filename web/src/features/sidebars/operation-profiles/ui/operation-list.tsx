import { Stack } from '@mantine/core';
import React from 'react';

import { OperationRow } from './operation-row';

type Props = {
	items: Array<{ opId: string; index: number }>;
	selectedOpId: string | null;
	onSelect: (opId: string) => void;
};

export const OperationList: React.FC<Props> = ({ items, selectedOpId, onSelect }) => {
	return (
		<Stack gap="xs">
			{items.map((item) => (
				<OperationRow
					key={item.opId}
					index={item.index}
					opId={item.opId}
					selected={selectedOpId === item.opId}
					onSelect={onSelect}
				/>
			))}
		</Stack>
	);
};
