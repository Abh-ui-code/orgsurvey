# Survey workflow

A survey is **aimed at** an org block and handled by three different people.

```
draft ──publish──▶ awaiting_response ──submit──▶ awaiting_review ──pass──▶ awaiting_approval ──approve──▶ approved
                        ▲                              │                          │
                        └─────────── returned ◀────────┴──────── return ──────────┘
(an administrator may `close` any survey that is awaiting_* or returned)
```

| Step | Who | Rule |
|---|---|---|
| Build | Admin | Sections and questions are editable **only while a draft** |
| Publish | Admin | Needs at least one question and three **different** active people. Freezes the questions |
| Respond | Responder | All required questions answered, each in the right shape. Work in progress is saved as a private draft |
| Review | Reviewer | Pass to the approver, or return to the responder (a comment is required) |
| Approve | Approver | Approve, or return to the responder (a comment is required) |
| Close | Admin | Withdraws a survey that is in progress. Final |

After publishing, an admin can still change the **due date** and **swap any of the
three people** (someone leaves, someone is away). Nothing else changes: to change
questions, **duplicate** the survey into a new draft.

## Who sees what

| | Admin | Member |
|---|---|---|
| Drafts | all | never |
| Published surveys | all | only those they are the responder, reviewer or approver of |
| A responder's draft answers | no | only the responder |
| Question bank, categories, users, settings, reports | read and write | not available |
| Org hierarchy | read and write | read |

## Deadlines

A survey is **overdue** when it is still in progress (`awaiting_*` or `returned`)
and its due date has passed. Approved and closed surveys are never overdue.
The list, tasks, dashboard and survey page all show who it is **waiting on** and
for how long.

All of these rules live in `backend/apps/surveys/services.py` and
`backend/apps/surveys/scoping.py`. The web app only mirrors them for convenience;
the API enforces every one.
