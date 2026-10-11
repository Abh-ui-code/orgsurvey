"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { orgKeys } from "@/lib/query-keys";
import type { OrgUnit } from "@/types/org";

/** The whole org hierarchy as a flat list (small, so never paginated). Used
 * by the org chart and by every block picker. */
export function useUnits() {
  return useQuery({ queryKey: orgKeys.units(), queryFn: () => api.get<OrgUnit[]>("/units/") });
}
