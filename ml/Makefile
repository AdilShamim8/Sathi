# Sathi ML pipeline (ml/) — offline training & evaluation commands.
# The Next.js app in the repo root serves the trained model; this pipeline
# regenerates it. Commands are documented here only after they have been run
# and verified.

PY ?= python3

.PHONY: install data train eval demo-bundle test lint run

install:          ## Install pipeline dependencies
        pip install -r requirements.txt

data:             ## Generate the seeded synthetic dataset
        $(PY) -m data_gen.generate

train:            ## Train forecast models (offline only, never in a request handler)
        $(PY) -m ml.train && $(PY) -m ml.calibrate

eval:             ## Run the evaluation suite and write docs/metrics/*.json
        $(PY) -m ml.evaluate

demo-bundle:      ## Regenerate ../public/demo/*.json (the app's demo bundles)
        $(PY) -m data_gen.demo_bundle

test:             ## Backend test suite
        pytest

lint:             ## Backend lint and types
        ruff check . && mypy core api llm

run:              ## Run the reference FastAPI service locally (API-compat twin)
        uvicorn api.main:app --reload --port 8000
