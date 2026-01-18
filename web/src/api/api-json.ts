import { BASE_URL } from "../const";

type ApiEnvelope<T> = { data: T; error?: unknown };

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = (await res.json().catch(() => ({}))) as Partial<ApiEnvelope<T>> & {
    error?: { message?: string };
  };

  if (!res.ok) {
    const message = body?.error?.message ?? `HTTP error ${res.status}`;
    throw new Error(message);
  }

  return body.data as T;
}

