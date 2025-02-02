import { AgentCard } from '@shared/types/agent-card';
import { produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';

export const addNewUserMessage = (agentCard: AgentCard, content: string) =>
	produce(agentCard, (draft) => {
		const branchId = draft.activeBranch?.branch.id ?? draft.interactionBranches[0]?.id;

		if (!branchId) return;

		const branch = draft.interactionBranches.find((branch) => branch.id === branchId) || draft.interactionBranches[0];

		if (!branch) return;

		const messageId = uuidv4();
		const swipeId = uuidv4();
		const contentId = uuidv4();

		branch.messages.push({
			id: messageId,
			type: 'default',
			role: 'user',
			timestamp: new Date().toISOString(),
			activeSwipeId: swipeId,
			swipes: [
				{
					id: swipeId,
					components: [
						{
							id: contentId,
							type: 'answer',
							content: content,
						},
					],

					timestamp: new Date().toISOString(),
				},
			],
		});
	});

export const updateSwipeStream = (
	agentCard: AgentCard,
	params: {
		messageId: string;
		swipeId: string;
		componentId: string;
		content: string;
	},
) =>
	produce(agentCard, (draft) => {
		const { messageId, swipeId, componentId, content } = params;

		const branch = draft.interactionBranches.find((branch) =>
			branch.messages.some((message) => message.id === messageId),
		);
		if (!branch) return;

		const message = branch.messages.find((message) => message.id === messageId);
		if (!message) return;

		const swipe = message.swipes.find((swipe) => swipe.id === swipeId);
		if (!swipe) return;

		const component = swipe.components.find((component) => component.id === componentId);
		if (!component) return;

		component.content += content;
	});

export const createNewSwipe = (
	agentCard: AgentCard,
	params: {
		messageId: string;
		swipeId: string;
		componentId: string;
		content: string;
	},
) =>
	produce(agentCard, (draft) => {
		const { messageId, swipeId, componentId, content } = params;

		const branch = draft.interactionBranches.find((branch) =>
			branch.messages.some((message) => message.id === messageId),
		);
		if (!branch) return;

		const message = branch.messages.find((message) => message.id === messageId);
		if (!message) return;

		const swipe = message.swipes.find((swipe) => swipe.id === swipeId);
		if (!swipe) return;

		swipe.components.push({
			id: componentId,
			type: 'answer',
			content: content,
		});
	});

export const updateSwipe = (
	agentCard: AgentCard,
	params: {
		messageId: string;
		swipeId: string;
		componentId: string;
		content: string;
	},
) =>
	produce(agentCard, (draft) => {
		const { messageId, swipeId, componentId, content } = params;

		const branch = draft.interactionBranches.find((branch) =>
			branch.messages.some((message) => message.id === messageId),
		);
		if (!branch) return;

		const message = branch.messages.find((message) => message.id === messageId);
		if (!message) return;

		const swipe = message.swipes.find((swipe) => swipe.id === swipeId);
		if (!swipe) return;

		const component = swipe.components.find((component) => component.id === componentId);
		if (!component) return;

		component.content = content;
	});

export const deleteMessage = (agentCard: AgentCard, messageId: string) =>
	produce(agentCard, (draft) => {
		const branch = draft.interactionBranches.find((branch) =>
			branch.messages.some((message) => message.id === messageId),
		);
		if (!branch) return;

		branch.messages = branch.messages.filter((message) => message.id !== messageId);
	});

export const deleteSwipe = (agentCard: AgentCard, messageId: string, swipeId: string) =>
	produce(agentCard, (draft) => {
		const branch = draft.interactionBranches.find((branch) =>
			branch.messages.some((message) => message.id === messageId),
		);
		if (!branch) return;

		const message = branch.messages.find((message) => message.id === messageId);
		if (!message) return;

		message.swipes = message.swipes.filter((swipe) => swipe.id !== swipeId);
	});
