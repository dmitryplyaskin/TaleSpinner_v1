import { combine, createEffect, createEvent, createStore, sample } from "effector";

import {
  createUiThemePreset,
  deleteUiThemePreset,
  exportUiThemePreset,
  getUiThemeSettings,
  importUiThemePresets,
  listUiThemePresets,
  patchUiThemeSettings,
  updateUiThemePreset,
  type UiThemePresetDto,
  type UiThemeSettingsDto,
} from "../../api/ui-theme";
import i18n from "../../i18n";
import { toaster } from "../../ui/toaster";

import type {
  UiThemeColorScheme,
  UiThemeExportV1,
  UiThemePresetPayload,
} from "@shared/types/ui-theme";

const OWNER_ID = "global";

export const loadUiThemePresetsFx = createEffect(async (): Promise<UiThemePresetDto[]> => {
  return listUiThemePresets(OWNER_ID);
});

export const loadUiThemeSettingsFx = createEffect(async (): Promise<UiThemeSettingsDto> => {
  return getUiThemeSettings(OWNER_ID);
});

export const createUiThemePresetFx = createEffect(
  async (input: { name: string; description?: string; payload: UiThemePresetPayload }) => {
    return createUiThemePreset({ ownerId: OWNER_ID, ...input });
  }
);

export const updateUiThemePresetFx = createEffect(
  async (input: { presetId: string; name?: string; description?: string | null; payload?: UiThemePresetPayload }) => {
    return updateUiThemePreset({ ownerId: OWNER_ID, ...input });
  }
);

export const deleteUiThemePresetFx = createEffect(async (presetId: string) => {
  return deleteUiThemePreset({ ownerId: OWNER_ID, presetId });
});

export const exportUiThemePresetFx = createEffect(async (presetId: string): Promise<UiThemeExportV1> => {
  return exportUiThemePreset({ ownerId: OWNER_ID, presetId });
});

export const importUiThemePresetsFx = createEffect(
  async (items: UiThemeExportV1 | UiThemeExportV1[]): Promise<{ created: UiThemePresetDto[] }> => {
    return importUiThemePresets({ ownerId: OWNER_ID, items });
  }
);

export const patchUiThemeSettingsFx = createEffect(
  async (input: { activePresetId?: string | null; colorScheme?: UiThemeColorScheme }) => {
    return patchUiThemeSettings({ ownerId: OWNER_ID, ...input });
  }
);

export const uiThemeReloadRequested = createEvent();

export const $uiThemePresets = createStore<UiThemePresetDto[]>([]).on(
  loadUiThemePresetsFx.doneData,
  (_, payload) => payload
);

export const $uiThemeSettings = createStore<UiThemeSettingsDto | null>(null)
  .on(loadUiThemeSettingsFx.doneData, (_, payload) => payload)
  .on(patchUiThemeSettingsFx.doneData, (_, payload) => payload);

export const $activeUiThemePreset = combine(
  $uiThemePresets,
  $uiThemeSettings,
  (presets, settings): UiThemePresetDto | null => {
    if (!settings) return presets[0] ?? null;
    return presets.find((x) => x.presetId === settings.activePresetId) ?? presets[0] ?? null;
  }
);

sample({
  clock: uiThemeReloadRequested,
  target: [loadUiThemePresetsFx, loadUiThemeSettingsFx],
});

sample({
  clock: [
    createUiThemePresetFx.doneData,
    updateUiThemePresetFx.doneData,
    deleteUiThemePresetFx.doneData,
    importUiThemePresetsFx.doneData,
  ],
  target: [loadUiThemePresetsFx, loadUiThemeSettingsFx],
});

createUiThemePresetFx.doneData.watch((preset) => {
  toaster.success({ title: i18n.t("appSettings.theming.toasts.presetCreated"), description: preset.name });
});
createUiThemePresetFx.failData.watch((error) => {
  toaster.error({
    title: i18n.t("appSettings.theming.toasts.createFailed"),
    description: error instanceof Error ? error.message : String(error),
  });
});
updateUiThemePresetFx.doneData.watch((preset) => {
  toaster.success({ title: i18n.t("appSettings.theming.toasts.presetSaved"), description: preset.name });
});
updateUiThemePresetFx.failData.watch((error) => {
  toaster.error({
    title: i18n.t("appSettings.theming.toasts.saveFailed"),
    description: error instanceof Error ? error.message : String(error),
  });
});
deleteUiThemePresetFx.doneData.watch(() => {
  toaster.success({ title: i18n.t("appSettings.theming.toasts.presetDeleted") });
});
deleteUiThemePresetFx.failData.watch((error) => {
  toaster.error({
    title: i18n.t("appSettings.theming.toasts.deleteFailed"),
    description: error instanceof Error ? error.message : String(error),
  });
});
importUiThemePresetsFx.doneData.watch((payload) => {
  toaster.success({
    title: i18n.t("appSettings.theming.toasts.importDone"),
    description: i18n.t("appSettings.theming.toasts.importedCount", { count: payload.created.length }),
  });
});
importUiThemePresetsFx.failData.watch((error) => {
  toaster.error({
    title: i18n.t("appSettings.theming.toasts.importFailed"),
    description: error instanceof Error ? error.message : String(error),
  });
});
