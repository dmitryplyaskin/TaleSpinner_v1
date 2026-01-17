import { type GenerateMessage } from '@shared/types/generate';

import { type LLMSettingsState } from '@model/llm-settings';

import { streamMessage } from './stream';

type GenerateProps = {
	llmSettings?: LLMSettingsState;
	messages: GenerateMessage[];
	stream: true;
	streamId: string;
	streamCb: (data: { chunk: string; content: string; iteration: number }) => void;
};

export const generate = async (params: GenerateProps) => {
	try {
		const { messages, llmSettings, stream, streamId, streamCb } = params;

		// @ts-expect-error -- non-streaming mode is not implemented yet
		if (stream === false) {
			// TODO: add non-streaming generation
			return;
		} else {
			const messageStream = await streamMessage({
				messages,
				streamId,
				settings: llmSettings,
			});

			let iteration = 0;
			let content = '';
			for await (const chunk of messageStream) {
				if ('error' in chunk) {
					throw new Error(chunk.error);
				}
				iteration++;
				content += chunk.content;

				streamCb({ chunk: chunk.content, content, iteration });
			}
		}
	} catch (error) {
		console.error(error);
	}
};
