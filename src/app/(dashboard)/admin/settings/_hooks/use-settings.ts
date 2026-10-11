"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { surveyCategoryKeys, surveyKeys, workspaceKeys } from "@/lib/query-keys";
import type { CategoryColor, SurveyCategory } from "@/types/survey";
import type { WorkspaceSettings } from "@/types/workspace";

export function useUpdateWorkspaceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: WorkspaceSettings) => api.put<WorkspaceSettings>("/settings/workspace/", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}

export interface SurveyCategoryInput {
  id?: string;
  label: string;
  description?: string;
  color?: CategoryColor;
  is_active?: boolean;
}

/** Create (no id) or update (with id) a survey category. */
export function useSaveSurveyCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: SurveyCategoryInput) =>
      id ? api.patch<SurveyCategory>(`/survey-categories/${id}/`, body) : api.post<SurveyCategory>("/survey-categories/", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: surveyCategoryKeys.all });
      qc.invalidateQueries({ queryKey: surveyKeys.all }); // surveys embed their category's label and colour
    },
  });
}

export function useDeleteSurveyCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/survey-categories/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: surveyCategoryKeys.all }),
  });
}
