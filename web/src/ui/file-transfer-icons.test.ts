import { describe, expect, it } from 'vitest';

import { DownloadSimpleIcon, UploadSimpleIcon } from '@ui/icons';

import { getFileTransferIcon } from './file-transfer-icons';

describe('getFileTransferIcon', () => {
	it('uses the incoming icon for imports', () => {
		expect(getFileTransferIcon('import')).toBe(DownloadSimpleIcon);
	});

	it('uses the outgoing icon for exports', () => {
		expect(getFileTransferIcon('export')).toBe(UploadSimpleIcon);
	});
});
