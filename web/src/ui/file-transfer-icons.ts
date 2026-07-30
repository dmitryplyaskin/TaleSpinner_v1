import { DownloadSimpleIcon, UploadSimpleIcon } from '@ui/icons';

export type FileTransferAction = 'import' | 'export';

export const IMPORT_FILE_ICON = DownloadSimpleIcon;
export const EXPORT_FILE_ICON = UploadSimpleIcon;

export function getFileTransferIcon(action: FileTransferAction) {
	return action === 'import' ? IMPORT_FILE_ICON : EXPORT_FILE_ICON;
}
