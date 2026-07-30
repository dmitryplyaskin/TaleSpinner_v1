import { describe, expect, test } from 'vitest';

import {
	applyKindSelection,
	applyProfileSelection,
	listItems,
} from './index';

import type { SillyTavernImportKind, SillyTavernImportScanResult } from '@shared/types/sillytavern-import';

describe('sillytavern import model', () => {
	test('lists scan items and supports kind/profile selection toggles', async () => {
		const scan = makeScan();
		const initial = new Set(listItems(scan).map((item) => item.id));

		expect(listItems(scan).map((item) => item.id)).toEqual(['char-1', 'world-1', 'chat-1']);
		expect(initial.size).toBe(3);

		const withoutWorld = applyKindSelection({
			scan,
			selectedIds: initial,
			kind: 'world_info',
			checked: false,
		});
		expect(Array.from(withoutWorld).sort()).toEqual(['char-1', 'chat-1']);

		const withoutProfile = applyProfileSelection({
			scan,
			selectedIds: withoutWorld,
			profileHandle: 'default-user',
			checked: false,
		});
		expect(withoutProfile.size).toBe(0);
	});
});

function makeScan(): SillyTavernImportScanResult {
	return {
		rootPath: 'F:\\SillyTavern',
		totals: {
			character: 1,
			persona: 0,
			world_info: 1,
			instruction: 0,
			sampler: 0,
			chat: 1,
		},
		profiles: [
			{
				handle: 'default-user',
				rootRelativePath: 'data/default-user',
				unsupported: {},
				items: {
					character: [makeItem('char-1', 'character')],
					persona: [],
					world_info: [makeItem('world-1', 'world_info')],
					instruction: [],
					sampler: [],
					chat: [makeItem('chat-1', 'chat')],
				},
			},
		],
	};
}

function makeItem(id: string, kind: SillyTavernImportKind) {
	return {
		id,
		source: 'sillytavern' as const,
		kind,
		profileHandle: 'default-user',
		relativePath: `${id}.json`,
		contentHash: id,
		size: 1,
		mtimeMs: 1,
		name: id,
	};
}
