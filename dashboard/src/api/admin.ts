import axios from "axios";
import { api } from "./client";
import type { ApiKey, ApiKeyCreated, Scope } from "./types";

export interface LoginResponse {
  api_key: string;
  username: string;
}

const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export async function login(username: string, password: string): Promise<LoginResponse> {
  // Usamos axios directo (sin el interceptor global) para que un 401 por
  // credenciales inválidas no dispare el toast de "API Key inválida".
  const { data } = await axios.post<LoginResponse>(
    `${API_BASE}/v1/auth/login`,
    { username, password },
    { timeout: 10_000 }
  );
  return data;
}

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
