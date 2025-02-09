export interface UploadedFile {
	originalName: string;
	filename: string;
	size: number;
	mimetype: string;
}

export interface UploadResponse {
	files: UploadedFile[];
	message: string;
}

export interface CardMetadata {
	width: number;
	height: number;
	format: string;
}

export interface ProcessedCardFile {
	originalName: string;
	filename: string;
	path: string;
	metadata: CardMetadata;
	characterData: Record<string, any>[];
	type: 'png' | 'json';
}

export interface CardUploadResponse {
	processedFiles: ProcessedCardFile[];
	failedFiles: Array<{
		originalName: string;
		error: string;
	}>;
	message: string;
}
