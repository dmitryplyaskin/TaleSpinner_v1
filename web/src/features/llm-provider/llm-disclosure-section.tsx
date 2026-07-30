import { Collapse, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { useId, useState } from 'react';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

import type { ReactNode } from 'react';

type Props = {
	title: string;
	children: ReactNode;
};

export const LlmDisclosureSection: React.FC<Props> = ({ title, children }) => {
	const [open, setOpen] = useState(false);
	const contentId = useId();

	return (
		<Stack gap={0} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
			<UnstyledButton
				onClick={() => setOpen((value) => !value)}
				aria-expanded={open}
				aria-controls={contentId}
				style={{ width: '100%', padding: '12px 0' }}
			>
				<Group justify="space-between" wrap="nowrap">
					<Text fw={600}>{title}</Text>
					{open ? <LuChevronUp size={16} /> : <LuChevronDown size={16} />}
				</Group>
			</UnstyledButton>
			<Collapse in={open} id={contentId}>
				<Stack gap="md" pb="md">
					{children}
				</Stack>
			</Collapse>
		</Stack>
	);
};
