import { api } from "./client";
import type {
  Budget,
  BudgetListParams,
  BudgetListResponse,
  BudgetPatch,
  Note,
} from "./types";

export async function listBudgets(params: BudgetListParams = {}): Promise<BudgetListResponse> {
  const { data } = await api.get<BudgetListResponse>("/budgets", { params });
  return data;
}

export async function getBudget(id: string): Promise<Budget> {
  const { data } = await api.get<Budget>(`/budgets/${id}`);
  return data;
}

export async function patchBudget(id: string, patch: BudgetPatch): Promise<Budget> {
  const { data } = await api.patch<Budget>(`/budgets/${id}`, patch);
  return data;
}

export async function addNote(id: string, content: string, author?: string): Promise<Note> {
  const { data } = await api.post<Note>(`/budgets/${id}/notes`, { content, author });
  return data;
}
