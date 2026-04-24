import type { BudgetStatus } from "@/lib/status";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/status";
import { cn } from "@/lib/cn";

export function StatusBadge({ status, className }: { status: BudgetStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap",
        STATUS_COLORS[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
