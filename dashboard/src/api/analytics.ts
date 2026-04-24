import { api } from "./client";
import type { AnalyticsStats } from "./types";

export async function getStats(dateRange: string = "30d"): Promise<AnalyticsStats> {
  const { data } = await api.get<AnalyticsStats>("/analytics/stats", {
    params: { date_range: dateRange },
  });
  return data;
}
