import { useEffect } from 'react';

import { streamController } from '../model/llm-orchestration/stream-controller';

export function useStreamController() {
	const streamId = streamController.createStream();

	useEffect(() => {
		// Очистка при размонтировании компонента
		return () => {
			streamController.abortStream(streamId);
		};
	}, [streamId]);

	return streamId;
}
