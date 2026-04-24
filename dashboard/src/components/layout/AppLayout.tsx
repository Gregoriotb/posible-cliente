import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useMe } from "@/hooks/useAdmin";
import { getStoredApiKey } from "@/api/client";
import { Header } from "./Header";
import { MobileDrawer } from "./MobileDrawer";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasKey = !!getStoredApiKey();
  const { data, isError } = useMe(hasKey);

  const status: "connected" | "disconnected" | "unknown" = !hasKey
    ? "unknown"
    : isError
      ? "disconnected"
      : data
        ? "connected"
        : "unknown";

  return (
    <div className="flex h-screen bg-ai-surface">
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} />
      </div>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleCollapse={() => setCollapsed((c) => !c)}
          collapsed={collapsed}
          onOpenMobileDrawer={() => setDrawerOpen(true)}
          connectionStatus={status}
          scopes={data?.scopes ?? []}
        />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
