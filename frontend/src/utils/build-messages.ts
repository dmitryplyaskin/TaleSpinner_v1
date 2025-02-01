import { AgentCard, InteractionBranch, Swipe } from '@shared/types/agent-card';

/**
 * Возвращает массив сообщений в виде объектов { role, content } на основе данных из AgentCard.
 * Для каждого сообщения активной ветки выбирается активный Swipe (по activeSwipeId, либо первый из swipes),
 * а его компоненты объединяются в один текст.
 *
 * @param agentCard - объект типа AgentCard
 * @returns массив сообщений вида { role: 'assistant' | 'user' | 'system', content: string }
 */
export function buildMessages(agentCard: AgentCard): { role: 'assistant' | 'user' | 'system'; content: string }[] {
	// Определяем активную ветку взаимодействия.
	// Сначала пробуем использовать agentCard.activeBranch, если оно задано.
	let activeBranch: InteractionBranch | undefined = agentCard.activeBranch?.branch;

	// Если activeBranch не определено, ищем в interactionBranches по совпадению activeBranchId.
	if (!activeBranch && agentCard.activeBranchId) {
		activeBranch = agentCard.interactionBranches.find((branch) => branch.id === agentCard.activeBranchId);
	}

	// Если активная ветка не найдена, возвращаем пустой массив.
	if (!activeBranch) {
		return [];
	}

	const messagesArray: { role: 'assistant' | 'user' | 'system'; content: string }[] = [];

	// Проходим по каждому сообщению во выбранной ветке.
	for (const message of activeBranch.messages) {
		let selectedSwipe: Swipe | undefined;

		// Если в сообщении задан activeSwipeId, пробуем найти соответствующий свайп.
		if (message.activeSwipeId) {
			selectedSwipe = message.swipes.find((swipe) => swipe.id === message.activeSwipeId);
		}

		// Если активный свайп не найден, берём первый свайп из массива (если он есть).
		if (!selectedSwipe && message.swipes.length > 0) {
			selectedSwipe = message.swipes[0];
		}

		// Если свайп найден, собираем все его компоненты в одну строку.
		if (selectedSwipe) {
			const concatenatedContent = selectedSwipe.components.map((component) => component.content).join(' ');
			messagesArray.push({
				role: message.role,
				content: concatenatedContent,
			});
		}
	}

	return messagesArray;
}
