"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { reportKeys } from "@/lib/query-keys";
import type { DashboardData } from "@/types/reports";

/** Headline counts and per-block progress, scoped by the server to what the
 * signed-in person may see. */
export function useDashboard() {
  return useQuery({ queryKey: reportKeys.dashboard(), queryFn: () => api.get<DashboardData>("/reports/dashboard/") });
}
