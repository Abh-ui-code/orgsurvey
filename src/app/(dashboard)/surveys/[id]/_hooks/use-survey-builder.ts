"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { surveyKeys } from "@/lib/query-keys";
import type { QuestionFields, SurveyQuestion } from "@/types/question";
import type { SurveySection } from "@/types/survey";

type Direction = "up" | "down";

/** Builder writes (sections and questions of a draft). They change the
 * survey's question count, so the lists refresh as well as the detail. */
function useBuilderMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: surveyKeys.all }) });
}

const sectionsUrl = (surveyId: string) => `/surveys/${surveyId}/sections`;
const questionsUrl = (surveyId: string, sectionId: string) => `${sectionsUrl(surveyId)}/${sectionId}/questions`;

export interface SectionFields {
  title: string;
  description?: string;
}

export const useAddSection = (surveyId: string) =>
  useBuilderMutation((body: SectionFields) => api.post<SurveySection>(`${sectionsUrl(surveyId)}/`, body));
export const useUpdateSection = (surveyId: string) =>
  useBuilderMutation(({ id, ...body }: SectionFields & { id: string }) => api.patch<SurveySection>(`${sectionsUrl(surveyId)}/${id}/`, body));
export const useDeleteSection = (surveyId: string) => useBuilderMutation((id: string) => api.delete(`${sectionsUrl(surveyId)}/${id}/`));
export const useMoveSection = (surveyId: string) =>
  useBuilderMutation(({ id, direction }: { id: string; direction: Direction }) => api.post(`${sectionsUrl(surveyId)}/${id}/move/`, { direction }));

/** Set the order of all sections (drag and drop). */
export const useReorderSections = (surveyId: string) =>
  useBuilderMutation((ids: string[]) => api.post(`${sectionsUrl(surveyId)}/reorder/`, { ids }));
/** Set the order of a section's questions (drag and drop). */
export const useReorderQuestions = (surveyId: string) =>
  useBuilderMutation(({ sectionId, ids }: { sectionId: string; ids: string[] }) => api.post(`${questionsUrl(surveyId, sectionId)}/reorder/`, { ids }));

/** Add a question to a section: copied from the bank, or written fresh. */
export const useAddQuestion = (surveyId: string) =>
  useBuilderMutation(({ sectionId, ...body }: { sectionId: string } & (QuestionFields | { bank_question_id: string })) =>
    api.post<SurveyQuestion>(`${questionsUrl(surveyId, sectionId)}/`, body),
  );
export const useUpdateQuestion = (surveyId: string) =>
  useBuilderMutation(({ sectionId, id, ...body }: { sectionId: string; id: string } & QuestionFields) =>
    api.patch<SurveyQuestion>(`${questionsUrl(surveyId, sectionId)}/${id}/`, body),
  );
export const useDeleteQuestion = (surveyId: string) =>
  useBuilderMutation(({ sectionId, id }: { sectionId: string; id: string }) => api.delete(`${questionsUrl(surveyId, sectionId)}/${id}/`));
export const useMoveQuestion = (surveyId: string) =>
  useBuilderMutation(({ sectionId, id, direction }: { sectionId: string; id: string; direction: Direction }) =>
    api.post(`${questionsUrl(surveyId, sectionId)}/${id}/move/`, { direction }),
  );

/** Put the chosen questions of a GRI standard into the survey as a section (re-sending changes the choice). */
export const useAddGriSection = (surveyId: string) =>
  useBuilderMutation(({ standardId, questionIds }: { standardId: string; questionIds: string[] }) =>
    api.post<SurveySection>(`${sectionsUrl(surveyId)}/from-gri/`, { gri_standard_id: standardId, question_ids: questionIds }),
  );
/** Give a whole section to one respondent. */
export const useAssignSection = (surveyId: string) =>
  useBuilderMutation(({ sectionId, responder_id }: { sectionId: string; responder_id: string | null }) =>
    api.post<SurveySection>(`${sectionsUrl(surveyId)}/${sectionId}/assign/`, { responder_id }),
  );
