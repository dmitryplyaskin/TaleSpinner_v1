import { $currentAgentCard } from '@model/chat-service';
import { instructionsModel } from '@model/instructions';
import { userPersonsModel } from '@model/user-persons';
import Handlebars from 'handlebars';

export const renderTemplate = (content: string) => {
	const user = userPersonsModel.$selectedItem.getState();
	const char = $currentAgentCard.getState();
	const systemPrompt = instructionsModel.$selectedItem.getState();
	const template = Handlebars.compile(content);

	const res = template({
		user: user?.name,
		persona: user?.type === 'default' ? user.contentTypeDefault : null,
		char: char?.metadata?.name as string,
		description: char?.metadata?.description as string,
		system: systemPrompt?.instruction,
	});

	console.log({
		res,
		content,
		template,
		user: user?.name,
		persona: user?.type === 'default' ? user.contentTypeDefault : null,
		char: char?.metadata?.name as string,
		description: char?.metadata?.description as string,
		system: systemPrompt?.instruction,
	});

	return res;
};
