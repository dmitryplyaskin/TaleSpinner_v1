// api.ts
import { ChatCard, ChatMessage } from '@types/chat';
import axios from 'axios';

export const BASE_URL = 'http://localhost:5000/api';

export interface StreamResponse {
	content: string;
	error?: string;
}

// export interface ChatMessage {
// 	role: 'user' | 'bot';
// 	content: string;
// 	timestamp: string;
// }

export interface ChatHistory {
	messages: ChatMessage[];
}

export interface OpenRouterConfig {
	apiKey: string;
	model: string;
}

export interface LLMSettings {
	temperature: number;
	maxTokens: number;
	topP: number;
	frequencyPenalty: number;
	presencePenalty: number;
}

export interface ChatInfo {
	id: string;
	title: string;
	timestamp: string;
}

// Функция для повторных попыток
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
	for (let i = 0; i < retries; i++) {
		try {
			const response = await fetch(url, {
				...options,
				signal: AbortSignal.timeout(30000), // 30 секунд таймаут
			});

			if (!response.ok && i === retries - 1) {
				throw new Error(`HTTP error! status: ${response.status}`);
			} else if (!response.ok) {
				throw new Error('Temporary error, retrying...');
			}

			return response;
		} catch (error) {
			if (i === retries - 1) throw error;
			console.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
	throw new Error('All retry attempts failed');
}

type Stream = {
	messages: { role: string; content: string; timestamp: string }[];
	settings: LLMSettings;
};

export async function* streamMessage({ settings, messages }: Stream): AsyncGenerator<StreamResponse> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд таймаут

		const response = await fetchWithRetry(
			`${BASE_URL}/generate`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'text/event-stream',
					Connection: 'keep-alive',
					'Cache-Control': 'no-cache',
				},
				body: JSON.stringify({ messages, settings }),
				signal: controller.signal,
			},
			1,
		);

		clearTimeout(timeoutId);

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
						yield parsed as StreamResponse;
					} catch (e) {
						console.error('Error parsing SSE data:', e);
						continue;
					}
				}
			} catch (error) {
				if (error.name === 'AbortError') {
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
			error: error.message || 'Failed to connect to server',
		};
	}
}

export async function getChatHistory(chatId: string): Promise<ChatHistory> {
	try {
		const response = await fetchWithRetry(`${BASE_URL}/chats/${chatId}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		return await response.json();
	} catch (error) {
		console.error('Error fetching chat history:', error);
		return { messages: [] };
	}
}

export async function getOpenRouterConfig(): Promise<OpenRouterConfig> {
	try {
		const response = await fetchWithRetry(`${BASE_URL}/config/openrouter`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		return await response.json();
	} catch (error) {
		console.error('Error fetching OpenRouter config:', error);
		throw error;
	}
}

export async function updateOpenRouterConfig(config: OpenRouterConfig): Promise<void> {
	try {
		await fetchWithRetry(`${BASE_URL}/config/openrouter`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(config),
		});
	} catch (error) {
		console.error('Error updating OpenRouter config:', error);
		throw error;
	}
}

export const getChatList = async (): Promise<ChatInfo[]> => {
	try {
		const response = await axios.get(`${BASE_URL}/chats`);
		return response.data;
	} catch (error) {
		console.error('Error fetching chat list:', error);
		return [];
	}
};
