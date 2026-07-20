import { BASE_URL } from "../const";

import { authFetch } from "./auth-fetch";

import type { TaleSpinnerBundleResourceKind } from "@shared/types/bundles";

type ApiEnvelope<T> = { data: T; error?: unknown };

export type BundleSelectionHandle = {
  kind: TaleSpinnerBundleResourceKind;
  id: string;
};

export type BundleImportResult = {
  sourceResourceId?: string;
  created: {
    instructions: Array<{ resourceId: string; id: string; name: string }>;
    operationBlocks: Array<{ resourceId: string; blockId: string; name: string }>;
    operationProfiles: Array<{ resourceId: string; profileId: string; name: string }>;
    worldInfoBooks: Array<{ resourceId: string; id: string; name: string }>;
    entityProfiles: Array<{ resourceId: string; id: string; name: string }>;
    uiThemePresets: Array<{ resourceId: string; presetId: string; name: string }>;
    samplerPresets: Array<{ resourceId: string; presetId: string; name: string }>;
  };
  applied: {
    instructionId: string | null;
    operationProfileId: string | null;
    uiThemePresetId: string | null;
    samplerPresetId: string | null;
    entityProfileId: string | null;
    worldInfoBookId: string | null;
  };
  skippedApply: Array<{
    kind: "instruction" | "operation_profile" | "ui_theme_preset" | "sampler_preset" | "entity_profile" | "world_info_book";
    reason: "ambiguous";
    message: string;
  }>;
  warnings: string[];
};

function sanitizeFileName(input: string): string {
  return input.replace(/[\\/:*?"<>|]+/g, "_").trim();
}

export async function exportBundle(input: {
  ownerId?: string;
  source: BundleSelectionHandle;
  selections: BundleSelectionHandle[];
  format?: "json" | "archive" | "auto";
}): Promise<{ blob: Blob; filename: string; contentType: string }> {
  const res = await authFetch(`${BASE_URL}/bundles/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ApiEnvelope<unknown>> & {
      error?: { message?: string };
    };
    throw new Error(body?.error?.message ?? `HTTP error ${res.status}`);
  }

  const blob = await res.blob();
  const contentType = res.headers.get("content-type") ?? blob.type ?? "application/octet-stream";
  const disposition = res.headers.get("content-disposition") ?? "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
  const rawName = utf8Match?.[1]
    ? decodeURIComponent(utf8Match[1])
    : plainMatch?.[1] ?? `talespinner-bundle.${contentType.includes("json") ? "json" : "tsbundle"}`;

  return {
    blob,
    filename: sanitizeFileName(rawName),
    contentType,
  };
}

export async function importBundle(file: File): Promise<BundleImportResult> {
  const form = new FormData();
  form.append("file", file);

  const res = await authFetch(`${BASE_URL}/bundles/import`, {
    method: "POST",
    body: form,
  });

  const body = (await res.json().catch(() => ({}))) as Partial<ApiEnvelope<BundleImportResult>> & {
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `HTTP error ${res.status}`);
  }
  return body.data as BundleImportResult;
}

export function downloadBlobFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
