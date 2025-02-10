// remark-quote-plugin.ts
import { visit } from 'unist-util-visit';
import { u } from 'unist-builder';
import type { Node, Parent } from 'unist';

interface TextNode extends Node {
	type: 'text';
	value: string;
}

// Поддерживаемые кавычки – только двойные, “умные” и французские (одинарные кавычки исключены)
const quotePairs: Record<string, string> = {
	'"': '"',
	'“': '”',
	'«': '»',
};

/**
 * Функция processText разбивает строку на части.
 * Если находится корректная пара кавычек, то оборачивает весь найденный фрагмент (с кавычками)
 * в узел с tagName 'quote'. Если закрывающая кавычка отсутствует или не соответствует,
 * оставляет фрагмент как текст.
 */
function processText(text: string): Node[] {
	const result: Node[] = [];
	let lastIndex = 0;
	// Регулярное выражение ищет открывающую кавычку (одну из: ", “, «),
	// затем минимальное содержимое, затем закрывающую (одну из: ", ”, »).
	const regex = /(["“«])([\s\S]*?)(["”»])/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(text)) !== null) {
		const [full, opening, _content, closing] = match;
		const start = match.index;
		if (start > lastIndex) {
			result.push({ type: 'text', value: text.slice(lastIndex, start) });
		}
		// Если найденная закрывающая кавычка соответствует открывающей
		if (quotePairs[opening] === closing) {
			// Сохраняем полный фрагмент, чтобы кавычки остались внутри
			result.push(u('element', { tagName: 'quote' }, [u('text', full)]));
		} else {
			result.push({ type: 'text', value: full });
		}
		lastIndex = regex.lastIndex;
	}
	if (lastIndex < text.length) {
		result.push({ type: 'text', value: text.slice(lastIndex) });
	}
	return result;
}

/**
 * remarkQuotePlugin обходится по всем текстовым узлам (type: "text")
 * и заменяет найденные фрагменты с кавычками на узлы с tagName 'quote'.
 */
export function remarkQuotePlugin() {
	return (tree: Node) => {
		visit(tree, 'text', (node: TextNode, index: number | null, parent: Parent | null) => {
			if (typeof node.value === 'string') {
				const newNodes = processText(node.value);
				if (newNodes.length > 1 || (newNodes.length === 1 && (newNodes[0] as any).value !== node.value)) {
					if (parent && typeof index === 'number') {
						parent.children.splice(index, 1, ...newNodes);
					}
				}
			}
		});
	};
}
