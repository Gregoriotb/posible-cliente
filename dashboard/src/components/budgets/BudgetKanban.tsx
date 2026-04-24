import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import type { Budget } from "@/api/types";
import { patchBudget } from "@/api/budgets";
import { useQueryClient } from "@tanstack/react-query";
import { ALL_STATUSES, STATUS_COLORS, STATUS_LABELS, requiresReason, validNextStatuses } from "@/lib/status";
import type { BudgetStatus } from "@/lib/status";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { SourceIcon } from "@/components/shared/SourceIcon";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";

export function BudgetKanban({
  budgets,
  onSelect,
}: {
  budgets: Budget[];
  onSelect: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [optimistic, setOptimistic] = useState<Record<string, BudgetStatus>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => setOptimistic({}), [budgets]);

  const grouped = new Map<BudgetStatus, Budget[]>();
  for (const s of ALL_STATUSES) grouped.set(s, []);
  for (const b of budgets) {
    const status = (optimistic[b.id] ?? b.status) as BudgetStatus;
    grouped.get(status)?.push(b);
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const budgetId = active.id as string;
    const newStatus = over.id as BudgetStatus;
    const budget = budgets.find((b) => b.id === budgetId);
    if (!budget || budget.status === newStatus) return;

    if (!validNextStatuses(budget.status).includes(newStatus)) {
      toast.error(
        `Transición inválida: ${STATUS_LABELS[budget.status]} → ${STATUS_LABELS[newStatus]}`
      );
      return;
    }

    let reason: string | undefined;
    if (requiresReason(newStatus)) {
      reason = prompt(`Razón para mover a "${STATUS_LABELS[newStatus]}":`) ?? undefined;
      if (!reason) {
        toast.info("Cambio cancelado.");
        return;
      }
    }

    setOptimistic((o) => ({ ...o, [budgetId]: newStatus }));
    try {
      await patchBudget(budgetId, { status: newStatus, reason });
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["budget", budgetId] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      toast.success(`Movido a "${STATUS_LABELS[newStatus]}"`);
    } catch {
      setOptimistic((o) => {
        const n = { ...o };
        delete n[budgetId];
        return n;
      });
    }
  };

  return (
    <div className="overflow-x-auto">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 pb-4 min-w-max">
          {ALL_STATUSES.map((status) => (
            <KanbanColumn key={status} status={status} budgets={grouped.get(status) ?? []} onSelect={onSelect} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function KanbanColumn({
  status,
  budgets,
  onSelect,
}: {
  status: BudgetStatus;
  budgets: Budget[];
  onSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-64 shrink-0 rounded-xl border bg-white/60 transition-colors",
        isOver ? "ring-2 ring-ai-primary bg-ai-primary/5" : "border-ai-border"
      )}
    >
      <div className={cn("px-3 py-2 border-b border-ai-border rounded-t-xl", STATUS_COLORS[status])}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs uppercase tracking-wider">{STATUS_LABELS[status]}</span>
          <span className="text-xs font-bold">{budgets.length}</span>
        </div>
      </div>
      <div className="p-2 space-y-2 min-h-[300px]">
        {budgets.map((b) => (
          <KanbanCard key={b.id} budget={b} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({ budget, onSelect }: { budget: Budget; onSelect: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: budget.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(budget.id)}
      className="bg-white border border-ai-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-ai-primary hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm text-ai-text truncate">{budget.client_name}</div>
          <div className="text-xs text-ai-text-muted truncate">{budget.service_type}</div>
        </div>
        <SourceIcon source={budget.source} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <PriorityBadge priority={budget.priority} />
        <span className="text-sm font-semibold tabular-nums">
          {formatCurrency(budget.estimated_amount, budget.currency)}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <StatusBadge status={budget.status} />
        {budget.assigned_to && (
          <span className="text-xs text-ai-text-muted truncate ml-2">{budget.assigned_to}</span>
        )}
      </div>
    </div>
  );
}
