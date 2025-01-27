import { LLMSettingsState } from '@model/llm-settings';
import { UserPersonSettings } from '@shared/types/user-person';
import { ChatCard } from '@types/chat';
import { UserPerson } from '../../../../shared/types/user-person';
import Handlebars from 'handlebars';
import { $userPersons, $userPersonsSettings } from '@model/user-persons';
import { $currentChat } from '@model/chats';

type CreatePromptProps = {
	chatCard?: ChatCard;
	llmSettings?: LLMSettingsState;
	systemPrompt?: string;
	template?: string;
	userPerson?: {
		settings: UserPersonSettings;
		person: UserPerson[];
	};
};

export const createPrompt = (data: CreatePromptProps) => {
	const template = Handlebars.compile(data.systemPrompt);
	console.log(data.userPerson?.person, data.userPerson?.settings.selectedUserPersonId);
	const res = template({
		user: data.userPerson?.person?.find((x) => x.id === data.userPerson?.settings.selectedUserPersonId)
			?.contentTypeDefault,
	});

	console.log(res);
};

setTimeout(() => {
	createPrompt({
		chatCard: $currentChat.getState(),
		llmSettings: {},
		systemPrompt: `
	Привет, проверка чего то
	{{user}}`,
		template: '',
		userPerson: {
			settings: $userPersonsSettings.getState(),
			person: $userPersons.getState(),
		},
	});
}, 3000);
