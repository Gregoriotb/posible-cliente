import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { clearStoredApiKey, getStoredApiKey, setStoredApiKey } from "@/api/client";
import { useApiKeys, useCreateApiKey, useMe, useRevokeApiKey, useRotateApiKey } from "@/hooks/useAdmin";
import type { ApiKey, ApiKeyCreated, Scope } from "@/api/types";
import { cn } from "@/lib/cn";
import { formatDateShort, formatRelative } from "@/lib/format";

export function SettingsPage() {
  const [tab, setTab] = useState<"connection" | "keys" | "about">("connection");
  const me = useMe();
  const isAdmin = (me.data?.scopes ?? []).includes("admin");

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-2xl md:text-3xl font-bold text-ai-text">Configuración</h1>
      <p className="text-ai-text-muted mt-1">Gestiona tu conexión con la API y las API Keys emitidas.</p>

      <div className="mt-6 border-b border-ai-border flex gap-1">
        <TabBtn active={tab === "connection"} onClick={() => setTab("connection")}>
          Mi conexión
        </TabBtn>
        <TabBtn active={tab === "keys"} onClick={() => setTab("keys")} disabled={!isAdmin}>
          API Keys {isAdmin ? "" : " (requiere scope admin)"}
        </TabBtn>
        <TabBtn active={tab === "about"} onClick={() => setTab("about")}>
          Acerca
        </TabBtn>
      </div>

      <div className="mt-6">
        {tab === "connection" && <ConnectionTab />}
        {tab === "keys" && isAdmin && <ApiKeysTab />}
        {tab === "about" && <AboutTab />}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
        active
          ? "border-ai-primary text-ai-primary"
          : "border-transparent text-ai-text-muted hover:text-ai-text",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

function ConnectionTab() {
  const [input, setInput] = useState(() => getStoredApiKey() ?? "");
  const me = useMe(!!input);
  const qc = useQueryClient();

  const save = () => {
    const trimmed = input.trim();
    if (!trimmed.startsWith("artf_")) {
      toast.error("La API Key debe comenzar con artf_live_ o artf_test_");
      return;
    }
    setStoredApiKey(trimmed);
    qc.invalidateQueries({ queryKey: ["me"] });
    toast.success("API Key guardada. Probando conexión...");
  };

  const clear = () => {
    clearStoredApiKey();
    setInput("");
    qc.invalidateQueries({ queryKey: ["me"] });
    toast.info("API Key eliminada.");
  };

  return (
    <section className="space-y-6">
      <div className="bg-white rounded-xl border border-ai-border p-5">
        <h2 className="font-semibold text-ai-text flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-ai-secondary" />
          Admin API Key
        </h2>
        <p className="text-sm text-ai-text-muted mt-1">
          Pega aquí tu admin key. Se guarda en localStorage (solo en este navegador) y se envía como{" "}
          <code className="bg-ai-surface px-1 rounded">X-API-Key</code> en cada request.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="artf_live_..."
            className="flex-1 border border-ai-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ai-primary"
          />
          <button
            onClick={save}
            className="inline-flex items-center justify-center px-4 py-2 bg-ai-primary text-white text-sm font-medium rounded-md hover:bg-ai-primary-dark transition-colors"
          >
            Guardar y probar
          </button>
          {input && (
            <button
              onClick={clear}
              className="inline-flex items-center justify-center px-4 py-2 border border-ai-border text-ai-text-muted text-sm font-medium rounded-md hover:bg-ai-surface"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {me.data && (
        <div className="bg-white rounded-xl border border-ai-border p-5">
          <h3 className="font-semibold text-ai-text flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-ai-primary" /> Conectado
          </h3>
          <dl className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Row label="Nombre" value={me.data.name} />
            <Row label="Prefijo" value={<code className="bg-ai-surface px-1 rounded">{me.data.prefix}…</code>} />
            <Row
              label="Scopes"
              value={
                <div className="flex flex-wrap gap-1">
                  {me.data.scopes.map((s) => (
                    <span key={s} className="bg-ai-primary/10 text-ai-primary text-xs px-2 py-0.5 rounded">
                      {s}
                    </span>
                  ))}
                </div>
              }
            />
            <Row label="Rate limit" value={`${me.data.rate_limit_per_minute} req/min`} />
            <Row
              label="Último uso"
              value={me.data.last_used_at ? formatRelative(me.data.last_used_at) : "—"}
            />
            <Row label="Creada" value={formatDateShort(me.data.created_at)} />
          </dl>
        </div>
      )}

      {me.isError && input && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-800 text-sm">
          No se pudo validar la API Key. Revisa que sea correcta y que el backend esté corriendo en{" "}
          <code>{import.meta.env.VITE_API_URL}</code>.
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ai-text-muted">{label}</dt>
      <dd className="mt-1 text-ai-text">{value}</dd>
    </div>
  );
}

function ApiKeysTab() {
  const { data: keys, isLoading } = useApiKeys();
  const [creating, setCreating] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-ai-text">API Keys emitidas</h2>
          <p className="text-sm text-ai-text-muted">
            Genera una para entregar a Artificialic (scope <code>budgets:write</code>) o al dashboard (scope read/update).
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 bg-ai-primary text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-ai-primary-dark"
        >
          <Plus className="h-4 w-4" /> Nueva Key
        </button>
      </div>

      {isLoading && <p className="text-sm text-ai-text-muted">Cargando…</p>}

      {keys && keys.length > 0 && (
        <div className="bg-white rounded-xl border border-ai-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ai-surface text-ai-text-muted text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Nombre</th>
                <th className="text-left px-4 py-2 font-semibold">Prefix</th>
                <th className="text-left px-4 py-2 font-semibold">Scopes</th>
                <th className="text-left px-4 py-2 font-semibold">Estado</th>
                <th className="text-left px-4 py-2 font-semibold">Último uso</th>
                <th className="text-right px-4 py-2 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ai-border">
              {keys.map((k) => (
                <ApiKeyRow key={k.id} apiKey={k} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CreateKeyModal onClose={() => setCreating(false)} />}
    </section>
  );
}

function ApiKeyRow({ apiKey }: { apiKey: ApiKey }) {
  const revoke = useRevokeApiKey();
  const rotate = useRotateApiKey();
  const [rotatedKey, setRotatedKey] = useState<ApiKeyCreated | null>(null);

  return (
    <>
      <tr>
        <td className="px-4 py-3 font-medium text-ai-text">{apiKey.name}</td>
        <td className="px-4 py-3 font-mono text-xs text-ai-text-muted">{apiKey.prefix}…</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {apiKey.scopes.map((s) => (
              <span key={s} className="bg-ai-primary/10 text-ai-primary text-xs px-2 py-0.5 rounded">
                {s}
              </span>
            ))}
          </div>
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              apiKey.status === "active"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            )}
          >
            {apiKey.status === "active" ? "Activa" : "Revocada"}
          </span>
        </td>
        <td className="px-4 py-3 text-ai-text-muted text-xs">
          {apiKey.last_used_at ? formatRelative(apiKey.last_used_at) : "Sin uso"}
        </td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-2">
            {apiKey.status === "active" && (
              <>
                <button
                  onClick={() => {
                    if (confirm(`¿Rotar la key "${apiKey.name}"? La vieja expira en 7 días.`)) {
                      rotate.mutate(apiKey.id, {
                        onSuccess: (data) => {
                          setRotatedKey(data);
                          toast.success("Key rotada");
                        },
                      });
                    }
                  }}
                  className="inline-flex items-center gap-1 text-xs text-ai-secondary hover:underline"
                >
                  <RefreshCw className="h-3 w-3" /> Rotar
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Revocar "${apiKey.name}"? Esta acción no es reversible.`)) {
                      revoke.mutate(apiKey.id, {
                        onSuccess: () => toast.success("Key revocada"),
                      });
                    }
                  }}
                  className="inline-flex items-center gap-1 text-xs text-ai-danger hover:underline"
                >
                  <Trash2 className="h-3 w-3" /> Revocar
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {rotatedKey && <PlaintextRevealModal created={rotatedKey} onClose={() => setRotatedKey(null)} />}
    </>
  );
}

function CreateKeyModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Scope[]>(["budgets:write"]);
  const [rateLimit, setRateLimit] = useState(60);
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  const createMut = useCreateApiKey();

  const toggle = (s: Scope) => {
    setScopes((curr) => (curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s]));
  };

  const submit = () => {
    if (!name.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    if (scopes.length === 0) {
      toast.error("Selecciona al menos un scope");
      return;
    }
    createMut.mutate(
      { name: name.trim(), scopes, rate_limit_per_minute: rateLimit },
      {
        onSuccess: (data) => {
          setCreated(data);
          toast.success("Key creada");
        },
      }
    );
  };

  if (created) {
    return <PlaintextRevealModal created={created} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-ai-border">
          <h3 className="font-semibold text-ai-text">Nueva API Key</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-ai-surface flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-ai-text">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Artificialic Production"
              className="mt-1 w-full border border-ai-border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ai-text">Scopes</label>
            <div className="mt-2 space-y-1">
              {(["budgets:write", "budgets:read", "budgets:update", "admin"] as Scope[]).map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={scopes.includes(s)}
                    onChange={() => toggle(s)}
                    className="rounded border-ai-border text-ai-primary focus:ring-ai-primary"
                  />
                  <code className="bg-ai-surface px-1.5 py-0.5 rounded text-xs">{s}</code>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-ai-text">Rate limit (req/min)</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={rateLimit}
              onChange={(e) => setRateLimit(parseInt(e.target.value, 10) || 60)}
              className="mt-1 w-full border border-ai-border rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="p-5 border-t border-ai-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-ai-text-muted hover:bg-ai-surface rounded-md"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={createMut.isPending}
            className="px-4 py-2 bg-ai-primary text-white text-sm font-medium rounded-md hover:bg-ai-primary-dark disabled:opacity-50"
          >
            {createMut.isPending ? "Creando..." : "Crear key"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlaintextRevealModal({
  created,
  onClose,
}: {
  created: ApiKeyCreated;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(created.key);
    setCopied(true);
    toast.success("Copiada al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="p-5 border-b border-ai-border">
          <h3 className="font-semibold text-ai-text flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-ai-primary" />
            Key creada: {created.name}
          </h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
            <strong>Guarda esta key ahora.</strong> No podrás recuperarla después. Si se pierde, tendrás que rotar la key.
          </div>
          <div className="flex items-center gap-2 bg-ai-surface rounded-md p-3 font-mono text-xs break-all">
            <span className="flex-1">{created.key}</span>
            <button
              onClick={copy}
              className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-ai-border hover:bg-ai-surface text-xs"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiada" : "Copiar"}
            </button>
          </div>
          <div className="text-sm text-ai-text-muted">
            Scopes: {created.scopes.join(", ")} · Rate limit: {created.rate_limit_per_minute}/min
          </div>
        </div>
        <div className="p-5 border-t border-ai-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-ai-primary text-white text-sm font-medium rounded-md hover:bg-ai-primary-dark"
          >
            Guardada, cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function AboutTab() {
  return (
    <div className="bg-white rounded-xl border border-ai-border p-5 space-y-3 text-sm">
      <h2 className="font-semibold text-ai-text">Artificialic Budget Platform</h2>
      <p className="text-ai-text-muted">
        Dashboard de gestión de presupuestos generados por chatbots IA. Consume la API REST de{" "}
        <code>{import.meta.env.VITE_API_URL}</code> vía sistema de API Keys con scopes.
      </p>
      <p className="text-ai-text-muted">
        Visita{" "}
        <a
          className="text-ai-secondary hover:underline"
          href="https://artificialic.com"
          target="_blank"
          rel="noreferrer"
        >
          artificialic.com
        </a>
      </p>
      <p className="text-xs text-ai-text-muted">Versión 1.0.0 · Demo</p>
    </div>
  );
}
