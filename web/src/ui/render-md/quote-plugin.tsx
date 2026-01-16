import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Text, Parent, RootContent } from 'mdast';
import type { Root } from 'mdast';

const QUOTE_REGEX = /("|“|”|«|»)([^"“”«»]+)("|“|”|«|»)/g;

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

		// Add HTML element for quoted text
		nodes.push({
			type: 'html',
			value: `<q>${openQuote}${content}${closeQuote}</q>`,
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
		visit(tree, 'text', (node: Text, index: number, parent: Parent) => {
			const processedNodes = processTextNode(node.value);

			if (processedNodes.length > 0) {
				parent.children.splice(index, 1, ...processedNodes);
				return index + processedNodes.length;
			}
		});
	};
};
