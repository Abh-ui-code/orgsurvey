"use client";

import { useState } from "react";
import type { SurveyDetail } from "@/types/survey";
import { DetailsPanel } from "./details-panel";
import { PublishCard } from "./publish-card";
import { SectionsEditor } from "./sections-editor";

/** A draft survey: questions on the left; details, assignment and publish on the right. */
export function SurveyBuilder({ survey }: { survey: SurveyDetail }) {
  const [dirty, setDirty] = useState(false);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <SectionsEditor survey={survey} />
      <div className="space-y-4 self-start">
        <DetailsPanel survey={survey} onDirtyChange={setDirty} />
        <PublishCard survey={survey} dirty={dirty} />
      </div>
    </div>
  );
}
