# Architecture

OrgSurvey is a multi-tenant web app: each organisation gets its own workspace
(`abc.localhost`), with its own org hierarchy, question bank and surveys.

```
 browser  ──▶  Next.js web app (:3000)  ──▶  Django REST API (:8000)  ──▶  PostgreSQL
 abc.localhost:3000                       abc.localhost:8000            one schema per workspace
```

The web app calls the API on **its own hostname**, so the backend can tell
which workspace a request is for from the `Host` header alone.

## Repository layout

```
backend/
  orgsurvey/            settings (base / development / production / test), url confs
  apps/
    core/               abstract models, pagination, permissions, tenant middleware, shared serializers
    tenants/            Tenant + Domain (public schema), provisioning, seed commands
    users/              User + UserTenantMembership (public schema)
    authentication/     JWT login scoped to a workspace, /auth/me, change password
    organisation/       OrgUnit (the hierarchy) and Member (a person inside one workspace)
    question_bank/      reusable questions and their categories
    surveys/            categories, builder (sections/questions), lifecycle, workflow
    reports/            dashboard and report figures, computed in the database
  tests/                unit tests for the pure rules (no database)
src/
  app/                  routes -- see "Web conventions" below
  components/ui/        primitives (button, dialog, data-table, ...)
  components/shared/    reusable compositions (form dialog, pickers, badges, answer field)
  hooks/                hooks used by more than one feature
  lib/                  api client, query keys, tenant helpers, org-tree helpers, formatting, csv
  types/                the shapes the API returns, one file per domain
scripts/                setup.sh, db-init.sh, api_smoke_test.py
docs/                   this folder
```

## Backend conventions

Each app follows the same shape, so you always know where to look:

| File | Holds |
|---|---|
| `models.py` | tables. Everything inherits `BaseModel` (UUID id + timestamps) |
| `serializers.py` | input validation and output shape (DRF `ModelSerializer`s) |
| `views.py` | `ViewSet`s: permissions, querysets, filters. No business rules |
| `services.py` | **business rules** and state changes (publish, submit, review...) |
| `scoping.py` | who may see which rows |
| `urls.py` | routers |

- **Errors** always leave as `{"detail": "one readable message"}`.
- **People** are referenced by a foreign key to the public-schema `User` with
  `db_constraint=False`: the ORM can join across schemas, PostgreSQL does not
  enforce it (the tables live in different schemas).
- **API shape** is `snake_case`. Lists are `{count, next, previous, results}` and
  accept `?page=&page_size=&search=&ordering=` plus per-resource filters. Small
  reference lists (blocks, categories) are plain arrays.

## Web conventions

Every feature is a folder under `src/app/(dashboard)/`:

```
surveys/
  page.tsx              export { default } from "./SurveyListPage";
  SurveyListPage.tsx    the screen
  _components/          pieces used only by this feature
  _hooks/               data hooks for this feature (React Query)
  [id]/                 a nested route with its own page / _components / _hooks
```

- A hook or component used by **two or more** features moves up to `src/hooks/`
  or `src/components/shared/`; nothing imports another feature's private folders.
- **Server state** lives in React Query. Query keys come from `lib/query-keys.ts`
  (one namespace per domain with an `all` root to invalidate after a write).
- **Filtering, search, sorting and paging happen on the server.** Pages never
  download a whole table to filter it in the browser.
- **Forms** use `FormDialog`, so every dialog has the same header, scrolling body
  and Cancel/Save footer.
