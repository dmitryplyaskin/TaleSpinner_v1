import { type AgentCard } from '@shared/types/agent-card';
import { createStore, createEvent } from 'effector';

export const $selectedAgentCardForEdit = createStore<AgentCard | null>(null);
export const setSelectedAgentCardForEdit = createEvent<AgentCard>();

$selectedAgentCardForEdit.on(setSelectedAgentCardForEdit, (_, card) => card);

export const $isEditAgentCardModalOpen = createStore(false);
export const setIsEditAgentCardModalOpen = createEvent<boolean>();

$isEditAgentCardModalOpen.on(setIsEditAgentCardModalOpen, (_, isOpen) => isOpen);
