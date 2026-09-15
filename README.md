# Financials UI

A local-first frontend for the Financials API. This repo has been reset from the old Django/Heroku prototype to a Vite + React + TypeScript app.

## Current status

- Runtime: Vite React single-page app
- Current branch focus: `/financial-items` CRUD UI
- Next planned area: local home-network smoke test through the Vite dev proxy
- Static hosting direction: compatible with hosts such as AWS Amplify via `npm run build` output in `dist/`

## Requirements

- Node.js 20+
- npm 10+

## Local development

Install dependencies:

```powershell
npm install
```

Copy local config:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` if your local API is not available at `http://localhost:8080`. Keep real machine-specific addresses, hostnames, and private runtime values out of commits.

Start the Financials API from the sibling `financials-api` repo in a separate terminal:

```powershell
go run ./cmd/api
```

Start the UI dev server:

```powershell
npm run dev
```

The Vite dev server listens on port `5173` and includes a local proxy from `/api/*` to the Financials API target. Browser code calls `VITE_FINANCIALS_API_BASE_URL`, which defaults to `/api`; the dev server rewrites that to the local API during development.

## Financial-items UI

The app can now exercise the existing `/financial-items` API contract:

- List saved financial items
- Create an example financial item
- Edit an existing financial item with a full `PUT` payload
- Delete an item
- Show loading, empty, validation/error, and stale-data states

Use fake/example data only while testing this public repo workflow. Real financial values belong in local/private runtime data, not committed docs or fixtures.

## Build and test

Run unit tests:

```powershell
npm test
```

Build the static app:

```powershell
npm run build
```

The production build is written to `dist/`, which is the directory a static host such as AWS Amplify would publish.

## Public repo boundaries

This repo is public, so committed files must not contain:

- Real financial data
- Secrets, API keys, passwords, or tokens
- LAN IPs, hostnames, router/firewall details, or machine names
- Environment-specific production configuration

Use placeholders in committed docs and `.env.example`; keep real local values in ignored `.env` files.
