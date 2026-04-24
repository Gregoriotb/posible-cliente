/**
 * Máquina de estados del Budget — réplica de app/services/status_machine.py del backend.
 * El backend es fuente de verdad; el frontend duplica para deshabilitar opciones inválidas en la UI.
 */

export type BudgetStatus =
  | "recibido"
  | "en_revision"
  | "cotizado"
  | "negociando"
  | "aprobado"
  | "en_proceso"
  | "completado"
  | "cancelado"
  | "rechazado";

export type BudgetPriority = "low" | "medium" | "high" | "urgent";
export type BudgetSource = "whatsapp" | "web" | "messenger" | "email";

export const ALL_STATUSES: BudgetStatus[] = [
  "recibido",
  "en_revision",
  "cotizado",
  "negociando",
  "aprobado",
  "en_proceso",
  "completado",
  "cancelado",
  "rechazado",
];

export const ALL_PRIORITIES: BudgetPriority[] = ["low", "medium", "high", "urgent"];
export const ALL_SOURCES: BudgetSource[] = ["whatsapp", "web", "messenger", "email"];

const ALLOWED_TRANSITIONS: Record<BudgetStatus, BudgetStatus[]> = {
  recibido: ["en_revision", "cancelado", "rechazado"],
  en_revision: ["cotizado", "cancelado", "rechazado", "recibido"],
  cotizado: ["negociando", "aprobado", "cancelado", "rechazado"],
  negociando: ["cotizado", "aprobado", "cancelado", "rechazado"],
  aprobado: ["en_proceso", "cancelado"],
  en_proceso: ["completado", "cancelado"],
  completado: [],
  cancelado: ["en_revision"],
  rechazado: ["en_revision"],
};

const STATUSES_REQUIRING_REASON: BudgetStatus[] = ["cancelado", "rechazado"];

export function validNextStatuses(from: BudgetStatus): BudgetStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

export function requiresReason(to: BudgetStatus): boolean {
  return STATUSES_REQUIRING_REASON.includes(to);
}

export const STATUS_LABELS: Record<BudgetStatus, string> = {
  recibido: "Recibido",
  en_revision: "En revisión",
  cotizado: "Cotizado",
  negociando: "Negociando",
  aprobado: "Aprobado",
  en_proceso: "En proceso",
  completado: "Completado",
  cancelado: "Cancelado",
  rechazado: "Rechazado",
};

export const STATUS_COLORS: Record<BudgetStatus, string> = {
  recibido: "bg-slate-100 text-slate-700 border-slate-200",
  en_revision: "bg-blue-50 text-blue-700 border-blue-200",
  cotizado: "bg-purple-50 text-purple-700 border-purple-200",
  negociando: "bg-amber-50 text-amber-700 border-amber-200",
  aprobado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  en_proceso: "bg-cyan-50 text-cyan-700 border-cyan-200",
  completado: "bg-green-100 text-green-800 border-green-300",
  cancelado: "bg-red-50 text-red-700 border-red-200",
  rechazado: "bg-gray-100 text-gray-700 border-gray-200",
};

export const PRIORITY_LABELS: Record<BudgetPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const PRIORITY_COLORS: Record<BudgetPriority, string> = {
  low: "text-slate-500",
  medium: "text-ai-secondary",
  high: "text-ai-warning",
  urgent: "text-ai-danger",
};

export const SOURCE_LABELS: Record<BudgetSource, string> = {
  whatsapp: "WhatsApp",
  web: "Web",
  messenger: "Messenger",
  email: "Email",
};
