import { apiJson } from "./api-json";

import type {
  UiThemeColorScheme,
  UiThemeExportV1,
  UiThemePreset,
  UiThemePresetPayload,
  UiThemeSettings,
} from "@shared/types/ui-theme";

type UiThemePresetDto = Omit<UiThemePreset, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type UiThemeSettingsDto = Omit<UiThemeSettings, "updatedAt"> & {
  updatedAt: string;
};

export async function listUiThemePresets(ownerId?: string): Promise<UiThemePresetDto[]> {
  const query = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : "";
  return apiJson<UiThemePresetDto[]>(`/ui-theme-presets${query}`);
}

export async function createUiThemePreset(input: {
  ownerId?: string;
  name: string;
  description?: string;
  payload: UiThemePresetPayload;
}): Promise<UiThemePresetDto> {
  return apiJson<UiThemePresetDto>("/ui-theme-presets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateUiThemePreset(input: {
  presetId: string;
  ownerId?: string;
  name?: string;
  description?: string | null;
  payload?: UiThemePresetPayload;
}): Promise<UiThemePresetDto> {
  return apiJson<UiThemePresetDto>(`/ui-theme-presets/${encodeURIComponent(input.presetId)}`, {
    method: "PUT",
    body: JSON.stringify({
      ownerId: input.ownerId,
      name: input.name,
      description: input.description,
      payload: input.payload,
    }),
  });
}

export async function deleteUiThemePreset(input: {
  presetId: string;
  ownerId?: string;
}): Promise<{ id: string }> {
  const query = input.ownerId ? `?ownerId=${encodeURIComponent(input.ownerId)}` : "";
  return apiJson<{ id: string }>(`/ui-theme-presets/${encodeURIComponent(input.presetId)}${query}`, {
    method: "DELETE",
  });
}

export async function exportUiThemePreset(input: {
  presetId: string;
  ownerId?: string;
}): Promise<UiThemeExportV1> {
  const query = input.ownerId ? `?ownerId=${encodeURIComponent(input.ownerId)}` : "";
  return apiJson<UiThemeExportV1>(`/ui-theme-presets/${encodeURIComponent(input.presetId)}/export${query}`);
}

export async function importUiThemePresets(input: {
  ownerId?: string;
  items: UiThemeExportV1 | UiThemeExportV1[];
}): Promise<{ created: UiThemePresetDto[] }> {
  return apiJson<{ created: UiThemePresetDto[] }>("/ui-theme-presets/import", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getUiThemeSettings(ownerId?: string): Promise<UiThemeSettingsDto> {
  const query = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : "";
  return apiJson<UiThemeSettingsDto>(`/ui-theme-settings${query}`);
}

export async function patchUiThemeSettings(input: {
  ownerId?: string;
  activePresetId?: string | null;
  colorScheme?: UiThemeColorScheme;
}): Promise<UiThemeSettingsDto> {
  return apiJson<UiThemeSettingsDto>("/ui-theme-settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type { UiThemePresetDto, UiThemeSettingsDto };
