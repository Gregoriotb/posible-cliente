import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { KanbanSquare, TableProperties } from "lucide-react";
import { BudgetFilters, type FiltersValue } from "@/components/budgets/BudgetFilters";
import { BudgetTable } from "@/components/budgets/BudgetTable";
import { BudgetKanban } from "@/components/budgets/BudgetKanban";
import { BudgetDetailSlideOver } from "@/components/budgets/BudgetDetailSlideOver";
import { useBudgets } from "@/hooks/useBudgets";
import { cn } from "@/lib/cn";

type View = "table" | "kanban";

export function BudgetListPage() {
  const [view, setView] = useState<View>("table");
  const [filters, setFilters] = useState<FiltersValue>({});
  const [page, setPage] = useState(1);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("budget");

  const query = useBudgets({
    ...filters,
    page,
    limit: view === "kanban" ? 100 : 20,
    sort_by: "created_at",
    sort_order: "desc",
  });

  const setSelected = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("budget", id);
    else next.delete("budget");
    setParams(next, { replace: true });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-ai-text">Presupuestos</h1>
          <p className="text-ai-text-muted text-sm mt-1">
            {query.data ? `${query.data.meta.total} resultados` : "Cargando..."}
          </p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      <BudgetFilters
        value={filters}
        onChange={(v) => {
          setFilters(v);
          setPage(1);
        }}
      />

      {view === "table" && query.data && (
        <BudgetTable
          budgets={query.data.data}
          page={query.data.meta.page}
          totalPages={query.data.meta.total_pages}
          total={query.data.meta.total}
          loading={query.isLoading}
          onPageChange={setPage}
          onSelect={setSelected}
        />
      )}
      {view === "kanban" && query.data && (
        <BudgetKanban budgets={query.data.data} onSelect={setSelected} />
      )}
      {query.isLoading && !query.data && (
        <div className="bg-white border border-ai-border rounded-xl p-10 text-center text-ai-text-muted">
          Cargando presupuestos…
        </div>
      )}
      {query.isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 text-sm">
          No se pudieron cargar los presupuestos. Verifica tu API Key en Configuración.
        </div>
      )}

      <BudgetDetailSlideOver
        budgetId={selectedId}
        open={!!selectedId}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-ai-border bg-white p-0.5">
      <button
        type="button"
        onClick={() => onChange("table")}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
          view === "table" ? "bg-ai-primary text-white" : "text-ai-text-muted hover:bg-ai-surface"
        )}
      >
        <TableProperties className="h-4 w-4" /> Tabla
      </button>
      <button
        type="button"
        onClick={() => onChange("kanban")}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
          view === "kanban" ? "bg-ai-primary text-white" : "text-ai-text-muted hover:bg-ai-surface"
        )}
      >
        <KanbanSquare className="h-4 w-4" /> Kanban
      </button>
    </div>
  );
}
