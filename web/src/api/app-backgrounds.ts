import { BASE_URL } from "../const";

import { apiJson } from "./api-json";
import { authFetch } from "./auth-fetch";

import type {
  AppBackgroundActiveSelection,
  AppBackgroundAsset,
  AppBackgroundCatalog,
} from "@shared/types/app-background";

type ApiEnvelope<T> = { data: T; error?: unknown };

export const APP_BACKGROUND_BACKEND_ORIGIN = BASE_URL.replace(/\/api\/?$/, "");

export async function listAppBackgrounds(): Promise<AppBackgroundCatalog> {
  return apiJson<AppBackgroundCatalog>("/app-backgrounds");
}

export async function importAppBackground(file: File): Promise<AppBackgroundAsset> {
  const form = new FormData();
  form.append("image", file);

  const response = await authFetch(`${BASE_URL}/app-backgrounds/import`, {
    method: "POST",
    body: form,
  });

  const body = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<AppBackgroundAsset>> & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(body?.error?.message ?? `HTTP error ${response.status}`);
  }

  return body.data as AppBackgroundAsset;
}

export async function setActiveAppBackground(
  activeBackgroundId: string | null
): Promise<AppBackgroundActiveSelection> {
  return apiJson<AppBackgroundActiveSelection>("/app-backgrounds/active", {
    method: "PUT",
    body: JSON.stringify({ activeBackgroundId }),
  });
}

export async function deleteAppBackground(
  id: string
): Promise<AppBackgroundActiveSelection & { deletedId: string }> {
  return apiJson<AppBackgroundActiveSelection & { deletedId: string }>(
    `/app-backgrounds/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );
}

export function toAbsoluteAppBackgroundUrl(imageUrl: string): string {
  return imageUrl.startsWith("http") ? imageUrl : `${APP_BACKGROUND_BACKEND_ORIGIN}${imageUrl}`;
}
