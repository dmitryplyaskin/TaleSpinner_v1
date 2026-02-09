import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, type AvatarProps } from '@mantine/core';

import { toaster } from '@ui/toaster';

import { BASE_URL } from '../../const';

type LegacySize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

function mapSize(size: LegacySize | number | undefined): number {
	if (typeof size === 'number') return size;
	switch (size) {
		case 'xs':
			return 24;
		case 'sm':
			return 32;
		case 'md':
			return 40;
		case 'lg':
			return 48;
		case 'xl':
			return 64;
		case '2xl':
			return 80;
		default:
			return 64;
	}
}

export interface AvatarUploadProps extends Omit<AvatarProps, 'src' | 'size'> {
	size?: LegacySize | number;
	/**
	 * URL аватара
	 */
	src?: string;

	/**
	 * Функция, вызываемая при успешной загрузке аватара
	 * @param avatarUrl URL загруженного аватара
	 */
	onAvatarChange?: (avatarUrl: string) => void;

	/**
	 * Папка для сохранения аватара на сервере
	 */
	saveFolder?: string;

	/**
	 * Показывать ли кнопки управления (загрузка, удаление)
	 */
	showControls?: boolean;

	/**
	 * Базовый URL для отображения аватара
	 */
	baseUrl?: string;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
	src,
	onAvatarChange,
	saveFolder,
	baseUrl = 'http://localhost:5000',
	size,
	...avatarProps
}) => {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		if (!e.target.files || e.target.files.length === 0) return;

		const file = e.target.files[0];
		if (!file.type.startsWith('image/')) {
			toaster.error({
				title: t('avatar.toasts.errorTitle'),
				description: t('avatar.toasts.uploadImageOnly'),
			});
			return;
		}

		const formData = new FormData();
		formData.append('image', file);
		if (saveFolder) {
			formData.append('folder', saveFolder);
		}

		try {
			const response = await fetch(`${BASE_URL}/files/upload-image`, {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				throw new Error(t('avatar.toasts.uploadFileError'));
			}

			const result = await response.json();
			if (result.data && result.data.file) {
				const avatarUrl = result.data.path;

				if (onAvatarChange) {
					onAvatarChange(avatarUrl);
				}

				toaster.success({
					title: t('avatar.toasts.successTitle'),
					description: t('avatar.toasts.avatarUploaded'),
				});
			}
		} catch (error) {
			toaster.error({
				title: t('avatar.toasts.errorTitle'),
				description: t('avatar.toasts.avatarUploadFailed'),
			});
			console.error('Avatar upload error:', error);
		}
	};

	const handleAvatarClick = () => {
		fileInputRef.current?.click();
	};

	const fullSrc = src ? (src.startsWith('http') ? src : `${baseUrl}${src}`) : undefined;

	return (
		<>
			<Avatar
				{...avatarProps}
				size={mapSize(size)}
				src={fullSrc}
				onClick={handleAvatarClick}
				style={{ cursor: 'pointer', ...(avatarProps.style ?? {}) }}
			/>

			<input
				type="file"
				ref={fileInputRef}
				style={{ display: 'none' }}
				accept="image/*"
				onChange={handleAvatarUpload}
			/>
		</>
	);
};
