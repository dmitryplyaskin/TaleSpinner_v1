import { apiJson } from './api-json';

import type {
	SillyTavernImportRequest,
	SillyTavernImportResult,
	SillyTavernImportScanRequest,
	SillyTavernImportScanResult,
} from '@shared/types/sillytavern-import';

export async function scanSillyTavernImport(params: SillyTavernImportScanRequest): Promise<SillyTavernImportScanResult> {
	return apiJson<SillyTavernImportScanResult>('/sillytavern-import/scan', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

export async function importSillyTavernSelection(params: SillyTavernImportRequest): Promise<SillyTavernImportResult> {
	return apiJson<SillyTavernImportResult>('/sillytavern-import/import', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}
