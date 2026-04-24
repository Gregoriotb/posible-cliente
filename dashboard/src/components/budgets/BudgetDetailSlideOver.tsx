import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ArrowRight, Calendar, Loader2, Mail, MessageSquarePlus, Phone, Tag, User, X } from "lucide-react";
import { useAddNote, useBudgetDetail, usePatchBudget } from "@/hooks/useBudgetDetail";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SourceIcon } from "@/components/shared/SourceIcon";
import { formatCurrency, formatDateShort, formatRelative } from "@/lib/format";
import {
  ALL_PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  requiresReason,
  validNextStatuses,
} from "@/lib/status";
import type { BudgetPriority, BudgetStatus } from "@/lib/status";
import { cn } from "@/lib/cn";

interface Props {
  budgetId: string | null;
  open: boolean;
  onClose: () => void;
}

export function BudgetDetailSlideOver({ budgetId, open, onClose }: Props) {
  const { data: budget, isLoading } = useBudgetDetail(budgetId);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30 animate-fade-in" onClick={onClose} role="presentation" />
      <aside className="relative w-full md:w-[640px] max-w-full h-full bg-white shadow-xl overflow-y-auto animate-slide-in-right">
        <header className="sticky top-0 z-10 bg-white border-b border-ai-border p-4 flex items-center gap-3">
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-md hover:bg-ai-surface inline-flex items-center justify-center"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            {budget && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold text-ai-text truncate">{budget.client_name}</h2>
                  <StatusBadge status={budget.status} />
                </div>
                <div className="text-xs text-ai-text-muted truncate">
                  {budget.external_id} · {budget.service_type}
                </div>
              </>
            )}
          </div>
        </header>

        {isLoading && (
          <div className="p-8 text-center text-ai-text-muted">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Cargando detalle…
          </div>
        )}

        {budget && (
          <div className="p-6 space-y-6">
            <InfoGrid budget={budget} />
            <ActionsPanel budget={budget} />
            <StatusTimeline
              history={budget.status_changes}
              currentStatus={budget.status as BudgetStatus}
            />
            <NotesSection budgetId={budget.id} notes={budget.notes} />
            <ActivityFeed budget={budget} />
          </div>
        )}
      </aside>
    </div>
  );
}

