"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { reportKeys, surveyKeys } from "@/lib/query-keys";
import type { AnswerValue, ReturnAudience, SurveyDetail } from "@/types/survey";

/** Everything the survey screens can do to one survey, bound to its id.
 * Each write refreshes the survey lists and the report figures, since both
 * show this survey's stage. */
function useSurveyMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: surveyKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}

/** Everything editable on a draft; once published only `due_date` and the three people. */
export interface SurveyPatch {
  title?: string;
  category_id?: string;
  description?: string;
  instructions?: string;
  target_unit_id?: string;
  due_date?: string | null;
  responder_id?: string | null;
  reviewer_id?: string | null;
  approver_id?: string | null;
}

export const useUpdateSurvey = (id: string) => useSurveyMutation((patch: SurveyPatch) => api.patch<SurveyDetail>(`/surveys/${id}/`, patch));
export const usePublishSurvey = (id: string) => useSurveyMutation(() => api.post<SurveyDetail>(`/surveys/${id}/publish/`));
export const useCloseSurvey = (id: string) => useSurveyMutation((comment: string) => api.post<SurveyDetail>(`/surveys/${id}/close/`, { comment }));
export const useDuplicateSurvey = (id: string) => useSurveyMutation(() => api.post<SurveyDetail>(`/surveys/${id}/duplicate/`));
export const useDeleteSurvey = (id: string) => useSurveyMutation(() => api.delete(`/surveys/${id}/`));

/** Keep the respondent's work in progress. Writes the returned survey straight
 * into the cache (no list refresh), so autosaving stays quiet and cheap. */
export function useSaveDraft(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (answers: Record<string, AnswerValue>) => api.post<SurveyDetail>(`/surveys/${id}/save-draft/`, { answers }),
    onSuccess: (survey) => qc.setQueryData(surveyKeys.detail(id), survey),
  });
}

/** The three-role workflow. */
export const useSubmitResponse = (id: string) =>
  useSurveyMutation((answers: Record<string, AnswerValue>) => api.post<SurveyDetail>(`/surveys/${id}/submit/`, { answers }));
/** Notes pinned to questions, sent with a return: { question id: note }. */
export type QuestionNotes = Record<string, string>;
const toPayload = (notes: QuestionNotes) =>
  Object.entries(notes).map(([question_id, text]) => ({ question_id, text }));

export const useReviewSurvey = (id: string) =>
  useSurveyMutation(({ decision, comment, notes = {} }: { decision: "pass" | "return"; comment: string; notes?: QuestionNotes }) =>
    api.post<SurveyDetail>(`/surveys/${id}/review/`, { decision, comment, question_comments: toPayload(notes) }),
  );
export const useApproveSurvey = (id: string) =>
  useSurveyMutation(
    ({ decision, comment, notes = {}, audience }: { decision: "approve" | "return"; comment: string; notes?: QuestionNotes; audience?: ReturnAudience }) =>
      api.post<SurveyDetail>(`/surveys/${id}/approve/`, { decision, comment, question_comments: toPayload(notes), audience }),
  );
