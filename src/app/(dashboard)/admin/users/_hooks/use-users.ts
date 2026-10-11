"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Params } from "@/lib/api";
import { orgKeys, surveyKeys } from "@/lib/query-keys";
import type { OrgUser, UserRole } from "@/types/org";

export interface UserFilters extends Params {
  search?: string;
  role?: string;
  is_active?: string;
  page?: number;
  page_size?: number;
}

export function useUsers(params: UserFilters) {
  return useQuery({
    queryKey: orgKeys.users(params),
    queryFn: () => api.list<OrgUser>("/users/", { ordering: "user__full_name", ...params }),
    placeholderData: (previous) => previous, // keep the old rows on screen while the next page loads
  });
}

export interface UserInput {
  id?: string;
  full_name: string;
  email: string;
  title?: string;
  role?: UserRole;
  unit_id?: string | null;
  is_active?: boolean;
  /** Required for a new person; blank on edit keeps the current password. */
  password?: string;
}

/** Create (no id) or update (with id) a person in this workspace. */
export function useSaveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UserInput) => (id ? api.patch<OrgUser>(`/users/${id}/`, body) : api.post<OrgUser>("/users/", body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgKeys.all }); // lists, pickers and each block's member count
      qc.invalidateQueries({ queryKey: surveyKeys.all }); // surveys embed people's names
    },
  });
}
