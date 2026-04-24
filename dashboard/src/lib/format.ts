import { formatDistanceToNow, format as formatFn } from "date-fns";
import { es } from "date-fns/locale";

export function formatCurrency(amount: number | string, currency = "USD"): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatRelative(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
  } catch {
    return iso;
  }
}

export function formatDateShort(iso: string): string {
  try {
    return formatFn(new Date(iso), "dd MMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}
