import { Search, X } from "lucide-react";
import { ALL_PRIORITIES, ALL_SOURCES, ALL_STATUSES, PRIORITY_LABELS, SOURCE_LABELS, STATUS_LABELS } from "@/lib/status";
import type { BudgetPriority, BudgetSource, BudgetStatus } from "@/lib/status";

export interface FiltersValue {
  search?: string;
  status?: BudgetStatus;
  priority?: BudgetPriority;
  source?: BudgetSource;
  assigned_to?: string;
}

export function BudgetFilters({
  value,
  onChange,
}: {
  value: FiltersValue;
  onChange: (v: FiltersValue) => void;
}) {
  const hasAny = Object.values(value).some((v) => v !== undefined && v !== "");

  return (
    <div className="flex flex-wrap gap-2 items-center bg-white border border-ai-border rounded-lg p-3 sticky top-0 z-10">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ai-text-muted" />
        <input
          type="search"
          value={value.search ?? ""}
          onChange={(e) => onChange({ ...value, search: e.target.value || undefined })}
          placeholder="Buscar por cliente, empresa, descripción..."
          className="w-full pl-9 pr-3 py-2 border border-ai-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ai-primary"
        />
      </div>

      <Select
        value={value.status ?? ""}
        onChange={(v) => onChange({ ...value, status: (v as BudgetStatus) || undefined })}
        placeholder="Estado"
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </Select>

      <Select
        value={value.priority ?? ""}
        onChange={(v) => onChange({ ...value, priority: (v as BudgetPriority) || undefined })}
        placeholder="Prioridad"
      >
        {ALL_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </Select>

      <Select
        value={value.source ?? ""}
        onChange={(v) => onChange({ ...value, source: (v as BudgetSource) || undefined })}
        placeholder="Fuente"
      >
        {ALL_SOURCES.map((s) => (
          <option key={s} value={s}>
            {SOURCE_LABELS[s]}
          </option>
        ))}
      </Select>

      {hasAny && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="inline-flex items-center gap-1 text-xs text-ai-text-muted hover:text-ai-text px-2 py-1"
        >
          <X className="h-3 w-3" /> Limpiar
        </button>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-ai-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ai-primary"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}
