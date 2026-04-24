import { AtSign, Globe, MessageCircle, MessagesSquare } from "lucide-react";
import type { BudgetSource } from "@/lib/status";
import { SOURCE_LABELS } from "@/lib/status";

const ICON: Record<BudgetSource, React.ElementType> = {
  whatsapp: MessageCircle,
  web: Globe,
  messenger: MessagesSquare,
  email: AtSign,
};

const COLOR: Record<BudgetSource, string> = {
  whatsapp: "text-[#25D366]",
  web: "text-ai-secondary",
  messenger: "text-[#0084FF]",
  email: "text-ai-text-muted",
};

export function SourceIcon({ source, showLabel = false }: { source: BudgetSource; showLabel?: boolean }) {
  const Icon = ICON[source];
  return (
    <span className={`inline-flex items-center gap-1 ${COLOR[source]}`}>
      <Icon className="h-4 w-4" />
      {showLabel && <span className="text-xs text-ai-text-muted">{SOURCE_LABELS[source]}</span>}
    </span>
  );
}
