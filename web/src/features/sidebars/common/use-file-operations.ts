import { type CommonModelItemType, type CommonModelSettingsType } from '@shared/types/common-model-types';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';

import { toaster } from '@ui/toaster';

interface UseFileOperationsProps<SettingsType extends CommonModelSettingsType, ItemType extends CommonModelItemType> {
	model: {
		createItemFx: (item: ItemType) => void;
	};
	items: ItemType[];
	settings: SettingsType;
	name: string;
}

export const useFileOperations = <SettingsType extends CommonModelSettingsType, ItemType extends CommonModelItemType>({
	model,
	items,
	settings,
	name,
}: UseFileOperationsProps<SettingsType, ItemType>) => {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleExport = () => {
		if (!settings.selectedId) {
			toaster.error({
				title: t('files.toasts.exportErrorTitle'),
				description: t('files.toasts.selectForExport'),
			});
			return;
		}

		const selectedItem = items.find((item) => item.id === settings.selectedId);
		if (!selectedItem) return;

		const exportData = {
			[name]: selectedItem,
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${name}-${selectedItem.name}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleImport = () => {
		fileInputRef.current?.click();
	};

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const content = e.target?.result as string;
				const importedData = JSON.parse(content);

				if (!importedData[name]) {
					toaster.error({
						title: t('files.toasts.importErrorTitle'),
						description: t('files.toasts.missingDataForEntity', { name }),
					});
					return;
				}

				const importedItem = importedData[name] as ItemType;
				importedItem.id = uuidv4();
				model.createItemFx(importedItem);

				toaster.success({
					title: t('files.toasts.importSuccessTitle'),
					description: t('files.toasts.importSuccessDescription', { name: importedItem.name }),
				});
			} catch {
				toaster.error({
					title: t('files.toasts.importErrorTitle'),
					description: t('files.toasts.readError'),
				});
			}

			// Сбрасываем значение input, чтобы можно было загрузить тот же файл повторно
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		};
		reader.readAsText(file);
	};

	return {
		fileInputRef,
		handleExport,
		handleImport,
		handleFileChange,
	};
};
