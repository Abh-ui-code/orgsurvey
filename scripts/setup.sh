#!/usr/bin/env bash
# OrgSurvey — first-time setup for a new dev machine. Idempotent; re-run anytime.
#   1. Check Node >= 18 and Python 3
#   2. Bootstrap .env.local and backend/.env from their .env.example files
#   3. Backend virtualenv + pip install
#   4. npm install
#   5. Create the PostgreSQL database if missing
#   6. Migrate the shared (public) schema
#   7. Seed two sample workspaces (abc, xyz), each with its own schema
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
echo "==> OrgSurvey setup starting in: $ROOT_DIR"

command -v node >/dev/null 2>&1 || { echo "ERROR: node not found. Install Node.js >= 18." >&2; exit 1; }
[[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]] || { echo "ERROR: Node.js >= 18 required (found $(node -v))." >&2; exit 1; }
if command -v python3 >/dev/null 2>&1; then SYSTEM_PY=python3; elif command -v python >/dev/null 2>&1; then SYSTEM_PY=python; else
    echo "ERROR: python3 not found." >&2; exit 1; fi

case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) VENV_PY="backend/.venv/Scripts/python.exe"; VENV_PIP="backend/.venv/Scripts/pip.exe" ;;
    *) VENV_PY="backend/.venv/bin/python"; VENV_PIP="backend/.venv/bin/pip" ;;
esac

[[ -f .env.local ]] || { echo "==> .env.local missing — copying from .env.example"; cp .env.example .env.local; }
[[ -f backend/.env ]] || { echo "==> backend/.env missing — copying from backend/.env.example"; cp backend/.env.example backend/.env; }

if [[ ! -x "$VENV_PY" ]]; then
    echo "==> Creating backend virtualenv at backend/.venv"
    "$SYSTEM_PY" -m venv backend/.venv
fi
echo "==> Installing backend dependencies"
"$VENV_PIP" install --quiet --upgrade pip
"$VENV_PIP" install --quiet -r backend/requirements/development.txt

echo "==> npm install"
npm install

echo "==> Ensuring PostgreSQL database exists"
bash scripts/db-init.sh

echo "==> Migrating the shared (public) schema"
( cd backend && "../$VENV_PY" manage.py migrate_schemas --shared )

echo "==> Seeding sample workspaces (each gets its own schema)"
( cd backend && "../$VENV_PY" manage.py seed_dev_tenant --subdomain abc --name "ABC Corporation" )
( cd backend && "../$VENV_PY" manage.py seed_dev_tenant --subdomain xyz --name "XYZ Industries" )

cat <<'MSG'

============================================================
 Setup complete.
============================================================

 Sign in at a workspace address (every seeded password: devpassword):
   http://abc.localhost:3000     admin@abc.localhost   neha@ (respondent)
                                 vikram@ (reviewer)    anita@ (approver)
   http://xyz.localhost:3000     admin@xyz.localhost   ... same names, separate data
 Or open http://localhost:3000 and enter a workspace name.

 *.localhost resolves to your machine in Chrome, Edge and Firefox.
 If a tool can't resolve it, add to /etc/hosts:  127.0.0.1 abc.localhost xyz.localhost

 Next:  make dev    (backend :8000 + web :3000)
MSG
