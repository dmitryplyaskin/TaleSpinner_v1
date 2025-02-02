import { apiRoutes } from '../../api-routes';
import { asyncHandler } from '../utils/async-handler';
import { createNewAgentCard } from '../../utils/creation-helper-agent-card';
import { AgentCard } from '@shared/types/agent-card';

export const getChatList = () =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.chat.list());
		return response.json();
	}, 'Error fetching chat list');

export const deleteChat = (data: AgentCard) =>
	asyncHandler(async () => {
		if (!window.confirm('Вы уверены, что хотите удалить этот чат?')) {
			return;
		}
		const response = await fetch(apiRoutes.chat.delete(data.id), {
			method: 'DELETE',
		});
		return response.json();
	}, 'Error deleting chat');

export const createChat = () =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.chat.create(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(createNewAgentCard()),
		});
		return response.json();
	}, 'Error creating chat');

export const duplicateChat = (data: AgentCard) =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.chat.duplicate(data.id), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		return response.json();
	}, 'Error duplicating chat');

export const getChat = (data: AgentCard) =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.chat.getById(data.id), {
			method: 'GET',
		});
		return response.json();
	}, 'Error getting chat');

export const controllers = {
	getChatList,
	deleteChat,
	createChat,
	duplicateChat,
	getChat,
};
