import type { BudgetPriority, BudgetSource, BudgetStatus } from "@/lib/status";

export type Scope = "budgets:write" | "budgets:read" | "budgets:update" | "admin";

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: Scope[];
  rate_limit_per_minute: number;
  status: "active" | "revoked";
  last_used_at: string | null;
  created_at: string;
  created_by: string;
  expires_at: string | null;
}

export interface ApiKeyCreated extends ApiKey {
  key: string; // plaintext, solo disponible en POST / rotate
}

export interface Note {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface StatusChange {
  id: string;
  from_status: BudgetStatus | null;
  to_status: BudgetStatus;
  changed_by: string;
  reason: string | null;
  changed_at: string;
}

export interface Budget {
  id: string;
  external_id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  client_company: string | null;
  service_type: string;
  description: string;
  estimated_amount: string; // Decimal serializado
  currency: string;
  status: BudgetStatus;
  priority: BudgetPriority;
  source: BudgetSource;
  assigned_to: string | null;
  tags: string[];
  due_date: string | null;
  created_at: string;
  updated_at: string;
  created_by_key_id: string | null;
  notes: Note[];
  status_changes: StatusChange[];
}

export interface BudgetListMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface BudgetListResponse {
  data: Budget[];
  meta: BudgetListMeta;
}

export interface BudgetListParams {
  status?: BudgetStatus;
  priority?: BudgetPriority;
  source?: BudgetSource;
  assigned_to?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: "created_at" | "updated_at" | "estimated_amount" | "status" | "priority";
  sort_order?: "asc" | "desc";
}

export interface BudgetPatch {
  status?: BudgetStatus;
  priority?: BudgetPriority;
  assigned_to?: string | null;
  reason?: string;
}

export interface AnalyticsStats {
  kpis: {
    total_budgets: number;
    conversion_rate: number;
    avg_response_time_hours: number | null;
    potential_revenue: string;
  };
  by_status: { key: string; count: number }[];
  by_source: { key: string; count: number }[];
  by_priority: { key: string; count: number }[];
  by_assigned: { key: string; count: number }[];
  trend: { date: string; received: number; approved: number }[];
  top_services: { service_type: string; count: number; total_amount: string }[];
  range: string;
}
