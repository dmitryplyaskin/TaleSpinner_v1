import { describe, expect, it } from 'vitest';

import { resolveOperationWorkspaceMode, shouldShowBlockSettings } from './operation-workspace-mode';

describe('operation-workspace-mode', () => {
	it('uses the split workspace whenever the large layout is available', () => {
		expect(
			resolveOperationWorkspaceMode({
				useSplitLayout: true,
				compactView: 'list',
				selectedOpId: null,
			}),
		).toBe('split');
	});

	it('opens the selected operation as a focused compact screen', () => {
		expect(
			resolveOperationWorkspaceMode({
				useSplitLayout: false,
				compactView: 'inspector',
				selectedOpId: 'operation-1',
			}),
		).toBe('inspector');
	});

	it('falls back to the compact list when no operation is selected', () => {
		expect(
			resolveOperationWorkspaceMode({
				useSplitLayout: false,
				compactView: 'inspector',
				selectedOpId: null,
			}),
		).toBe('list');
	});

	it('keeps block settings out of the focused compact inspector', () => {
		expect(shouldShowBlockSettings('list')).toBe(true);
		expect(shouldShowBlockSettings('split')).toBe(true);
		expect(shouldShowBlockSettings('inspector')).toBe(false);
	});
});
