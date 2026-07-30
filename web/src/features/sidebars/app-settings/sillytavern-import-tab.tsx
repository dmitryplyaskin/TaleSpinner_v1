import {
	Alert,
	Badge,
	Button,
	Checkbox,
	Group,
	Paper,
	ScrollArea,
	Stack,
	Text,
	TextInput,
	Title,
} from '@mantine/core';
import { useUnit } from 'effector-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuDownload, LuRefreshCw } from 'react-icons/lu';

import {
	$sillyTavernImportResult,
	$sillyTavernImportError,
	$sillyTavernIsBusy,
	$sillyTavernRootPath,
	$sillyTavernScanError,
	$sillyTavernScanResult,
	$sillyTavernSelectedCount,
	$sillyTavernSelectedItemIds,
	SILLYTAVERN_IMPORT_KINDS,
	importSillyTavernSelectionFx,
	listItems,
	listProfileItems,
	scanSillyTavernImportFx,
	sillyTavernImportRequested,
	sillyTavernItemToggled,
	sillyTavernKindToggled,
	sillyTavernProfileToggled,
	sillyTavernRootChanged,
	sillyTavernScanRequested,
} from '@model/sillytavern-import';

import type { SillyTavernImportKind, SillyTavernImportScanItem } from '@shared/types/sillytavern-import';

function isEverySelected(items: SillyTavernImportScanItem[], selected: Set<string>): boolean {
	return items.length > 0 && items.every((item) => selected.has(item.id));
}

function isSomeSelected(items: SillyTavernImportScanItem[], selected: Set<string>): boolean {
	return items.some((item) => selected.has(item.id));
}

export const SillyTavernImportTab = () => {
	const { t } = useTranslation();
	const [
		rootPath,
		scan,
		selectedIds,
		selectedCount,
		importResult,
		isBusy,
		scanPending,
		importPending,
		scanError,
		importError,
	] = useUnit([
		$sillyTavernRootPath,
		$sillyTavernScanResult,
		$sillyTavernSelectedItemIds,
		$sillyTavernSelectedCount,
		$sillyTavernImportResult,
		$sillyTavernIsBusy,
		scanSillyTavernImportFx.pending,
		importSillyTavernSelectionFx.pending,
		$sillyTavernScanError,
		$sillyTavernImportError,
	]);

	const allItems = useMemo(() => listItems(scan), [scan]);
	const scanErrorText = scanError;
	const importErrorText = importError;

	return (
		<Stack gap="md">
			<Paper withBorder p="md" radius="sm">
				<Stack gap="sm">
					<TextInput
						label={t('appSettings.sillytavern.rootPath')}
						value={rootPath}
						onChange={(event) => sillyTavernRootChanged(event.currentTarget.value)}
						disabled={isBusy}
					/>
					<Group gap="xs">
						<Button leftSection={<LuRefreshCw size={16} />} loading={scanPending} disabled={!rootPath.trim()} onClick={() => sillyTavernScanRequested()}>
							{t('appSettings.sillytavern.actions.scan')}
						</Button>
						<Button
							leftSection={<LuDownload size={16} />}
							loading={importPending}
							disabled={!scan || selectedCount === 0 || isBusy}
							onClick={() => sillyTavernImportRequested()}
						>
							{t('appSettings.sillytavern.actions.importSelected')}
						</Button>
						<Badge variant="light">{t('appSettings.sillytavern.selectedCount', { count: selectedCount })}</Badge>
					</Group>
				</Stack>
			</Paper>

			{scanErrorText ? <Alert color="red">{scanErrorText}</Alert> : null}
			{importErrorText ? <Alert color="red">{importErrorText}</Alert> : null}

			{scan ? (
				<Paper withBorder p="md" radius="sm">
					<Stack gap="md">
						<Group justify="space-between">
							<Title order={5}>{t('appSettings.sillytavern.scanTitle')}</Title>
							<Text size="xs" c="dimmed">
								{t('appSettings.sillytavern.totalCount', { count: allItems.length })}
							</Text>
						</Group>

						<Group gap="xs">
							{SILLYTAVERN_IMPORT_KINDS.map((kind) => {
								const items = allItems.filter((item) => item.kind === kind);
								return (
									<Checkbox
										key={kind}
										checked={isEverySelected(items, selectedIds)}
										indeterminate={!isEverySelected(items, selectedIds) && isSomeSelected(items, selectedIds)}
										disabled={items.length === 0 || isBusy}
										label={t(`appSettings.sillytavern.kinds.${kind}`, { count: items.length })}
										onChange={(event) => sillyTavernKindToggled({ kind, checked: event.currentTarget.checked })}
									/>
								);
							})}
						</Group>

						<ScrollArea.Autosize mah={520}>
							<Stack gap="md">
								{scan.profiles.map((profile) => {
									const profileItems = listProfileItems(profile);
									return (
										<Paper key={profile.handle} withBorder p="sm" radius="sm">
											<Stack gap="sm">
												<Group justify="space-between">
													<Checkbox
														checked={isEverySelected(profileItems, selectedIds)}
														indeterminate={!isEverySelected(profileItems, selectedIds) && isSomeSelected(profileItems, selectedIds)}
														disabled={profileItems.length === 0 || isBusy}
														label={profile.handle}
														onChange={(event) =>
															sillyTavernProfileToggled({
																profileHandle: profile.handle,
																checked: event.currentTarget.checked,
															})
														}
													/>
													<Badge variant="outline">{profileItems.length}</Badge>
												</Group>

												{SILLYTAVERN_IMPORT_KINDS.map((kind: SillyTavernImportKind) => {
													const items = profile.items[kind];
													if (items.length === 0) return null;
													return (
														<Stack key={kind} gap={4}>
															<Text size="xs" fw={600} c="dimmed">
																{t(`appSettings.sillytavern.kindLabels.${kind}`)}: {items.length}
															</Text>
															{items.map((item) => (
																<Checkbox
																	key={item.id}
																	size="xs"
																	checked={selectedIds.has(item.id)}
																	disabled={isBusy}
																	label={`${item.name}${item.details ? ` - ${item.details}` : ''}`}
																	onChange={(event) =>
																		sillyTavernItemToggled({
																			itemId: item.id,
																			checked: event.currentTarget.checked,
																		})
																	}
																/>
															))}
														</Stack>
													);
												})}
											</Stack>
										</Paper>
									);
								})}
							</Stack>
						</ScrollArea.Autosize>
					</Stack>
				</Paper>
			) : null}

			{importResult ? (
				<Paper withBorder p="md" radius="sm">
					<Stack gap="xs">
						<Title order={5}>{t('appSettings.sillytavern.resultTitle')}</Title>
						<Text size="sm">
							{t('appSettings.sillytavern.resultSummary', {
								created: importResult.created.length,
								skipped: importResult.skipped.length,
								failed: importResult.failed.length,
							})}
						</Text>
						{importResult.failed.slice(0, 8).map((item) => (
							<Text key={`${item.kind}:${item.itemId}`} size="xs" c="red">
								{item.name}: {item.error}
							</Text>
						))}
					</Stack>
				</Paper>
			) : null}
		</Stack>
	);
};
