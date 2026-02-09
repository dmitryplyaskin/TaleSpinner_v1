import { Box, Code, Paper, Text } from '@mantine/core';

import { RenderMd } from '@ui/render-md';

import type { Part } from '@shared/types/chat-entry-parts';
import type React from 'react';

export type PartRenderer = React.FC<{ part: Part }>;

const TextRenderer: PartRenderer = ({ part }) => {
	const content = typeof part.payload === 'string' ? part.payload : '';
	return (
		<Text style={{ whiteSpace: 'pre-wrap' }} size="sm" className="ts-chat-serif">
			{content}
		</Text>
	);
};

const MarkdownRenderer: PartRenderer = ({ part }) => {
	const content = typeof part.payload === 'string' ? part.payload : '';
	return <RenderMd content={content} containerProps={{ className: 'ts-chat-serif' }} />;
};

const JsonRenderer: PartRenderer = ({ part }) => {
	const value = typeof part.payload === 'string' ? part.payload : part.payload;
	const json = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
	return (
		<Paper withBorder radius="sm" p="sm">
			<Code block>{json}</Code>
		</Paper>
	);
};

const FallbackRenderer: PartRenderer = ({ part }) => {
	return (
		<Box>
			<Text fw={600} size="sm">
				Unknown renderer: {part.ui?.rendererId ?? '(none)'}
			</Text>
			<JsonRenderer part={part} />
		</Box>
	);
};

export function renderPart(part: Part): React.ReactNode {
	const id = part.ui?.rendererId ?? 'markdown';
	if (id === 'text') return <TextRenderer part={part} />;
	if (id === 'markdown') return <MarkdownRenderer part={part} />;
	if (id === 'json') return <JsonRenderer part={part} />;
	if (id === 'card') return <JsonRenderer part={part} />;
	return <FallbackRenderer part={part} />;
}

