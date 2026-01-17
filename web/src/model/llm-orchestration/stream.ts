import { type GenerateMessage, type StreamResponse } from '@shared/types/generate';

import { type LLMSettingsState } from '@model/llm-settings';

import { BASE_URL } from '../../const';

import { streamController } from './stream-controller';

type Stream = {
	messages: GenerateMessage[];
	settings?: LLMSettingsState;
	streamId?: string;
};

export async function* streamMessage({ settings, messages, streamId }: Stream): AsyncGenerator<StreamResponse> {
	const currentStreamId = streamId || streamController.createStream();

	try {
		const signal = streamController.getSignal(currentStreamId);

		if (!signal) {
			yield { content: '', error: 'Failed to create stream controller' };
			return;
		}

		const response = await fetch(`${BASE_URL}/generate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'text/event-stream',
				Connection: 'keep-alive',
				'Cache-Control': 'no-cache',
			},
			body: JSON.stringify({ messages, settings, streamId: currentStreamId }),
			signal,
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
			yield {
				content: '',
				error: errorData.error || `HTTP error! status: ${response.status}`,
			};
			return;
		}

		const reader = response.body?.getReader();
		if (!reader) {
			yield { content: '', error: 'No reader available' };
			return;
		}

		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			try {
				const { value, done } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');

				buffer = lines.pop() || '';

				for (const line of lines) {
					if (line.trim() === '') continue;
					if (!line.startsWith('data:')) continue;

					const data = line.slice(5).trim();
					if (data === '[DONE]') return;

					try {
						const parsed = JSON.parse(data);
						if ('error' in parsed) {
							yield { content: '', error: parsed.error };
							return;
						}
						if (parsed && typeof parsed === 'object' && 'content' in parsed && typeof parsed.content === 'string') {
							yield parsed as StreamResponse;
						}
					} catch (e) {
						console.error('Error parsing SSE data:', e);
						continue;
					}
				}
			} catch (error) {
				if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
					yield { content: '', error: 'Request timed out' };
				} else {
					yield { content: '', error: 'Stream processing error' };
				}
				break;
			}
		}
	} catch (error) {
		console.error('Error streaming message:', error);
		yield {
			content: '',
			error:
				typeof error === 'object' && error !== null && 'message' in error
					? String(error.message)
					: 'Failed to connect to server',
		};
	} finally {
		streamController.removeStream(currentStreamId);
	}
}
