import { visit } from 'unist-util-visit';

import type { Root, RootContent, Text } from 'mdast';
import type { Plugin } from 'unified';

const QUOTE_REGEX = /("|“|”|«|»)([^"“”«»]+)("|“|”|«|»)/g;

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function processTextNode(text: string): RootContent[] {
	const nodes: RootContent[] = [];
	let lastIndex = 0;
	let match;

	while ((match = QUOTE_REGEX.exec(text)) !== null) {
		const [fullMatch, openQuote, content, closeQuote] = match;

		// Add text before match
		if (match.index > lastIndex) {
			nodes.push({
				type: 'text',
				value: text.slice(lastIndex, match.index),
			});
		}

		// Wrap quoted text (including original quote characters) for styling.
		nodes.push({
			type: 'html',
			value: `<q>${escapeHtml(openQuote)}${escapeHtml(content)}${escapeHtml(closeQuote)}</q>`,
		});

		lastIndex = match.index + fullMatch.length;
	}

	// Add remaining text
	if (lastIndex < text.length) {
		nodes.push({
			type: 'text',
			value: text.slice(lastIndex),
		});
	}

	return nodes;
}

export const quotePlugin: Plugin<[], Root> = () => {
	return (tree) => {
		visit(tree, 'text', (node: Text, index, parent) => {
			if (typeof index !== 'number' || !parent) return;
			const processedNodes = processTextNode(node.value);

			if (processedNodes.length > 0) {
				parent.children.splice(index, 1, ...processedNodes);
				return index + processedNodes.length;
			}
		});
	};
};
