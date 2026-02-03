import { type AgentCard, type InteractionBranch, type Swipe } from '@shared/types/agent-card';

/**
 * Возвращает массив сообщений в виде объектов { role, content } на основе данных из AgentCard.
 * Для каждого сообщения активной ветки выбирается активный Swipe (по activeSwipeId, либо первый из swipes),
 * а его компоненты объединяются в один текст.
 *
 * @param agentCard - объект типа AgentCard
 * @returns массив сообщений вида { role: 'assistant' | 'user' | 'system', content: string }
 */
export function buildMessages(agentCard: AgentCard): { role: 'assistant' | 'user' | 'system'; content: string }[] {
	let activeBranch: InteractionBranch | undefined = agentCard.activeBranch?.branch;

	if (!activeBranch && agentCard.activeBranchId) {
		activeBranch = agentCard.interactionBranches.find((branch) => branch.id === agentCard.activeBranchId);
	}

	if (!activeBranch) {
		return [];
	}

	const messagesArray: { role: 'assistant' | 'user' | 'system'; content: string }[] = [];

	for (const message of activeBranch.messages) {
		let selectedSwipe: Swipe | undefined;

		if (message.activeSwipeId) {
			selectedSwipe = message.swipes.find((swipe) => swipe.id === message.activeSwipeId);
		}

		if (!selectedSwipe && message.swipes.length > 0) {
			selectedSwipe = message.swipes[0];
		}

		if (selectedSwipe) {
			const concatenatedContent = selectedSwipe.components
				.map((component) =>
					component.type === 'reasoning' ? `<thinking>\n${component.content}\n</thinking>` : component.content,
				)
				.join('\n');
			if (concatenatedContent) {
				messagesArray.push({
					role: message.role,
					content: concatenatedContent,
				});
			}
		}
	}

	return messagesArray;
}

