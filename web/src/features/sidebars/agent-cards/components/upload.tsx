import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuUpload } from 'react-icons/lu';

import { importEntityProfilesFx } from '@model/chat-core';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';

import type { ImportEntityProfilesResponse } from '../../../../api/chat-core';

type UploadProps = {
	onImportFinished?: (result: ImportEntityProfilesResponse) => void;
};

export const Upload = ({ onImportFinished }: UploadProps) => {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const handleFileChange = async (files: FileList | null) => {
		if (!files?.length) return;

		try {
			const arr = Array.from(files);
			if (arr.length > 10) {
				toaster.error({ title: t('agentCards.toasts.tooManyFiles') });
				return;
			}
			const tooLarge = arr.find((f) => f.size > 10 * 1024 * 1024);
			if (tooLarge) {
				toaster.error({ title: t('agentCards.toasts.fileTooLarge') });
				return;
			}

			const result = await importEntityProfilesFx(arr);
			onImportFinished?.(result);
		} catch {
			toaster.error({ title: t('agentCards.toasts.uploadFailed') });
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
				accept=".png,.json,application/json,image/png"
				onChange={(e) => handleFileChange(e.currentTarget.files)}
			/>
			<IconButtonWithTooltip
				icon={<LuUpload />}
				tooltip={t('common.import')}
				aria-label={t('common.import')}
				variant="ghost"
				onClick={() => fileInputRef.current?.click()}
			/>
		</>
	);
};
