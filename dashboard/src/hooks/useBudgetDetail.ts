import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addNote, getBudget, patchBudget } from "@/api/budgets";
import type { BudgetPatch } from "@/api/types";

export function useBudgetDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: ["budget", id],
    queryFn: () => getBudget(id as string),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function usePatchBudget(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: BudgetPatch) => patchBudget(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget", id] });
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export function useAddNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { content: string; author?: string }) => addNote(id, input.content, input.author),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget", id] });
    },
  });
}
