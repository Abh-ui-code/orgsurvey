"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { griKeys } from "@/lib/query-keys";
import type { GriStandard, GriStandardDetail } from "@/types/question";

/** Every GRI standard (small and fixed, so never paginated). */
export function useGriStandards() {
  return useQuery({ queryKey: griKeys.list(), queryFn: () => api.get<GriStandard[]>("/gri-standards/"), staleTime: 5 * 60_000 });
}

/** One standard with all its questions. */
export function useGriStandard(id: string) {
  return useQuery({ queryKey: griKeys.detail(id), queryFn: () => api.get<GriStandardDetail>(`/gri-standards/${id}/`), staleTime: 5 * 60_000 });
}
