import { AgentCard } from '@shared/types/agent-card';

const updateChatList = (_: AgentCard[], { data }: { data: AgentCard[] }) => data;

const removeChat = (state: AgentCard[], { params }: { params: AgentCard }) =>
	state.filter((chat) => chat.id !== params.id);

const addNewChat = (state: AgentCard[], { data }: { data: AgentCard }) => [data, ...state];

const addDuplicatedChat = (state: AgentCard[], { data }: { data: AgentCard }) => [data, ...state];

const updateChat = (state: AgentCard[], { data }: { data: AgentCard }) => {
	return state.map((chat) => (chat.id === data.id ? data : chat));
};

export const reducers = {
	updateChatList,
	removeChat,
	addNewChat,
	addDuplicatedChat,
	updateChat,
};
