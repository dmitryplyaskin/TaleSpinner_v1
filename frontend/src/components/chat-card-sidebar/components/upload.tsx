import { FileUploadTrigger } from '@ui/chakra-core-ui/file-upload';

import { FileUploadFileAcceptDetails, FileUploadRootProvider, useFileUpload } from '@chakra-ui/react';
import { uploadCardFilesFx } from '@model/files';
import { FileUploadRoot } from '@ui/chakra-core-ui/file-upload';
import { useUnit } from 'effector-react';
import { LuUpload } from 'react-icons/lu';
import { toaster } from '@ui/chakra-core-ui/toaster';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

export const Upload = () => {
	const fileUpload = useFileUpload({
		maxFiles: 10,
		maxFileSize: 3000,
	});
	const uploadCardFilesFn = useUnit(uploadCardFilesFx);
	const handleFileChange = async (details: FileUploadFileAcceptDetails) => {
		if (!details.files?.length) return;

		try {
			const result = await uploadCardFilesFn(Array.from(details.files));

			if (result.data.failedFiles.length > 0) {
				result.data.failedFiles.forEach(({ originalName, error }) => {
					toaster.error({
						title: `Ошибка обработки файла ${originalName}`,
						description: error,
					});
				});
			}

			if (result.data.processedFiles.length > 0) {
				toaster.success({
					title: 'Успешно',
					description: 'Файлы успешно загружены',
				});
			}
		} catch (error) {
			toaster.error({ title: 'Не удалось загрузить файлы' });
		}

		fileUpload.clearFiles();
	};

	return (
		<FileUploadRootProvider value={fileUpload}>
			<FileUploadRoot
				maxFiles={10}
				onFileAccept={handleFileChange}
				accept={{
					'image/png': ['.png'],
					'application/json': ['.json'],
				}}
			>
				<FileUploadTrigger asChild>
					<IconButtonWithTooltip
						icon={<LuUpload />}
						tooltip="Импорт"
						aria-label="Импорт"
						variant="ghost"
						onClick={handleFileChange}
					/>
				</FileUploadTrigger>
			</FileUploadRoot>
		</FileUploadRootProvider>
	);
};
