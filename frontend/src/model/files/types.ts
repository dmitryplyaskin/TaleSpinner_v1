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
