# Data model

```
PUBLIC SCHEMA                          TENANT SCHEMA (one per workspace)
─────────────                          ────────────────────────────────────────────
Tenant ──< Domain                      OrgUnit ──< OrgUnit            (parent/children)
   │                                      │  └──< Member >── User*     (placed in a block)
   └──< UserTenantMembership >── User     └──< Survey
                                       BankCategory ──< Question
                                       SurveyCategory ──< Survey ──< Section ──< SurveyQuestion
                                                              └──< SurveyEvent
 * a foreign key to the public-schema User, with db_constraint=False
```

Every tenant model has a UUID `id`, `created_at` and `updated_at` (`BaseModel`).

| Model | Notes |
|---|---|
| **OrgUnit** | One block in the hierarchy. `parent` is null only for the single root. `kind`: organisation, division, department, team. `head` is a person. Deleting a block is refused if it has children or surveys; its people move up a level |
| **Member** | A person inside this workspace: `role` (admin / member), `unit`, `title`, `is_active`. One per user per workspace |
| **BankCategory / Question** | Reusable questions. Types: text, single choice, multiple choice, rating 1-5, yes/no, number, date |
| **SurveyCategory** | The topic a survey belongs to (code, label, colour, active flag). Seven defaults are created with every workspace |
| **Survey** | Title, category, the block it is **aimed at**, `status`, the three people (`responder`, `reviewer`, `approver`), `due_date`, `answers` (the submitted response) and `draft_answers` (the responder's work in progress) |
| **Section / SurveyQuestion** | The survey's own copy of its questions, ordered. Copying from the bank keeps a link (`bank_question`) but later bank edits never change a survey |
| **SurveyEvent** | The activity log: created, published, submitted, reviewed, returned, approved, closed (who, when, comment) |

Answers are stored as `{survey_question_id: value}`; the value's shape is checked
against the question's type (`apps/core/question_types.py`).
