"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DrawerField } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import type { SurveyDetail } from "@/types/survey";
import { useUpdateSurvey } from "../_hooks/use-survey-actions";
import { AssignmentFields, type People } from "./assignment-fields";

/** After publishing, an admin can still move the deadline or swap one of the
 * three people (someone leaves, someone is away). The questions stay frozen. */
export function LiveAssignmentCard({ survey }: { survey: SurveyDetail }) {
  const update = useUpdateSurvey(survey.id);
  const saved: People = { responder: survey.responder?.id ?? "", reviewer: survey.reviewer?.id ?? "", approver: survey.approver?.id ?? "" };
  const [people, setPeople] = useState<People>(saved);
  const [due, setDue] = useState(survey.due_date ?? "");

  const dirty = JSON.stringify(people) !== JSON.stringify(saved) || due !== (survey.due_date ?? "");
  const complete = Object.values(people).every(Boolean);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle>People &amp; deadline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <AssignmentFields people={people} onChange={setPeople} />
        <DrawerField label="Due date">
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </DrawerField>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!dirty || !complete}
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { responder_id: people.responder, reviewer_id: people.reviewer, approver_id: people.approver, due_date: due || null },
                { onSuccess: () => toast.success("Updated"), onError: (e) => toast.error((e as Error).message) },
              )
            }
          >
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
