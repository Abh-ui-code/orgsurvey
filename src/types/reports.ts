import type { SurveyStatus } from "@/types/survey";

export interface UnitProgress {
  unit_id: string;
  name: string;
  total: number;
  approved: number;
  returned: number;
}

export interface DashboardData {
  counts: {
    waiting_on_you: number;
    surveys: number;
    in_progress: number;
    returned: number;
    approved: number;
    overdue: number;
    drafts: number;
  };
  by_unit: UnitProgress[];
}

export interface CategoryProgress {
  category_id: string;
  label: string;
  total: number;
  in_progress: number;
  approved: number;
}

export interface ReportSummary {
  by_status: { status: SurveyStatus; count: number }[];
  by_unit: UnitProgress[];
  by_category: CategoryProgress[];
}
