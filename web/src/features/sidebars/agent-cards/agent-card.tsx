import { Avatar, Card, Group, Stack, Text } from '@mantine/core';
import type { EntityProfileDto } from '../../../api/chat-core';

import { selectEntityProfile } from '@model/chat-core';


type Props = {
	data: EntityProfileDto;
};

export const AgentCard: React.FC<Props> = ({ data }) => {
	const handleSelect = () => {
		selectEntityProfile(data);
	};

	return (
		<Card withBorder padding="md" onClick={handleSelect} style={{ cursor: 'pointer', position: 'relative' }}>
			<Group gap="sm" wrap="nowrap" align="flex-start">
				<Avatar size="lg" name={data.name} />
				<Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
					<Text fw={600} truncate>
						{data.name}
					</Text>

					<Text c="dimmed" size="xs" lineClamp={2}>
						Kind: {data.kind}
					</Text>
				</Stack>
			</Group>
		</Card>
	);
};
