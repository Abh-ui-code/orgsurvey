# Multi-tenancy

One **workspace** per organisation, reached at `<subdomain>.<base domain>`
(`abc.localhost` in development). Each workspace has its own PostgreSQL schema,
so one organisation's data is physically separate from another's.

## How a request finds its workspace

`apps/core/tenant_middleware.py` runs first on every request:

1. The `Host` matches a `Domain` row (`abc.localhost`) → switch to that tenant's schema.
2. The host is a platform host (`localhost`, `www.localhost`, an IP) → the public schema,
   which serves only the workspace finder.
3. Anything else → `404`. A tenant an operator has deactivated answers `403`.

The web app calls `http://<its own hostname>:8000/api`, so `abc.localhost:3000`
talks to `abc.localhost:8000`.

## What lives where

| Schema | Tables |
|---|---|
| **public** (shared) | `Tenant`, `Domain`, `User`, `UserTenantMembership`, token blacklist |
| **tenant_abc**, **tenant_xyz**, ... | `OrgUnit`, `Member`, bank questions and categories, surveys and everything under them |

A person has **one login** (one `User`, one email) and may belong to several
workspaces. Who they are *inside* a workspace (access level, block, title) is
their `Member` row in that workspace's schema.

## Login stays inside one workspace

1. `POST /api/auth/login/` on `abc.localhost` checks the password, then that the
   person has an active `UserTenantMembership` **and** an active `Member` row for *this* workspace.
2. The JWT carries a `tenant_schema` claim.
3. `IsTenantMember` requires the claim to equal the schema the request resolved to.
   A token from `abc` is therefore useless on `xyz`, even for someone who belongs to both,
   and every query also runs inside the right schema, so there is nothing to leak.

## Creating a workspace

```bash
make create-tenant SUB=acme NAME='Acme Ltd' EMAIL=admin@acme.com PASS=secret123
```

`apps/tenants/services.py::provision_tenant` creates the tenant and its domain,
creates and migrates the schema (which also seeds the default survey and question
categories), then creates the root org block and the first administrator. Any failure
is recorded on the tenant (`provisioning_error`) rather than leaving a half-built
workspace with no explanation.

`make seed` creates the development workspaces `abc` and `xyz` with sample data.

## Time zone

`TIME_ZONE` (in `backend/.env`) decides what "today" means for due dates and
overdue counts. Set it to the organisation's zone (e.g. `Asia/Kolkata`).
