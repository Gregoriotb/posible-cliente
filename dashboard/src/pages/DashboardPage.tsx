import { useAnalytics } from "@/hooks/useAnalytics";
import { useBudgets } from "@/hooks/useBudgets";
import { formatCurrency } from "@/lib/format";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/status";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowUpRight, FileText, TrendingUp } from "lucide-react";
import type { BudgetStatus } from "@/lib/status";

export function DashboardPage() {
  const { data: stats } = useAnalytics("30d");
  const { data: recent } = useBudgets({ limit: 5, sort_by: "created_at", sort_order: "desc" });
  const kpis = stats?.kpis;

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-ai-text">Panel general</h1>
        <p className="text-ai-text-muted mt-1">Resumen de actividad de los últimos 30 días.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Presupuestos totales"
          value={kpis?.total_budgets ?? "—"}
          icon={<FileText className="h-5 w-5 text-ai-secondary" />}
        />
        <KpiCard
          title="Tasa de conversión"
          value={kpis ? `${(kpis.conversion_rate * 100).toFixed(1)}%` : "—"}
          icon={<TrendingUp className="h-5 w-5 text-ai-primary" />}
        />
        <KpiCard
          title="Tiempo respuesta prom."
          value={
            kpis?.avg_response_time_hours != null
              ? `${kpis.avg_response_time_hours.toFixed(1)}h`
              : "—"
          }
          icon={<AlertCircle className="h-5 w-5 text-ai-warning" />}
        />
        <KpiCard
          title="Ingresos potenciales"
          value={kpis ? formatCurrency(kpis.potential_revenue, "USD") : "—"}
          icon={<ArrowUpRight className="h-5 w-5 text-ai-accent" />}
        />
      </div>

      <div className="bg-white rounded-xl border border-ai-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ai-text">Presupuestos recientes</h2>
          <Link to="/budgets" className="text-sm text-ai-secondary hover:underline">
            Ver todos →
          </Link>
        </div>
        {recent?.data?.length ? (
          <ul className="divide-y divide-ai-border">
            {recent.data.map((b) => (
              <li key={b.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ai-text truncate">{b.client_name}</span>
                    <span className="text-ai-text-muted text-sm truncate">· {b.service_type}</span>
                  </div>
                  <div className="text-xs text-ai-text-muted">{b.external_id}</div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[b.status as BudgetStatus]}`}
                >
                  {STATUS_LABELS[b.status as BudgetStatus]}
                </span>
                <span className="text-sm font-semibold text-ai-text tabular-nums">
                  {formatCurrency(b.estimated_amount, b.currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ai-text-muted">Sin presupuestos todavía.</p>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-ai-border p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-ai-text-muted">{title}</p>
          <p className="text-2xl font-bold text-ai-text mt-2 tabular-nums">{value}</p>
        </div>
        <div className="h-9 w-9 rounded-lg bg-ai-surface flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}
