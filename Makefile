## OrgSurvey — Makefile
##
## Backend:  Django + django-tenants (backend/)  — venv at backend/.venv
## Frontend: Next.js web app                      — this directory
##
## A workspace lives at <subdomain>.localhost (e.g. abc.localhost:3000).
## Run `make help` for the full target list.

.DEFAULT_GOAL := help

# --- Platform-aware paths ----------------------------------------------
ifeq ($(OS),Windows_NT)
	VENV_BIN := .venv\Scripts
	PY       := $(VENV_BIN)\python.exe
	PIP      := $(VENV_BIN)\pip.exe
	NPM      := npm.cmd
else
	VENV_BIN := .venv/bin
	PY       := $(VENV_BIN)/python
	PIP      := $(VENV_BIN)/pip
	NPM      := npm
endif

MANAGE := cd backend && $(PY) manage.py

# =======================================================================
# Help
# =======================================================================
.PHONY: help
help:
	@echo "OrgSurvey — common targets"
	@echo ""
	@echo "  Setup"
	@echo "    setup            Full first-time setup: deps + DB + migrate + seed (scripts/setup.sh)"
	@echo "    install          Backend venv + pip install, npm install"
	@echo ""
	@echo "  Development"
	@echo "    dev              backend + web, in parallel (Ctrl+C stops both)"
	@echo "    backend          Django on 0.0.0.0:8000"
	@echo "    web              Next.js dev server on :3000"
	@echo "    web-prod         Production web build + start"
	@echo "    build            Production build of the web app"
	@echo ""
	@echo "  Database / workspaces"
	@echo "    migrate          Migrate the public (shared) schema"
	@echo "    migrate-tenants  Migrate every workspace schema"
	@echo "    makemigrations   Generate new Django migrations"
	@echo "    seed             Seed workspaces abc and xyz with sample data (DEBUG only)"
	@echo "    create-tenant    New workspace: make create-tenant SUB=acme NAME='Acme' EMAIL=a@b.com PASS=secret123"
	@echo "    shell            Django shell"
	@echo "    dbshell          psql shell on the dev database"
	@echo ""
	@echo "  Quality"
	@echo "    test             Backend unit tests (pure rules, no database needed)"
	@echo "    smoke            API smoke test against a running backend (make backend first)"
	@echo "    lint             Ruff (backend) + eslint (web)"
	@echo "    typecheck        tsc --noEmit"
	@echo ""
	@echo "  Housekeeping"
	@echo "    clean            Remove venv, node_modules, build output"

# =======================================================================
# Setup
# =======================================================================
.PHONY: setup install
setup:
	bash scripts/setup.sh

install:
	cd backend && python3 -m venv .venv && $(PIP) install --upgrade pip
	cd backend && $(PIP) install -r requirements/development.txt
	$(NPM) install

# =======================================================================
# Development
# =======================================================================
.PHONY: dev backend web web-prod build
dev:
	@$(MAKE) -j2 backend web

backend:
	$(MANAGE) runserver 0.0.0.0:8000

web:
	$(NPM) run dev

web-prod: build
	$(NPM) run start

build:
	$(NPM) run build

# =======================================================================
# Database / workspaces
# =======================================================================
.PHONY: migrate migrate-tenants makemigrations seed create-tenant shell dbshell
migrate:
	$(MANAGE) migrate_schemas --shared

migrate-tenants:
	$(MANAGE) migrate_schemas --tenant

makemigrations:
	$(MANAGE) makemigrations

# DEBUG-only (see apps/tenants/management/commands/seed_dev_tenant.py).
seed:
	$(MANAGE) seed_dev_tenant --subdomain abc --name "ABC Corporation"
	$(MANAGE) seed_dev_tenant --subdomain xyz --name "XYZ Industries"

create-tenant:
	@if [ -z "$(SUB)" ] || [ -z "$(NAME)" ] || [ -z "$(EMAIL)" ] || [ -z "$(PASS)" ]; then \
		echo "Usage: make create-tenant SUB=acme NAME='Acme Ltd' EMAIL=admin@acme.com PASS=secret123"; exit 1; \
	fi
	$(MANAGE) create_tenant --subdomain "$(SUB)" --name "$(NAME)" --admin-email "$(EMAIL)" --admin-password "$(PASS)"

shell:
	$(MANAGE) shell

dbshell:
	$(MANAGE) dbshell

# =======================================================================
# Quality
# =======================================================================
.PHONY: test smoke lint typecheck
test:
	cd backend && $(VENV_BIN)/pytest

smoke:
	cd backend && $(PY) ../scripts/api_smoke_test.py

lint:
	cd backend && $(VENV_BIN)/ruff check .
	$(NPM) run lint

typecheck:
	$(NPM) run typecheck

# =======================================================================
# Housekeeping
# =======================================================================
.PHONY: clean
clean:
	rm -rf backend/.venv backend/.pytest_cache backend/.ruff_cache
	rm -rf node_modules .next tsconfig.tsbuildinfo
