import { AlertOctagon, ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { BudgetPriority } from "@/lib/status";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/status";
import { cn } from "@/lib/cn";

const ICON: Record<BudgetPriority, React.ElementType> = {
  low: ArrowDown,
  medium: Minus,
  high: ArrowUp,
  urgent: AlertOctagon,
};

export function PriorityBadge({ priority }: { priority: BudgetPriority }) {
  const Icon = ICON[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", PRIORITY_COLORS[priority])}>
      <Icon className="h-3 w-3" />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
