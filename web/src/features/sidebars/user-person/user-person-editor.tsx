import { Button, Group, Stack, TextInput, Textarea } from '@mantine/core';
import { type UserPersonType } from '@shared/types/user-person';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { userPersonsModel } from '@model/user-persons';
import { Dialog } from '@ui/dialog';

import { BACKEND_ORIGIN } from '../../../api/chat-core';
import { AvatarUpload } from '../../../features/common/avatar-upload';

interface UserPersonEditorProps {
	opened: boolean;
	data: UserPersonType | null;
	onClose: () => void;
}

type UserPersonEditorState = UserPersonType & { avatarUrl?: string | null };

export const UserPersonEditor: React.FC<UserPersonEditorProps> = ({ opened, data, onClose }) => {
	const { t } = useTranslation();
	const [personData, setPersonData] = useState<UserPersonEditorState | null>(data as UserPersonEditorState | null);

	useEffect(() => {
		if (!opened) return;
		setPersonData((data as UserPersonEditorState | null) ?? null);
	}, [data, opened]);

	const handleSave = () => {
		if (!personData) return;
		userPersonsModel.updateItemFx({
			...personData,
			type: 'default',
		});
		onClose();
	};

	const handleAvatarChange = (avatarUrl: string) => {
		if (!personData) return;
		const updatedData = {
			...personData,
			avatarUrl,
			type: 'default' as const,
		};

		setPersonData(updatedData);
		userPersonsModel.updateItemFx(updatedData);
	};

	if (!personData) return null;

	return (
		<Dialog
			open={opened}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			title={t('userPersons.editor.title')}
			size="cover"
			fullScreenContentMaxWidth={1200}
			fillBodyHeight
			footer={<></>}
		>
			<form
				id="dialog-form"
				onSubmit={(event) => {
					event.preventDefault();
					handleSave();
				}}
			>
				<Stack gap="md">
					<Group align="center" wrap="nowrap">
						<AvatarUpload
							size="2xl"
							name={personData.name}
							src={personData.avatarUrl ?? undefined}
							baseUrl={BACKEND_ORIGIN}
							onAvatarChange={handleAvatarChange}
							saveFolder="user-persons"
						/>

						<TextInput
							label={t('userPersons.fields.name')}
							value={personData.name}
							onChange={(e) => setPersonData({ ...personData, name: e.currentTarget.value })}
							style={{ flex: 1 }}
						/>
					</Group>

					<TextInput
						label={t('userPersons.fields.prefix')}
						value={personData.prefix || ''}
						onChange={(e) => setPersonData({ ...personData, prefix: e.currentTarget.value })}
					/>

					<Textarea
						label={t('userPersons.fields.description')}
						value={personData.contentTypeDefault || ''}
						autosize
						minRows={8}
						onChange={(e) =>
							setPersonData({
								...personData,
								type: 'default',
								contentTypeDefault: e.currentTarget.value,
							})
						}
					/>

					<Group justify="flex-end" gap="sm">
						<Button type="button" variant="subtle" onClick={onClose}>
							{t('common.cancel')}
						</Button>
						<Button type="submit">{t('common.save')}</Button>
					</Group>
				</Stack>
			</form>
		</Dialog>
	);
};
