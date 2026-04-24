import { NavLink } from "react-router-dom";
import { BarChart3, FileText, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { useBudgets } from "@/hooks/useBudgets";

interface SidebarProps {
  collapsed: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ collapsed, onCloseMobile }: SidebarProps) {
  const { data: receivedCount } = useBudgets({ status: "recibido", limit: 1 });
  const receivedBadge = receivedCount?.meta.total ?? 0;

  const items = [
    { to: "/", label: "Panel", icon: LayoutDashboard, exact: true },
    { to: "/budgets", label: "Presupuestos", icon: FileText, badge: receivedBadge },
    { to: "/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/settings", label: "Configuración", icon: Settings },
  ];

  return (
    <aside
      className={cn(
        "h-full border-r border-ai-border bg-white flex flex-col transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="h-16 flex items-center px-4 border-b border-ai-border">
        <img
          src="/artificialic-logo.svg"
          alt="Artificialic"
          className={cn("transition-all", collapsed ? "h-8 w-8 object-contain" : "h-8")}
        />
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative",
                isActive
                  ? "bg-ai-primary/10 text-ai-primary"
                  : "text-ai-text-muted hover:bg-ai-surface hover:text-ai-text"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1 bottom-1 w-[3px] bg-ai-primary rounded-r" />
                )}
                <item.icon className="h-5 w-5 shrink-0" strokeWidth={2} />
                {!collapsed && (
                  <span className="flex-1 flex items-center justify-between">
                    {item.label}
                    {item.badge ? (
                      <span className="ml-auto bg-ai-primary text-white text-xs font-semibold rounded-full px-2 py-0.5 min-w-[1.5rem] text-center">
                        {item.badge}
                      </span>
                    ) : null}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 text-xs text-ai-text-muted border-t border-ai-border">
        {!collapsed && (
          <>
            <div className="font-semibold text-ai-text">Budget Platform</div>
            <div>v1.0.0 · demo</div>
          </>
        )}
      </div>
    </aside>
  );
}
