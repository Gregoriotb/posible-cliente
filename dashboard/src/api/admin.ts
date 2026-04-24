import { api } from "./client";
import type { ApiKey, ApiKeyCreated, Scope } from "./types";

export async function listApiKeys(): Promise<ApiKey[]> {
  const { data } = await api.get<{ data: ApiKey[] }>("/admin/api-keys");
  return data.data;
}

export async function createApiKey(input: {
  name: string;
  scopes: Scope[];
  rate_limit_per_minute?: number;
  expires_at?: string | null;
}): Promise<ApiKeyCreated> {
  const { data } = await api.post<ApiKeyCreated>("/admin/api-keys", input);
  return data;
}

export async function revokeApiKey(id: string): Promise<void> {
  await api.delete(`/admin/api-keys/${id}`);
}

export async function rotateApiKey(id: string): Promise<ApiKeyCreated> {
  const { data } = await api.post<ApiKeyCreated>(`/admin/api-keys/${id}/rotate`);
  return data;
}

export async function me(): Promise<ApiKey> {
  const { data } = await api.get<ApiKey>("/me");
  return data;
}
