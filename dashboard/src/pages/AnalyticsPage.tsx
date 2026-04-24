import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileText, Loader2, Target, Timer, TrendingUp } from "lucide-react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { formatCurrency } from "@/lib/format";
import { STATUS_LABELS, SOURCE_LABELS, PRIORITY_LABELS } from "@/lib/status";
import type { BudgetSource, BudgetStatus, BudgetPriority } from "@/lib/status";
import { cn } from "@/lib/cn";

type Range = "today" | "7d" | "30d" | "year";

const AI_COLORS = ["#22C55E", "#3B82F6", "#8B5CF6", "#06B6D4", "#F59E0B", "#EF4444", "#16A34A", "#475569", "#94A3B8"];

export function AnalyticsPage() {
  const [range, setRange] = useState<Range>("30d");
  const { data, isLoading, isError } = useAnalytics(range);

  if (isError) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 text-sm">
          No se pudieron cargar las métricas. Verifica tu API Key en Configuración.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-ai-text">Analytics</h1>
          <p className="text-ai-text-muted text-sm mt-1">Métricas y tendencias de presupuestos.</p>
        </div>
        <RangeSwitch value={range} onChange={setRange} />
      </div>

      {isLoading && (
        <div className="text-center py-8 text-ai-text-muted">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Calculando métricas…
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total presupuestos"
              value={data.kpis.total_budgets.toString()}
              icon={<FileText className="h-5 w-5 text-ai-secondary" />}
            />
            <KpiCard
              title="Tasa de conversión"
              value={`${(data.kpis.conversion_rate * 100).toFixed(1)}%`}
              icon={<Target className="h-5 w-5 text-ai-primary" />}
            />
            <KpiCard
              title="Tiempo respuesta prom."
              value={
                data.kpis.avg_response_time_hours != null
                  ? `${data.kpis.avg_response_time_hours.toFixed(1)}h`
                  : "—"
              }
              icon={<Timer className="h-5 w-5 text-ai-warning" />}
            />
            <KpiCard
              title="Ingresos potenciales"
              value={formatCurrency(data.kpis.potential_revenue, "USD")}
              icon={<TrendingUp className="h-5 w-5 text-ai-accent" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Por estado">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.by_status.map((e) => ({
                      name: STATUS_LABELS[e.key as BudgetStatus] ?? e.key,
                      value: e.count,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={96}
                    paddingAngle={2}
                  >
                    {data.by_status.map((_, i) => (
                      <Cell key={i} fill={AI_COLORS[i % AI_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Por fuente">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  layout="vertical"
                  data={data.by_source.map((e) => ({
                    name: SOURCE_LABELS[e.key as BudgetSource] ?? e.key,
                    count: e.count,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Tendencia (recibidos vs aprobados)">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="received" name="Recibidos" stroke="#3B82F6" strokeWidth={2} />
                  <Line type="monotone" dataKey="approved" name="Aprobados" stroke="#22C55E" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top servicios">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.top_services}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="service_type"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Por prioridad">
              <ul className="divide-y divide-ai-border text-sm">
                {data.by_priority.map((e) => (
                  <li key={e.key} className="flex items-center justify-between py-2">
                    <span className="text-ai-text">
                      {PRIORITY_LABELS[e.key as BudgetPriority] ?? e.key}
                    </span>
                    <span className="font-semibold tabular-nums">{e.count}</span>
                  </li>
                ))}
              </ul>
            </ChartCard>
            <ChartCard title="Desempeño por asignado">
              <ul className="divide-y divide-ai-border text-sm">
                {data.by_assigned.map((e) => (
                  <li key={e.key} className="flex items-center justify-between py-2">
                    <span className="text-ai-text truncate">{e.key}</span>
                    <span className="font-semibold tabular-nums">{e.count}</span>
                  </li>
                ))}
              </ul>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-ai-border p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-ai-text-muted">{title}</p>
          <p className="text-2xl font-bold text-ai-text mt-2 tabular-nums">{value}</p>
        </div>
        <div className="h-9 w-9 rounded-lg bg-ai-surface flex items-center justify-center">{icon}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-ai-border p-5">
      <h3 className="font-semibold text-ai-text mb-4">{title}</h3>
      {children}
    </div>
  );
}

function RangeSwitch({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const opts: Array<{ k: Range; label: string }> = [
    { k: "today", label: "Hoy" },
    { k: "7d", label: "7d" },
    { k: "30d", label: "30d" },
    { k: "year", label: "Año" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-ai-border bg-white p-0.5">
      {opts.map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => onChange(o.k)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md transition-colors",
            value === o.k ? "bg-ai-primary text-white" : "text-ai-text-muted hover:bg-ai-surface"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
