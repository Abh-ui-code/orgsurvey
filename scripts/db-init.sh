#!/usr/bin/env bash
# Create the OrgSurvey PostgreSQL database if it does not exist.
#
# Reads credentials from backend/.env (DATABASE_URL) so it uses exactly the
# role Django uses.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/backend/.env"

[[ -f "$ENV_FILE" ]] || { echo "ERROR: $ENV_FILE not found." >&2; exit 1; }
URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n1 | sed -E 's/^DATABASE_URL=//; s/^["'\'']//; s/["'\'']$//')
[[ -n "$URL" ]] || { echo "ERROR: DATABASE_URL is empty in backend/.env" >&2; exit 1; }

rest="${URL#*://}"; userpass="${rest%%@*}"; hostdb="${rest#*@}"
PG_USER="${userpass%%:*}"; PG_PASSWORD="${userpass#*:}"
hostport="${hostdb%%/*}"; PG_NAME="${hostdb#*/}"; PG_NAME="${PG_NAME%%\?*}"
PG_HOST="${hostport%%:*}"; PG_PORT="5432"; [[ "$hostport" == *:* ]] && PG_PORT="${hostport#*:}"
export PGPASSWORD="$PG_PASSWORD"

echo "==> Ensuring database '$PG_NAME' exists on $PG_HOST:$PG_PORT (user=$PG_USER)"

if ! psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d postgres -tAc "SELECT 1" >/dev/null 2>&1; then
    cat >&2 <<MSG
ERROR: cannot connect to PostgreSQL as '$PG_USER'.
  - Is PostgreSQL running?
  - Does the role exist? Create it once with:
      sudo -u postgres psql -c "CREATE ROLE $PG_USER LOGIN PASSWORD '<password>' CREATEDB;"
    then put the same user/password in DATABASE_URL in backend/.env.
MSG
    exit 1
fi

EXISTS=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='$PG_NAME'" 2>/dev/null || echo "")
if [[ "$EXISTS" == "1" ]]; then
    echo "    Database already exists — nothing to do."
else
    createdb -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" "$PG_NAME"
    echo "    Created."
fi
