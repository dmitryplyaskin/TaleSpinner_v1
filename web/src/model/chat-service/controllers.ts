import { AgentCard } from '@shared/types/agent-card';
import { asyncHandler } from '@model/utils/async-handler';
import { BASE_URL } from '../../const';

export const saveCurrentAgentCard = (data: AgentCard | null) =>
	asyncHandler(async () => {
		if (!data) return;
		const response = await fetch(`${BASE_URL}/chats/${data.id}`, {
			method: 'PUT',
			body: JSON.stringify(data),
			headers: {
				'Content-Type': 'application/json',
			},
		});

		return response.json();
	}, 'Error saving agent card');

export const controllers = {
	saveCurrentAgentCard,
};
