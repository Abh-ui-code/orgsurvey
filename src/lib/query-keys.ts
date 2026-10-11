/**
 * Query-key factories, one namespace per domain. React Query keys are global
 * cache slots -- two modules picking the same key with different payload
 * shapes is a confusing bug, so every module takes its keys from here rather
 * than inlining an array literal at the call site.
 *
 * Each namespace has an `all` root: invalidating it refreshes every query in
 * that domain (lists, details and counts) after a write.
 */
export const authKeys = {
  me: () => ["me"] as const,
};

export const workspaceKeys = {
  all: ["workspace"] as const,
  info: () => ["workspace", "info"] as const,
  settings: () => ["workspace", "settings"] as const,
};

export const orgKeys = {
  all: ["org"] as const,
  units: () => ["org", "units"] as const,
  users: (params: object) => ["org", "users", params] as const,
};

export const bankKeys = {
  all: ["bank"] as const,
  categories: () => ["bank", "categories"] as const,
  questions: (params: object) => ["bank", "questions", params] as const,
};

export const surveyCategoryKeys = {
  all: ["survey-categories"] as const,
  list: () => ["survey-categories", "list"] as const,
};

export const surveyKeys = {
  all: ["surveys"] as const,
  list: (params: object) => ["surveys", "list", params] as const,
  tasks: (params: object) => ["surveys", "tasks", params] as const,
  detail: (id: string) => ["surveys", "detail", id] as const,
};

export const reportKeys = {
  all: ["reports"] as const,
  dashboard: () => ["reports", "dashboard"] as const,
  summary: () => ["reports", "summary"] as const,
};
