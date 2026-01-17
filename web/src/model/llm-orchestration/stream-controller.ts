import { v4 as uuidv4 } from 'uuid';

import { BASE_URL } from '../../const';

export class StreamController {
	private streams: Map<string, AbortController> = new Map();

	createStream(): string {
		const streamId = uuidv4();
		const controller = new AbortController();
		this.streams.set(streamId, controller);
		return streamId;
	}

	async abortStream(streamId: string): Promise<void> {
		const controller = this.streams.get(streamId);
		if (controller) {
			controller.abort(); // Прерываем текущий fetch запрос
			this.streams.delete(streamId);

			// Отправляем запрос на прерывание на бэкенд
			try {
				await fetch(`${BASE_URL}/abort/${streamId}`, {
					method: 'POST',
				});
			} catch (error) {
				console.error('Error aborting stream:', error);
			}
		}
	}

	abortAllStreams(): void {
		this.streams.forEach((_controller, streamId) => {
			this.abortStream(streamId);
		});
		this.streams.clear();
	}

	getSignal(streamId: string): AbortSignal | undefined {
		return this.streams.get(streamId)?.signal;
	}

	removeStream(streamId: string): void {
		this.streams.delete(streamId);
	}
}

export const streamController = new StreamController();
