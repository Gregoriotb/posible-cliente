import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { KeyRound, LogIn } from "lucide-react";
import { login } from "@/api/admin";
import { setStoredApiKey } from "@/api/client";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Usuario y contraseña son obligatorios");
      return;
    }
    setSubmitting(true);
    try {
      const res = await login(username.trim(), password);
      setStoredApiKey(res.api_key);
      toast.success(`Bienvenido, ${res.username}`);
      navigate(from, { replace: true });
    } catch (err) {
      const status = err instanceof AxiosError ? err.response?.status : undefined;
      if (status === 401) {
        toast.error("Usuario o contraseña incorrectos");
      } else if (status === 503) {
        toast.error("Login no configurado en el backend. Contacta al administrador.");
      } else if (status === 429) {
        toast.error("Demasiados intentos. Espera un minuto.");
      } else {
        toast.error("No se pudo conectar al servidor");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ai-surface p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <img src="/artificialic-logo.svg" alt="Artificialic" className="h-10" />
        </div>

        <div className="bg-white rounded-xl border border-ai-border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="h-5 w-5 text-ai-primary" />
            <h1 className="text-lg font-semibold text-ai-text">Iniciar sesión</h1>
          </div>
          <p className="text-sm text-ai-text-muted mb-5">
            Accede al dashboard de gestión de presupuestos.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-ai-text mb-1">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                className="w-full border border-ai-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ai-primary disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ai-text mb-1">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="w-full border border-ai-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ai-primary disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-ai-primary text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-ai-primary-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <LogIn className="h-4 w-4" />
              {submitting ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-ai-text-muted">
          Artificialic Budget Platform · v1.0
        </p>
      </div>
    </div>
  );
}
