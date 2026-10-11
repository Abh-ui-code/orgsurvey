"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { reportKeys } from "@/lib/query-keys";
import type { ReportSummary } from "@/types/reports";

/** Workspace-wide report figures, computed on the server. */
export function useReportSummary() {
  return useQuery({ queryKey: reportKeys.summary(), queryFn: () => api.get<ReportSummary>("/reports/summary/") });
}
