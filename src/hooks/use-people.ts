"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { orgKeys } from "@/lib/query-keys";
import type { Paginated } from "@/types/common";
import type { OrgUser } from "@/types/org";

/** Everyone in the workspace, for pickers (the three survey roles, block
 * heads). The server caps a page at 200; a longer list would need a search box. */
export function usePeople() {
  return useQuery({
    queryKey: orgKeys.users({ picker: true }),
    queryFn: () => api.list<OrgUser>("/users/", { page_size: 200, ordering: "user__full_name" }),
    select: (page: Paginated<OrgUser>) => page.results,
  });
}
