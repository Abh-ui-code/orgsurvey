# Testing

| Suite | Run | Needs | Covers |
|---|---|---|---|
| Unit tests | `make test` | nothing (no database) | answer validation per question type, question rules, who-has-a-task logic |
| API smoke test | `make smoke` | backend running, `abc` and `xyz` seeded | ~190 checks: tenant isolation, permissions, validation, pagination, filters, the builder, publish/freeze, the whole three-role workflow, drafts, deadlines, reports, settings, tokens |
| Type check | `make typecheck` | | TypeScript across the web app |
| Lint | `make lint` | | ruff (backend) and eslint (web) |

The smoke test is **repeatable**: it creates uniquely named records, restores what it
edits and deletes what it creates.

## Browser tests

Two end-to-end suites drive a real browser against real subdomains (`abc.localhost`,
`xyz.localhost`) and the real API. They are kept out of the repo's dependencies;
to run them yourself, install Playwright (`pip install playwright && playwright install chromium`).
Between them they cover: the workspace finder and sign-in, every page, the org chart
(drawer, zoom, folding, search), users, the question bank and its categories, creating
and building a survey, publishing, the full respond → review → return → approve flow
as four different people, isolation between workspaces, exports, drafts, deadlines,
and the phone layout.

## What has been verified

- All of the above pass against a production build (`next build`), not just the dev server.
- The browser workflow suite also passes in Firefox.
- **Not tested**: Safari/WebKit (it needs system libraries that could not be installed here).
