"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { orgKeys, reportKeys } from "@/lib/query-keys";
import type { OrgUnit, OrgUser, UnitKind } from "@/types/org";

export interface UnitInput {
  id?: string;
  parent_id: string | null;
  name: string;
  kind: UnitKind;
  head_id: string | null;
}

/** Create (no id) or update (with id) an org block. */
export function useSaveUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UnitInput) => (id ? api.patch<OrgUnit>(`/units/${id}/`, body) : api.post<OrgUnit>("/units/", body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all }); // reports roll up through the hierarchy
    },
  });
}

export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/units/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}

/** The people placed directly in one block. */
export function useUnitMembers(unitId: string | null) {
  return useQuery({
    queryKey: orgKeys.users({ unit: unitId }),
    queryFn: () => api.list<OrgUser>("/users/", { unit: unitId, page_size: 200 }),
    enabled: unitId !== null,
  });
}
