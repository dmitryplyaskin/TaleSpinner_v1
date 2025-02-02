import { v4 as uuidv4 } from 'uuid';

export class StreamController {
	private streams: Map<string, AbortController> = new Map();

	createStream(): string {
		const streamId = uuidv4();

		const controller = new AbortController();
		this.streams.set(streamId, controller);
		return streamId;
	}

	abortStream(streamId: string): void {
		const controller = this.streams.get(streamId);
		if (controller) {
			controller.abort();
			this.streams.delete(streamId);
		}
	}

	abortAllStreams(): void {
		this.streams.forEach((controller) => controller.abort());
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