function InfoGrid({ budget }: { budget: NonNullable<ReturnType<typeof useBudgetDetail>["data"]> }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <InfoRow icon={<User className="h-4 w-4" />} label="Cliente" value={budget.client_name} />
      <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={budget.client_email} />
      {budget.client_phone && (
        <InfoRow icon={<Phone className="h-4 w-4" />} label="Teléfono" value={budget.client_phone} />
      )}
      {budget.client_company && (
        <InfoRow icon={<User className="h-4 w-4" />} label="Empresa" value={budget.client_company} />
      )}
      <InfoRow
        icon={<SourceIcon source={budget.source} />}
        label="Fuente"
        value={budget.source}
      />
      <InfoRow
        icon={<AlertCircle className="h-4 w-4" />}
        label="Monto estimado"
        value={<span className="font-semibold">{formatCurrency(budget.estimated_amount, budget.currency)}</span>}
      />
      <InfoRow
        icon={<Calendar className="h-4 w-4" />}
        label="Recibido"
        value={`${formatDateShort(budget.created_at)} (${formatRelative(budget.created_at)})`}
      />
      <InfoRow
        icon={<User className="h-4 w-4" />}
        label="Asignado"
        value={budget.assigned_to ?? "Sin asignar"}
      />
      <div className="sm:col-span-2">
        <div className="text-xs uppercase tracking-wider text-ai-text-muted mb-1">Descripción</div>
        <p className="text-sm text-ai-text whitespace-pre-wrap">{budget.description}</p>
      </div>
      {budget.tags.length > 0 && (
        <div className="sm:col-span-2">
          <div className="text-xs uppercase tracking-wider text-ai-text-muted mb-1 flex items-center gap-1">
            <Tag className="h-3 w-3" /> Tags
          </div>
          <div className="flex flex-wrap gap-1">
            {budget.tags.map((t) => (
              <span key={t} className="bg-ai-surface text-ai-text text-xs px-2 py-0.5 rounded">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ai-text-muted mb-1 flex items-center gap-1">
        <span className="text-ai-text-muted">{icon}</span>
        {label}
      </div>
      <div className="text-sm text-ai-text">{value}</div>
    </div>
  );
}

function ActionsPanel({ budget }: { budget: NonNullable<ReturnType<typeof useBudgetDetail>["data"]> }) {
  const patchMut = usePatchBudget(budget.id);
  const [assigneeInput, setAssigneeInput] = useState(budget.assigned_to ?? "");

  const changeStatus = (newStatus: BudgetStatus) => {
    if (newStatus === budget.status) return;
    let reason: string | undefined;
    if (requiresReason(newStatus)) {
      reason = prompt(`Razón para mover a "${STATUS_LABELS[newStatus]}":`) ?? undefined;
      if (!reason) {
        toast.info("Cambio cancelado.");
        return;
      }
    }
    patchMut.mutate(
      { status: newStatus, reason },
      { onSuccess: () => toast.success(`Movido a "${STATUS_LABELS[newStatus]}"`) }
    );
  };

  const changePriority = (priority: BudgetPriority) => {
    patchMut.mutate({ priority }, { onSuccess: () => toast.success("Prioridad actualizada") });
  };

  const changeAssignee = () => {
    const value = assigneeInput.trim();
    patchMut.mutate(
      { assigned_to: value || null },
      { onSuccess: () => toast.success(value ? "Asignado" : "Desasignado") }
    );
  };

  const nextStatuses = validNextStatuses(budget.status as BudgetStatus);

  return (
    <section className="bg-ai-surface rounded-xl p-4 space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-ai-text-muted mb-2">Cambiar estado</div>
        {nextStatuses.length === 0 ? (
          <p className="text-sm text-ai-text-muted">Estado terminal — no hay transiciones válidas.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={patchMut.isPending}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-white border border-ai-border hover:border-ai-primary hover:bg-ai-primary/5 transition-colors disabled:opacity-50"
              >
                <ArrowRight className="h-3 w-3" /> {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-ai-text-muted mb-2">Prioridad</div>
        <div className="flex gap-1">
          {ALL_PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => changePriority(p)}
              disabled={patchMut.isPending}
              className={cn(
                "text-xs px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50",
                budget.priority === p
                  ? "bg-ai-primary text-white border-ai-primary"
                  : "bg-white text-ai-text-muted border-ai-border hover:bg-ai-surface"
              )}
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-ai-text-muted mb-2">Asignar a</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={assigneeInput}
            onChange={(e) => setAssigneeInput(e.target.value)}
            placeholder="Nombre del admin"
            className="flex-1 text-sm border border-ai-border rounded-md px-3 py-1.5 bg-white"
          />
          <button
            onClick={changeAssignee}
            disabled={patchMut.isPending}
            className="text-sm px-3 py-1.5 bg-ai-secondary text-white rounded-md hover:bg-ai-secondary/90 disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </div>
    </section>
  );
}

function StatusTimeline({
  history,
  currentStatus,
}: {
  history: NonNullable<ReturnType<typeof useBudgetDetail>["data"]>["status_changes"];
  currentStatus: BudgetStatus;
}) {
  if (history.length === 0) return null;
  return (
    <section>
      <h3 className="font-semibold text-ai-text mb-3">Historial de estados</h3>
      <ol className="relative border-l-2 border-ai-border pl-4 space-y-4">
        {history.map((sc) => (
          <li key={sc.id} className="relative">
            <span
              className={cn(
                "absolute -left-[23px] top-1 h-4 w-4 rounded-full border-2",
                sc.to_status === currentStatus
                  ? "bg-ai-primary border-ai-primary"
                  : "bg-white border-ai-border"
              )}
            />
            <div className="text-sm">
              {sc.from_status ? (
                <span>
                  <StatusBadge status={sc.from_status} className="inline" />
                  <ArrowRight className="inline h-3 w-3 mx-1 text-ai-text-muted" />
                  <StatusBadge status={sc.to_status} className="inline" />
                </span>
              ) : (
                <StatusBadge status={sc.to_status} />
              )}
            </div>
            <div className="text-xs text-ai-text-muted mt-1">
              {sc.changed_by} · {formatRelative(sc.changed_at)}
            </div>
            {sc.reason && (
              <div className="text-xs text-ai-text bg-amber-50 border border-amber-200 rounded p-2 mt-1 italic">
                "{sc.reason}"
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function NotesSection({
  budgetId,
  notes,
}: {
  budgetId: string;
  notes: NonNullable<ReturnType<typeof useBudgetDetail>["data"]>["notes"];
}) {
  const [content, setContent] = useState("");
  const addMut = useAddNote(budgetId);

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    addMut.mutate(
      { content: trimmed },
      {
        onSuccess: () => {
          setContent("");
          toast.success("Nota agregada");
        },
      }
    );
  };

  return (
    <section>
      <h3 className="font-semibold text-ai-text mb-3 flex items-center gap-2">
        <MessageSquarePlus className="h-4 w-4" /> Notas internas
      </h3>

      <div className="space-y-2">
        {notes.length === 0 && <p className="text-sm text-ai-text-muted">Sin notas todavía.</p>}
        {notes.map((n) => (
          <div key={n.id} className="bg-white border border-ai-border rounded-md p-3">
            <div className="flex items-center justify-between text-xs text-ai-text-muted mb-1">
              <span className="font-medium text-ai-text">{n.author}</span>
              <span>{formatRelative(n.created_at)}</span>
            </div>
            <p className="text-sm text-ai-text whitespace-pre-wrap">{n.content}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Agregar nota..."
          rows={2}
          className="flex-1 text-sm border border-ai-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-ai-primary"
        />
        <button
          onClick={submit}
          disabled={addMut.isPending || !content.trim()}
          className="px-4 py-2 bg-ai-primary text-white text-sm font-medium rounded-md hover:bg-ai-primary-dark disabled:opacity-50 self-end"
        >
          {addMut.isPending ? "..." : "Agregar"}
        </button>
      </div>
    </section>
  );
}

function ActivityFeed({ budget }: { budget: NonNullable<ReturnType<typeof useBudgetDetail>["data"]> }) {
  type Activity = { time: string; kind: "note" | "status"; text: string };
  const entries: Activity[] = [
    ...budget.notes.map<Activity>((n) => ({
      time: n.created_at,
      kind: "note",
      text: `${n.author} añadió una nota`,
    })),
    ...budget.status_changes.map<Activity>((sc) => ({
      time: sc.changed_at,
      kind: "status",
      text: `${sc.changed_by}: ${sc.from_status ?? "—"} → ${sc.to_status}`,
    })),
  ].sort((a, b) => b.time.localeCompare(a.time));

  if (entries.length === 0) return null;

  return (
    <section>
      <h3 className="font-semibold text-ai-text mb-3">Actividad</h3>
      <ul className="space-y-1 text-xs text-ai-text-muted">
        {entries.slice(0, 10).map((e, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-ai-text-muted mt-1.5 shrink-0" />
            <span className="flex-1">
              <span className="text-ai-text">{e.text}</span>
              <span className="ml-2">{formatRelative(e.time)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
