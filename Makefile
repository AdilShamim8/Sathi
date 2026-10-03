# Sathi (সাথী) — development commands.
# Commands are documented here only after they have been run and verified.

PY ?= python3

.PHONY: install data train eval demo-bundle test lint run \
        web-install web-dev web-test web-lint web-build db-push apk

install:          ## Install backend dependencies
	pip install -r requirements.txt

data:             ## Generate the seeded synthetic dataset
	$(PY) -m data_gen.generate

train:            ## Train forecast models (offline only, never in a request handler)
	$(PY) -m ml.train && $(PY) -m ml.calibrate

eval:             ## Run the evaluation suite and write docs/metrics/*.json
	$(PY) -m ml.evaluate

demo-bundle:      ## Regenerate web/public/demo/*.json through the API service layer
	$(PY) -m data_gen.demo_bundle

test:             ## Backend test suite
	pytest

lint:             ## Backend lint and types
	ruff check . && mypy core api llm

run:              ## Run the reference FastAPI backend locally
	uvicorn api.main:app --reload --port 8000

web-install:      ## Install web app dependencies (web/)
	cd web && bun install

web-dev:          ## Start the Next.js dev server (web/)
	cd web && bun run dev

web-test:         ## Web app engine + integration tests (web/)
	cd web && bun test

web-lint:         ## Web app lint + type-check (web/)
	cd web && bun run lint && bunx tsc --noEmit

web-build:        ## Production build of the web app (web/)
	cd web && bun run build

db-push:          ## Create/update the web app SQLite schema (web/db)
	cd web && bun run db:push

apk:              ## Debug APK via Capacitor (CI builds it fully; see .github/workflows/android-apk.yml)
	cd web && npx cap sync android && cd android && ./gradlew assembleDebug
