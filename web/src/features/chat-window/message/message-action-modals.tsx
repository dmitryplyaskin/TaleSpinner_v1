import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useTranslation } from 'react-i18next';

import {
	$deleteConfirmState,
	closeDeleteConfirm,
	confirmDeleteAction,
	deleteVariantFx,
	softDeleteEntriesBulkFx,
	softDeleteEntryFx,
	softDeletePartFx,
} from '@model/chat-entry-parts';

export const MessageActionModals = () => {
	const { t } = useTranslation();
	const [state, close, confirm, deleteEntryPending, deleteVariantPending, deletePartPending, deleteBulkPending] = useUnit([
		$deleteConfirmState,
		closeDeleteConfirm,
		confirmDeleteAction,
		softDeleteEntryFx.pending,
		deleteVariantFx.pending,
		softDeletePartFx.pending,
		softDeleteEntriesBulkFx.pending,
	]);

	if (!state) return null;

	const isBusy =
		state.kind === 'entry'
			? deleteEntryPending
			: state.kind === 'variant'
				? deleteVariantPending
				: state.kind === 'part'
					? deletePartPending
					: deleteBulkPending;
	const title =
		state.kind === 'entry'
			? t('chat.confirm.deleteMessageTitle')
			: state.kind === 'variant'
				? t('chat.confirm.deleteVariantTitle')
				: state.kind === 'part'
					? t('chat.confirm.deletePartTitle')
					: t('chat.confirm.deleteBulkMessagesTitle');
	const body =
		state.kind === 'entry'
			? t('chat.confirm.deleteMessageBody')
			: state.kind === 'variant'
				? t('chat.confirm.deleteVariantBody')
				: state.kind === 'part'
					? t('chat.confirm.deletePartBody')
					: t('chat.confirm.deleteBulkMessagesBody', { count: state.count });

	return (
		<Modal opened onClose={() => close()} title={title} centered closeOnClickOutside={!isBusy} closeOnEscape={!isBusy}>
			<Stack gap="md">
				<Text size="sm">{body}</Text>
				<Group justify="flex-end">
					<Button variant="subtle" onClick={() => close()} disabled={isBusy}>
						{t('common.cancel')}
					</Button>
					<Button color="red" onClick={() => confirm()} loading={isBusy}>
						{t('common.delete')}
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
};
