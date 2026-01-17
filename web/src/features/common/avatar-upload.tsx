import React, { useRef } from 'react';

import { Avatar, type AvatarProps } from '@ui/chakra-core-ui/avatar';
import { toaster } from '@ui/chakra-core-ui/toaster';

import { BASE_URL } from '../../const';

export interface AvatarUploadProps extends Omit<AvatarProps, 'src'> {
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
	...avatarProps
}) => {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		if (!e.target.files || e.target.files.length === 0) return;

		const file = e.target.files[0];
		if (!file.type.startsWith('image/')) {
			toaster.error({
				title: 'Ошибка',
				description: 'Пожалуйста, загрузите изображение',
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
				throw new Error('Ошибка загрузки файла');
			}

			const result = await response.json();
			if (result.data && result.data.file) {
				const avatarUrl = result.data.path;

				if (onAvatarChange) {
					onAvatarChange(avatarUrl);
				}

				toaster.success({
					title: 'Успешно',
					description: 'Аватар загружен',
				});
			}
		} catch (error) {
			toaster.error({
				title: 'Ошибка',
				description: 'Не удалось загрузить аватар',
			});
			console.error('Ошибка загрузки аватара:', error);
		}
	};

	const handleAvatarClick = () => {
		fileInputRef.current?.click();
	};

	const fullSrc = src ? (src.startsWith('http') ? src : `${baseUrl}${src}`) : undefined;

	return (
		<>
			<Avatar {...avatarProps} src={fullSrc} onClick={handleAvatarClick} cursor="pointer" />

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
