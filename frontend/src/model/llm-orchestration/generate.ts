import { LLMSettingsState } from '@model/llm-settings';

import { GenerateMessage } from '@shared/types/generate';
import { streamMessage } from './stream';

type GenerateProps = {
	llmSettings: LLMSettingsState;
	messages: GenerateMessage[];
	stream: true;
	streamCb: (data: { chunk: string; content: string }) => void;
};

export const generate = async (params: GenerateProps) => {
	try {
		const { messages, llmSettings, stream, streamCb } = params;

		// @ts-expect-error
		if (stream === false) {
			// TODO: add non-streaming generation
			return;
		} else {
			const messageStream = streamMessage({
				messages,
				settings: llmSettings,
			});

			let content = '';
			for await (const chunk of messageStream) {
				if ('error' in chunk) {
					throw new Error(chunk.error);
				}
				content += chunk.content;

				streamCb({ chunk: chunk.content, content });
			}
		}
	} catch (error) {
		console.error(error);
	}
};
