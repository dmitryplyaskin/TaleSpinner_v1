import { LLMSettingsState } from '@model/llm-settings';
import { UserPersonSettings } from '@shared/types/user-person';
import { ChatCard } from '@types/chat';
import { UserPerson } from '../../../../shared/types/user-person';

type CreatePromptProps = {
	chatCard: ChatCard;
	llmSettings: LLMSettingsState;
	systemPrompt: string;
	template: string;
	userPerson: {
		settings: UserPersonSettings;
		person: UserPerson[];
	};
};

export const createPrompt = (data: CreatePromptProps) => {};
