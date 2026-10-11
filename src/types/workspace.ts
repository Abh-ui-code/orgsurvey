/** Workspace-level options an administrator can change. */
export interface WorkspaceSettings {
  org_name: string;
  default_due_days: number;
}

/** The public face of a workspace, shown on the login page. */
export interface WorkspaceInfo {
  name: string;
  subdomain: string;
}
