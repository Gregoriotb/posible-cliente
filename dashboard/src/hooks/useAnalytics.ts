import { useQuery } from "@tanstack/react-query";
import { getStats } from "@/api/analytics";

export function useAnalytics(dateRange: string = "30d") {
  return useQuery({
    queryKey: ["analytics", dateRange],
    queryFn: () => getStats(dateRange),
    staleTime: 60_000,
  });
}
