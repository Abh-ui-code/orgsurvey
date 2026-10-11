"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { workspaceKeys } from "@/lib/query-keys";
import type { WorkspaceInfo, WorkspaceSettings } from "@/types/workspace";

/** Workspace options (name, default due days). Read by the app shell and by Settings. */
export function useWorkspaceSettings() {
  return useQuery({
    queryKey: workspaceKeys.settings(),
    queryFn: () => api.get<WorkspaceSettings>("/settings/workspace/"),
    staleTime: 5 * 60_000,
  });
}

/** The workspace's public name, readable before sign-in (for the login page). */
export function useWorkspaceInfo() {
  return useQuery({
    queryKey: workspaceKeys.info(),
    queryFn: () => api.get<WorkspaceInfo>("/workspace/", undefined, { auth: false }),
    retry: false,
  });
}
