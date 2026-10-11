# OrgSurvey

Multi-tenant organisational surveys. Each organisation gets its own workspace
at `<subdomain>.localhost` (e.g. `abc.localhost`) with its own database schema,
an org hierarchy, a question bank, and surveys that move through a
**responder → reviewer → approver** workflow.

- **Backend** — Django 5, django-tenants (one PostgreSQL schema per workspace), DRF, JWT (`backend/`)
- **Web** — Next.js 15, TypeScript, Tailwind, React Query (this directory)

## Quick start

```bash
make setup   # deps, .env files, database, migrations, two sample workspaces
make dev     # backend :8000 + web :3000
make help    # every target
```

Open a workspace address and sign in (every seeded password is `devpassword`):

| Workspace | Address | Sign in as |
|---|---|---|
| ABC Corporation | http://abc.localhost:3000 | `admin@abc.localhost` (administrator), `neha@` responder, `vikram@` reviewer, `anita@` approver |
| XYZ Industries | http://xyz.localhost:3000 | the same names at `@xyz.localhost`, with entirely separate data |

Or open http://localhost:3000 and type a workspace name. `*.localhost`
resolves to your machine in Chrome, Edge and Firefox; elsewhere add
`127.0.0.1 abc.localhost xyz.localhost` to `/etc/hosts`.

`make setup` needs PostgreSQL running and a role that can create databases;
put it in `backend/.env` (`DATABASE_URL`). See `scripts/db-init.sh` for the
one-line command if the role doesn't exist yet.

## How multi-tenancy works

1. The **subdomain is the tenant.** The backend maps the request's `Host`
   header to a `Domain` row and switches PostgreSQL's `search_path` to that
   tenant's schema, so every query only sees that workspace's tables.
2. **People live in the public schema** (one login per email). A
   `UserTenantMembership` says which workspaces they may enter; their role,
   org block and title are stored per workspace.
3. **Login is scoped to the subdomain.** The JWT carries the tenant schema, and
   a token is rejected on any other workspace, even for someone who belongs to both.
4. The web app calls the API on its own hostname, so `abc.localhost:3000`
   talks to `abc.localhost:8000`.

New workspace: `make create-tenant SUB=acme NAME='Acme Ltd' EMAIL=admin@acme.com PASS=secret123`
then open `http://acme.localhost:3000`.

## Surveys: the same structure as SurveyQs, made organisational

- **Categories** are managed in **Settings** (Employee Engagement, HR & People, Operations,
  Compliance & Risk, IT & Security, Finance, Culture & Wellbeing to start). The question bank has its own.
- **New survey** (a side drawer) takes a title, category, the org block it is **aimed at**, and a description.
  That creates a **draft** and opens the **builder**.
- **Builder:** sections and questions (pick from the bank or write new; text, single/multiple choice,
  rating, yes/no, number, date), reorder, edit, delete. Details, instructions, the
  **responder / reviewer / approver** and the due date are set in the side panel.
- **Publish** checks there is a question and three different people, then freezes the questions and
  starts the workflow. Admins can still move the due date or swap a person. To change questions,
  **Duplicate** the survey into a new draft. **Close** withdraws a survey that is in progress.
- Drafts are visible to administrators only.

`<draft>` → publish → `Awaiting response → Awaiting review → Awaiting approval → Approved`, with `Returned`
(reviewer or approver sends it back with a comment) and `Closed`. Rules live in `backend/apps/surveys/services.py`.

## More

`docs/` has the architecture, multi-tenancy, data model, workflow, API reference, UX notes and testing guide.
Run `make test` (unit tests), `make smoke` (API checks, backend running), `make lint`, `make typecheck`.

## Layout

```
backend/apps/tenants        Tenant + Domain, provisioning, seed commands
backend/apps/users          User (public) and UserTenantMembership
backend/apps/authentication JWT login scoped to the workspace
backend/apps/organisation   org blocks (hierarchy) and members (per workspace)
backend/apps/question_bank  reusable questions and their categories
backend/apps/surveys        categories, sections/questions (builder), publish/close/duplicate and the three-role workflow
src/app/(dashboard)/<feature>/   page.tsx + FeaturePage.tsx + _components/ + _hooks/  (see docs/ARCHITECTURE.md)
src/components/{ui,shared}/ primitives and reusable compositions
src/lib/ · src/hooks/ · src/types/   api client, tenant helpers, shared hooks, API shapes
scripts/api_smoke_test.py   API checks: isolation, permissions, workflow (make smoke)
```
