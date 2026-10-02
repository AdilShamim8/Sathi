# Sathi (সাথী) — development commands.
# Commands are documented here only after they have been run and verified.

PY ?= python3

.PHONY: install data train eval demo-bundle test lint run web-build

install:          ## Install backend dependencies
	pip install -r requirements.txt

data:             ## Generate the seeded synthetic dataset
	$(PY) -m data_gen.generate

train:            ## Train forecast models (offline only, never in a request handler)
	$(PY) -m ml.train

eval:             ## Run the evaluation suite and write docs/metrics/*.json
	$(PY) -m ml.evaluate

demo-bundle:      ## Regenerate web/public/demo/*.json through the API service layer
	$(PY) -m data_gen.demo_bundle

test:             ## Backend test suite
	pytest

lint:             ## Backend lint and types
	ruff check . && mypy core api llm

run:              ## Run the backend locally
	uvicorn api.main:app --reload --port 8000

web-build:        ## Static export of the web app to web/out
	cd web && npm run build
