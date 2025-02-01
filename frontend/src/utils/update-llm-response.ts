import { produce } from 'immer';
import { AgentCard } from '@shared/types/agent-card';

interface UpdateParams {
	branchId: string;
	messageId: string;
	swipeId: string;
	swipeComponentId: string;
	newContent: string;
}

export const updateLLMResponse = (currentCard: AgentCard, params: UpdateParams): AgentCard =>
	produce(currentCard, (draft) => {
		// Находим цепочку вложенных сущностей через мутабельный поиск
		const branch = draft.interactionBranches.find((b) => b.id === params.branchId);
		if (!branch) return;

		const message = branch.messages.find((m) => m.id === params.messageId);
		if (!message) return;

		const swipe = message.swipes.find((s) => s.id === params.swipeId);
		if (!swipe) return;

		const component = swipe.components.find((c) => c.id === params.swipeComponentId);
		if (!component) return;

		// Производим мутацию только нужного компонента
		component.content = params.newContent;

		// Автоматическое обновление связанных данных
		if (draft.activeBranch?.branch.id === params.branchId) {
			draft.activeBranch.branch = branch;
			draft.activeBranch.messages = branch.messages;
		}
	});
