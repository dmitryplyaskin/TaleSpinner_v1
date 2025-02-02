import { LLMSettingsState } from '@model/llm-settings';
import { UserPersonSettings } from '@shared/types/user-person';

import { UserPerson } from '../../../../shared/types/user-person';
import Handlebars from 'handlebars';
import { $userPersons, $userPersonsSettings } from '@model/user-persons';
import { AgentCard } from '@shared/types/agent-card';
import { $currentAgentCard } from '@model/chat-service';

type CreatePromptProps = {
	chatCard?: AgentCard;
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
	// console.log(data.userPerson?.person, data.userPerson?.settings.selectedUserPersonId);
	const res = template({
		user: data.userPerson?.person?.find((x) => x.id === data.userPerson?.settings.selectedUserPersonId)
			?.contentTypeDefault,
	});

	// console.log(res);
};

setTimeout(() => {
	createPrompt({
		chatCard: $currentAgentCard.getState(),
		llmSettings: {},
		systemPrompt: `Привет, проверка чего то
{{user}}

Начнем ролевую игру`,
		template: '',
		userPerson: {
			settings: $userPersonsSettings.getState(),
			person: $userPersons.getState(),
		},
	});
}, 3000);
