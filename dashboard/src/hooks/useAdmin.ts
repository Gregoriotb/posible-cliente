import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiKey, listApiKeys, me, revokeApiKey, rotateApiKey } from "@/api/admin";
import type { Scope } from "@/api/types";

export function useMe(enabled: boolean = true) {
  return useQuery({
    queryKey: ["me"],
    queryFn: me,
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

export function useApiKeys(enabled: boolean = true) {
  return useQuery({
    queryKey: ["admin", "api-keys"],
    queryFn: listApiKeys,
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; scopes: Scope[]; rate_limit_per_minute?: number }) =>
      createApiKey(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "api-keys"] }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "api-keys"] }),
  });
}

export function useRotateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rotateApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "api-keys"] }),
  });
}
