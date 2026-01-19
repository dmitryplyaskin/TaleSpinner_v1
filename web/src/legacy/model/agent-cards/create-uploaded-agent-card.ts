import { createEffect, sample } from 'effector';

import { type CardUploadResponse } from '@model/files/types';
import { toaster } from '@ui/toaster';

import { createNewAgentCard, createNewMessage, createNewSwipe } from '../../../utils/creation-helper-agent-card';
import { uploadAgentCardFilesFx } from '../../../model/files/files';

import { agentCardsModel } from './create-model';

const createUploadedAgentCard = createEffect<{ data: CardUploadResponse }, void>(async (result) => {
	if (result.data.failedFiles.length > 0) {
		result.data.failedFiles.forEach(({ originalName, error }) => {
			toaster.error({
				title: `Ошибка обработки файла ${originalName}`,
				description: error,
			});
		});
	}

	if (result.data.processedFiles.length > 0) {
		result.data.processedFiles.forEach((file) => {
			const data = file.characterData[0];
			if (data.spec === 'chara_card_v2') {
				const emptyChatItem = createNewAgentCard();
				emptyChatItem.name = data.data.name;
				emptyChatItem.avatarPath = file.path;
				emptyChatItem.metadata = data.data;

				emptyChatItem.introSwipes = createNewMessage({ role: 'assistant', content: data.data.first_mes }).message;
				if (data.data.alternate_greetings?.length) {
					data.data.alternate_greetings.forEach((greeting: string) => {
						emptyChatItem.introSwipes.swipes.push(createNewSwipe({ content: greeting }).swipe);
					});
				}

				agentCardsModel.createItemFx(emptyChatItem);
			}

			toaster.success({
				title: 'Успешно',
				description: `Файл ${file.originalName} успешно загружен`,
			});
		});
	}
});

sample({
	clock: uploadAgentCardFilesFx.doneData,
	target: createUploadedAgentCard,
});

