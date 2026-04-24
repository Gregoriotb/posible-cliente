import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { toast } from "sonner";

const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export const API_KEY_STORAGE = "artf_admin_key";

export function getStoredApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE);
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function clearStoredApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE);
}

export const api = axios.create({
  baseURL: `${API_BASE}/v1`,
  timeout: 20_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const key = getStoredApiKey();
  if (key) {
    config.headers.set("X-API-Key", key);
  }
  config.headers.set("Content-Type", "application/json");
  config.headers.set("Accept", "application/json");
  return config;
});

let didToast401 = false;

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ detail?: unknown }>) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const detailStr = typeof detail === "string" ? detail : JSON.stringify(detail);

    if (status === 401) {
      if (!didToast401) {
        didToast401 = true;
        setTimeout(() => (didToast401 = false), 3000);
        toast.error("API Key inválida. Revisa Configuración.", { duration: 4000 });
      }
    } else if (status === 403) {
      toast.error(`Permisos insuficientes: ${detailStr}`);
    } else if (status === 429) {
      toast.warning("Rate limit excedido. Intenta en unos segundos.");
    } else if (status && status >= 500) {
      toast.error("Error del servidor. Intenta de nuevo.");
    } else if (!error.response) {
      toast.error("Sin conexión con el backend. ¿Está corriendo en VITE_API_URL?");
    }
    return Promise.reject(error);
  }
);
