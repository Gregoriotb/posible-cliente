import { useQuery } from "@tanstack/react-query";
import { listBudgets } from "@/api/budgets";
import type { BudgetListParams } from "@/api/types";

export function useBudgets(params: BudgetListParams) {
  return useQuery({
    queryKey: ["budgets", params],
    queryFn: () => listBudgets(params),
    staleTime: 30_000,
  });
}
