install:        ## Python venv and npm packages
	cd api && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
	cd web && npm ci

demo:           ## api/site.db from invented data
	cd api && .venv/bin/python -m ebk.demo --out site.db

dev:            ## API on :8030 and the site on http://localhost:3000
	$(MAKE) -j2 api web

api:
	cd api && .venv/bin/uvicorn ebk.app:app --port 8030

web:
	cd web && API_BASE=http://127.0.0.1:8030 npx next dev

test:           ## API tests, type check, lint
	cd api && .venv/bin/python -m pytest -q
	cd web && npx tsc --noEmit && npx eslint app components lib

types:          ## regenerate web/lib/api-types.ts from the API
	cd api && .venv/bin/python -c "import json; from ebk.app import app; print(json.dumps(app.openapi()))" > /tmp/ebk-openapi.json
	cd web && npx openapi-typescript /tmp/ebk-openapi.json -o lib/api-types.ts

.PHONY: install demo dev api web test types
