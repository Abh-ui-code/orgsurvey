# Survey workflow

A survey is **aimed at** an org block. The workflow runs **per question**: every
question has exactly one respondent and moves through review and approval on its
own. A survey of 100 questions can be split 50/50 between two respondents, and 50
can be approved while the other 50 have not been answered yet.

```
awaiting_response ──submit──▶ awaiting_review ──pass──▶ awaiting_approval ──approve──▶ approved
        ▲                           │                          │
        └────────── returned ◀──────┴──────── return ──────────┘      (approver may also return to the reviewer)
```

The survey itself is `draft` → `in_progress` (from publishing) → `approved` (only when
**every** question is approved). An administrator may `close` an in-progress survey.

| Step | Who | Rule |
|---|---|---|
| Build | Admin | Sections and questions are editable **only while a draft**. Each question gets one respondent: tick questions and assign them |
| Publish | Admin | Needs at least one question, every question assigned to a respondent, and a reviewer and approver who are not respondents |
| Respond | Respondent | Sees **only their own questions**. Required ones must be answered; work in progress is saved as a private draft. Submitting sends all their open questions |
| Review | Reviewer | Sees a question once it is submitted, and keeps seeing it. Selects questions to pass or return; can comment on any question. A return needs a comment or a question note |
| Approve | Approver | Sees a question once it passed review. Selects questions to approve or return (to the respondent, the reviewer or both) |
| Close | Admin | Withdraws a survey that is in progress. Final |

Decisions are independent: a reviewer can pass 20 questions now and return 3, then
deal with the rest as respondents submit them.

After publishing, an admin can still change the **due date**, swap the **reviewer or
approver**, and **reassign a question** that has not been submitted (or was returned).
To change questions, **duplicate** the survey into a new draft.

## Audit trail

Every step is recorded against the questions it covered (`SurveyEvent.questions`).
The audit page's **Journey** tab shows the whole path on one page (who submitted,
passed, returned or approved which questions, with the comments pinned to them), can
be narrowed to one respondent, and **By question** opens each question's own trail.

## Who sees what

| | Admin | Member |
|---|---|---|
| Drafts | all | never |
| Published surveys | all | only those they review, approve or have a question in |
| Questions | all | respondent: own; reviewer: submitted; approver: passed review |
| A respondent's draft answers | no | only the respondent |
| Question bank, categories, users, settings, reports | read and write | not available |
| Org hierarchy | read and write | read |

## Deadlines

A survey is **overdue** when it is `in_progress` and its due date has passed. Approved and closed surveys are never overdue.
The list, tasks, dashboard and survey page all show who it is **waiting on** and
for how long.

All of these rules live in `backend/apps/surveys/services.py` and
`backend/apps/surveys/scoping.py`. The web app only mirrors them for convenience;
the API enforces every one.
