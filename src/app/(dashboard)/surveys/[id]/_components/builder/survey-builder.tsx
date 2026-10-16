"use client";

import { useState } from "react";
import type { SurveyDetail } from "@/types/survey";
import { DetailsPanel } from "./details-panel";
import { PublishCard } from "./publish-card";
import { SectionsEditor } from "./sections-editor";

/** A draft survey, stacked: details and assignment, the publish checklist, then sections and questions. */
export function SurveyBuilder({ survey }: { survey: SurveyDetail }) {
  const [dirty, setDirty] = useState(false);
  return (
    <div className="space-y-4">
      <DetailsPanel survey={survey} onDirtyChange={setDirty} />
      <PublishCard survey={survey} dirty={dirty} />
      <SectionsEditor survey={survey} />
    </div>
  );
}
