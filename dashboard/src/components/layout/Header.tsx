import { Bell, LogOut, Menu, PanelLeftClose, PanelLeftOpen, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { clearStoredApiKey } from "@/api/client";
import { cn } from "@/lib/cn";

interface HeaderProps {
  onToggleCollapse?: () => void;
  collapsed?: boolean;
  onOpenMobileDrawer?: () => void;
  connectionStatus?: "connected" | "disconnected" | "unknown";
  scopes?: string[];
}

export function Header({
  onToggleCollapse,
  collapsed,
  onOpenMobileDrawer,
  connectionStatus = "unknown",
  scopes = [],
}: HeaderProps) {
  const navigate = useNavigate();

  const logout = () => {
    clearStoredApiKey();
    toast.success("Sesión cerrada");
    navigate("/login", { replace: true });
  };

  return (
    <header className="h-16 border-b border-ai-border bg-white/80 backdrop-blur-md sticky top-0 z-40 flex items-center px-4 gap-3">
      {/* Mobile: hamburger */}
      <button
        type="button"
        onClick={onOpenMobileDrawer}
        className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-ai-surface"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop: collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden md:inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-ai-surface"
        aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
      >
        {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </button>

      <div className="flex-1" />

      <div
        className={cn(
          "hidden sm:flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
          connectionStatus === "connected" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
          connectionStatus === "disconnected" && "bg-red-50 text-red-700 border border-red-200",
          connectionStatus === "unknown" && "bg-slate-50 text-slate-600 border border-slate-200"
        )}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            connectionStatus === "connected" && "bg-emerald-500",
            connectionStatus === "disconnected" && "bg-red-500",
            connectionStatus === "unknown" && "bg-slate-400"
          )}
        />
        {connectionStatus === "connected" && (
          <span>API conectada{scopes.length > 0 && ` · ${scopes.join(", ")}`}</span>
        )}
        {connectionStatus === "disconnected" && <span>Sin conexión con la API</span>}
        {connectionStatus === "unknown" && <span>Configurar API Key</span>}
      </div>

      <button
        type="button"
        className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-ai-surface"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5 text-ai-text-muted" />
      </button>

      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-ai-surface"
        aria-label="Perfil"
      >
        <span className="h-8 w-8 rounded-full bg-ai-gradient flex items-center justify-center text-white">
          <User className="h-4 w-4" />
        </span>
      </button>

      <button
        type="button"
        onClick={logout}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-ai-text-muted hover:bg-ai-surface hover:text-ai-danger"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </header>
  );
}
