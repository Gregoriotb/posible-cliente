import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Budget } from "@/api/types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { SourceIcon } from "@/components/shared/SourceIcon";
import { formatCurrency, formatRelative } from "@/lib/format";

interface BudgetTableProps {
  budgets: Budget[];
  page: number;
  totalPages: number;
  total: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onSelect: (id: string) => void;
}

export function BudgetTable({
  budgets,
  page,
  totalPages,
  total,
  loading,
  onPageChange,
  onSelect,
}: BudgetTableProps) {
  if (loading) {
    return <SkeletonTable />;
  }
  if (budgets.length === 0) {
    return (
      <div className="bg-white border border-ai-border rounded-xl p-10 text-center">
        <p className="text-ai-text-muted">No hay presupuestos que coincidan con tus filtros.</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-ai-border rounded-xl overflow-hidden">
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ai-surface text-ai-text-muted text-xs uppercase tracking-wider">
            <tr>
              <Th>Cliente</Th>
              <Th>Servicio</Th>
              <Th className="text-right">Monto</Th>
              <Th>Estado</Th>
              <Th>Prioridad</Th>
              <Th>Fuente</Th>
              <Th>Recibido</Th>
              <Th>Asignado</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ai-border">
            {budgets.map((b) => (
              <tr
                key={b.id}
                onClick={() => onSelect(b.id)}
                className="hover:bg-ai-surface/60 cursor-pointer transition-colors"
              >
                <Td>
                  <div className="font-medium text-ai-text">{b.client_name}</div>
                  <div className="text-xs text-ai-text-muted">
                    {b.client_company ?? b.client_email}
                  </div>
                </Td>
                <Td>{b.service_type}</Td>
                <Td className="text-right tabular-nums font-semibold">
                  {formatCurrency(b.estimated_amount, b.currency)}
                </Td>
                <Td>
                  <StatusBadge status={b.status} />
                </Td>
                <Td>
                  <PriorityBadge priority={b.priority} />
                </Td>
                <Td>
                  <SourceIcon source={b.source} />
                </Td>
                <Td className="text-ai-text-muted text-xs">{formatRelative(b.created_at)}</Td>
                <Td className="text-ai-text-muted">{b.assigned_to ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards apiladas */}
      <ul className="md:hidden divide-y divide-ai-border">
        {budgets.map((b) => (
          <li
            key={b.id}
            onClick={() => onSelect(b.id)}
            className="p-4 cursor-pointer hover:bg-ai-surface/60"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-ai-text truncate">{b.client_name}</div>
                <div className="text-xs text-ai-text-muted truncate">
                  {b.client_company ?? b.client_email} · {b.service_type}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold tabular-nums">
                  {formatCurrency(b.estimated_amount, b.currency)}
                </div>
                <div className="text-xs text-ai-text-muted">{formatRelative(b.created_at)}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <StatusBadge status={b.status} />
              <PriorityBadge priority={b.priority} />
              <SourceIcon source={b.source} showLabel />
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-ai-border px-4 py-3 text-sm">
          <span className="text-ai-text-muted">
            Página {page} de {totalPages} · {total} presupuestos
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1 border border-ai-border rounded-md hover:bg-ai-surface disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1 border border-ai-border rounded-md hover:bg-ai-surface disabled:opacity-40"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-4 py-2 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function SkeletonTable() {
  return (
    <div className="bg-white border border-ai-border rounded-xl p-6 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 bg-ai-surface rounded animate-pulse" />
      ))}
    </div>
  );
}
