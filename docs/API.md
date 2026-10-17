# API reference

All endpoints are under `/api/` on the **workspace host** (`abc.localhost:8000`), except the two marked *public*. Authenticated requests send `Authorization: Bearer <access token>`. Errors are `{"detail": "message"}`.

## Conventions

- **Pagination**: `?page=2&page_size=50` (default 25, max 200) → `{count, next, previous, results}`. Blocks, survey categories and question categories are returned as plain arrays.
- **Search / ordering**: `?search=text`, `?ordering=-created_at` where listed.
- **Writes use ids**: send `category_id`, `target_unit_id`, `responder_id`, `parent_id`, `head_id`, `unit_id`; reads return the nested object (`category`, `target_unit`, `responder`...).

## Endpoints

| Methods | Path | Notes |
|---|---|---|
| GET | `/api/workspace/` | *public* — the workspace's name, for the login page |
| GET | `/api/workspaces/lookup/?subdomain=` | *public, on the bare host* — does this workspace exist? |
| POST | `/api/auth/login/` | `{email, password}` → `{access, refresh}`; refused unless the person belongs to this workspace |
| POST | `/api/auth/refresh/` · `/api/auth/logout/` | rotate / blacklist the refresh token |
| GET, PATCH | `/api/auth/me/` | the signed-in person and their workspace; PATCH `{full_name, title}` |
| POST | `/api/auth/change-password/` | `{current_password, new_password}` (min 8) |
| GET, PUT | `/api/settings/workspace/` | `{org_name, default_due_days}`; PUT is admin-only |
| GET, POST · GET, PUT, PATCH, DELETE | `/api/units/` · `/api/units/{id}/` | the org hierarchy (admin writes). Each block has `head` and `member_count` |
| GET, POST · GET, PUT, PATCH | `/api/users/` · `/api/users/{id}/` | people in the workspace, addressed by **user id**. Filters `role`, `unit`, `is_active`; search name/email/title. No DELETE: deactivate with `is_active=false` |
| GET, POST · GET, PUT, PATCH, DELETE | `/api/question-categories/` · `…/{id}/` | question categories; a category with questions can't be deleted |
| GET, POST · GET, PUT, PATCH, DELETE | `/api/questions/` · `…/{id}/` | the question bank. Filters `category`, `type`; search text/hint |
| GET, POST · GET, PUT, PATCH, DELETE | `/api/survey-categories/` · `…/{id}/` | survey categories; a category in use can't be deleted (switch it off) |
| GET, POST | `/api/surveys/` | list (filters `category`, `status`, `target_unit`, `overdue=true`, `in_progress=true`; search; ordering `created_at`, `title`, `status`, `due_date`) / create a draft `{title, category_id, target_unit_id, description}` |
| GET, PATCH, DELETE | `/api/surveys/{id}/` | detail (sections, answers, activity, readiness) / edit / delete. After publishing only `due_date` and the three people can change |
| GET | `/api/surveys/tasks/` | surveys waiting on the signed-in person, soonest due first |
| POST | `/api/surveys/{id}/publish/` · `close/` · `duplicate/` | admin lifecycle |
| POST | `/api/surveys/{id}/save-draft/` | `{answers}` — the respondent's work in progress |
| POST | `/api/surveys/{id}/submit/` | `{answers}` — the respondent |
| POST | `/api/surveys/{id}/review/` | `{decision: pass\|return, comment}` — the reviewer |
| POST | `/api/surveys/{id}/approve/` | `{decision: approve\|return, comment}` — the approver |
| GET, POST · GET, PATCH, DELETE | `/api/surveys/{id}/sections/` · `…/{section_id}/` | builder: sections of a draft (admin) |
| POST | `/api/surveys/{id}/sections/{section_id}/move/` | `{direction: up\|down}` |
| GET, POST · GET, PATCH, DELETE | `/api/surveys/{id}/sections/{section_id}/questions/` · `…/{question_id}/` | builder: questions. Create takes the fields, or `{bank_question_id}` to copy from the bank |
| POST | `/api/surveys/{id}/sections/{section_id}/questions/{question_id}/move/` | `{direction}` |
| GET | `/api/reports/dashboard/` | counts (`waiting_on_you`, `overdue`, `in_progress`, ...) and per-block progress, scoped to what the caller may see |
| GET | `/api/reports/summary/` | admin: by stage, by block (rolled up), by category |

### A survey in a list

```json
{
  "id": "…", "title": "Engineering Team Pulse - Q4", "status": "awaiting_response",
  "category": {"id": "…", "label": "Employee Engagement", "color": "brand"},
  "target_unit": {"id": "…", "name": "Engineering"},
  "responder": {"id": "…", "full_name": "Neha Gupta", "email": "…"}, "reviewer": {…}, "approver": {…},
  "due_date": "2026-10-18", "is_overdue": false, "question_count": 4,
  "my_task": {"role": "responder", "action": "Respond"},
  "waiting_on": {"role": "responder", "person": {…}},
  "stage_since": "2026-10-11T18:27:00Z"
}
```

The detail adds `instructions`, `sections[].questions[]`, `answers`, `draft_answers`
(only for the respondent), `readiness` (for drafts), `history[]` and `created_by`.
