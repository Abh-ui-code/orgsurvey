"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { griKeys } from "@/lib/query-keys";
import type { GriStandard, GriStandardDetail, StandardFramework } from "@/types/question";

/** Every standard of a framework, or of both (small and fixed, so never paginated). */
export function useGriStandards(framework?: StandardFramework) {
  return useQuery({
    queryKey: griKeys.list(framework),
    queryFn: () => api.get<GriStandard[]>(framework ? `/gri-standards/?framework=${framework}` : "/gri-standards/"),
    staleTime: 5 * 60_000,
  });
}

/** One standard with all its questions. */
export function useGriStandard(id: string) {
  return useQuery({ queryKey: griKeys.detail(id), queryFn: () => api.get<GriStandardDetail>(`/gri-standards/${id}/`), staleTime: 5 * 60_000 });
}
