import { useRef } from 'react';
import { LuUpload } from 'react-icons/lu';

import { importEntityProfilesFx } from '@model/chat-core';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';

export const Upload = () => {
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const handleFileChange = async (files: FileList | null) => {
		if (!files?.length) return;

		try {
			const arr = Array.from(files);
			if (arr.length > 10) {
				toaster.error({ title: 'Слишком много файлов (максимум 10)' });
				return;
			}
			const tooLarge = arr.find((f) => f.size > 10 * 1024 * 1024);
			if (tooLarge) {
				toaster.error({ title: 'Файл слишком большой (максимум 10MB)' });
				return;
			}

			importEntityProfilesFx(arr);
		} catch {
			toaster.error({ title: 'Не удалось загрузить файлы' });
		}
		if (fileInputRef.current) fileInputRef.current.value = '';
	};

	return (
		<>
			<input
				ref={fileInputRef}
				type="file"
				style={{ display: 'none' }}
				multiple
				accept=".png,image/png"
				onChange={(e) => handleFileChange(e.currentTarget.files)}
			/>
			<IconButtonWithTooltip
				icon={<LuUpload />}
				tooltip="Импорт"
				aria-label="Импорт"
				variant="ghost"
				onClick={() => fileInputRef.current?.click()}
			/>
		</>
	);
};
