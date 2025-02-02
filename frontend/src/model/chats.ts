import { createEvent, createStore } from 'effector';

import { ChatCard } from '../types/chat';

// Сторы для модального окна редактирования
export const $isEditModalOpen = createStore(false);
export const $editingCard = createStore<ChatCard | null>(null);

// События для управления модальным окном
export const openEditModal = createEvent<ChatCard>();
export const closeEditModal = createEvent();

// Обработчики событий
$isEditModalOpen.on(openEditModal, () => true).on(closeEditModal, () => false);

$editingCard.on(openEditModal, (_, card) => card).on(closeEditModal, () => null);
