import { describe, expect, it } from 'vitest';

import { ICON_CONTEXT_VALUE, resolveIconSize } from './icon-presentation';

describe('resolveIconSize', () => {
	it('uses a readable, baseline-independent default presentation', () => {
		expect(ICON_CONTEXT_VALUE).toMatchObject({
			size: 18,
			weight: 'bold',
			style: {
				display: 'block',
				flexShrink: 0,
			},
		});
	});

	it('keeps compact action icons legible at every named size', () => {
		expect(resolveIconSize('xs')).toBe(16);
		expect(resolveIconSize('sm')).toBe(18);
		expect(resolveIconSize('md')).toBe(20);
		expect(resolveIconSize(undefined)).toBe(18);
	});

	it('respects explicit icon sizes', () => {
		expect(resolveIconSize('xs', 21)).toBe(21);
	});
});
