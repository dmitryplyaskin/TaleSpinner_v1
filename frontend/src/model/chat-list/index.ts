// import { createEffect, createEvent, createStore } from 'effector';

// import { controllers } from './controllers';
// import { reducers } from './reducers';
import { AgentCard } from '@shared/types/agent-card';
import { createItemsModel } from '@model/_fabric_/items-model';

// export const $chatList = createStore<AgentCard[]>([]);

// export const getChatListFx = createEffect<void, { data: AgentCard[] }>(controllers.getChatList);
// export const deleteChatFx = createEffect<AgentCard, void>(controllers.deleteChat);

// export const createChatFx = createEffect<void, { data: AgentCard }>(controllers.createChat);
// export const duplicateChatFx = createEffect<AgentCard, { data: AgentCard }>(controllers.duplicateChat);
// export const getChatFx = createEffect<AgentCard, { data: AgentCard }>(controllers.getChat);

// export const updateChat = createEvent<AgentCard>();

// $chatList
// 	.on(getChatListFx.doneData, reducers.updateChatList)
// 	.on(deleteChatFx.done, reducers.removeChat)
// 	.on(createChatFx.doneData, reducers.addNewChat)
// 	.on(duplicateChatFx.doneData, reducers.addDuplicatedChat)
// 	.on(getChatFx.doneData, reducers.updateChat)
// 	.on(updateChat, (state, data) => reducers.updateChat(state, { data }));

export const chatListModel = createItemsModel<AgentCard>({ route: '/chat' }, 'chat');
