import { defaultSchema } from 'rehype-sanitize';

import type { Schema } from 'hast-util-sanitize';

/**
 * Markdown/HTML in this app is user-controlled. We keep `rehype-raw` enabled,
 * but must sanitize to prevent XSS.
 *
 * NOTE: `style` is allowed intentionally (per product requirement). This does
 * not execute JS, but it can be abused to visually break UI. We mitigate some
 * layout abuse in React components (e.g. images).
 */
export const sanitizeSchema: Schema = {
	...defaultSchema,
	tagNames: Array.from(
		new Set([
			...(defaultSchema.tagNames ?? []),
			// For "direct speech" styling and other inline HTML
			'q',
			'span',
			'div',
			// Keep images/links enabled
			'img',
			'a',
		]),
	),
	attributes: {
		...defaultSchema.attributes,
		'*': Array.from(
			new Set([
				...((defaultSchema.attributes?.['*'] as string[] | undefined) ?? []),
				// Allow class/style for future user-defined styling.
				'className',
				'style',
			]),
		),
		a: Array.from(
			new Set([
				...((defaultSchema.attributes?.a as string[] | undefined) ?? []),
				'href',
				'title',
				'target',
				'rel',
			]),
		),
		img: Array.from(
			new Set([
				...((defaultSchema.attributes?.img as string[] | undefined) ?? []),
				'src',
				'alt',
				'title',
				'width',
				'height',
				'loading',
				'decoding',
			]),
		),
	},
	protocols: {
		...defaultSchema.protocols,
		href: ['http', 'https', 'mailto', 'tel'],
		// Explicitly do NOT allow `data:` (base64) images.
		src: ['http', 'https', 'blob'],
	},
};

