# Financials UI

A local-first frontend for the Financials API. This repo has been reset from the old Django/Heroku prototype to a Vite + React + TypeScript app.

## Current status

- Runtime: Vite React single-page app
- Current branch focus: projection UI controls and early result tables
- Implemented workflows: financial-items CRUD, local proxy smoke testing, and repository-backed projection previews
- Static hosting direction: compatible with hosts such as AWS Amplify via `npm run build` output in `dist/`
- Later planned area: richer projection visualizations and deployment configuration once the basic projection workflow is reviewed

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

Start the UI dev server for same-machine browser testing:

```powershell
npm run dev:local
```

The local-only UI dev server listens on `http://127.0.0.1:5173` and includes a local proxy from `/api/*` to the Financials API target. Browser code calls `VITE_FINANCIALS_API_BASE_URL`, which defaults to `/api`; the dev server rewrites that to the local API during development.

## Local network smoke test

Use this checklist when testing the UI from another device on the same private network. Keep committed docs placeholder-only: Do not commit the real private IP address, hostname, firewall/router details, or real financial values.

1. Start the Financials API on the development machine with fake/example storage data only. The UI proxy target should remain local to the development machine by default:

   ```powershell
   $env:VITE_FINANCIALS_API_PROXY_TARGET="http://localhost:8080"
   ```

   This value can also live in an ignored `.env` file:

   ```env
   VITE_FINANCIALS_API_PROXY_TARGET=http://localhost:8080
   VITE_FINANCIALS_API_BASE_URL=/api
   ```

2. Start the network-visible Vite dev server from this repo:

   ```powershell
   npm run dev:network
   ```

3. From the other device, open the placeholder UI URL:

   ```text
   http://<dev-machine-private-ip>:5173
   ```

4. Exercise the financial-items CRUD flow with fake/example data only:

   - Load the UI and confirm the financial-items panel renders.
   - Add an example item.
   - Edit the example item.
   - Delete the example item.
   - Refresh the page and confirm the list reflects the API-backed state.

5. If the UI loads but API calls fail, verify the development machine can reach the API locally and that the UI terminal shows `/api/*` proxy requests. Keep any real network/firewall troubleshooting notes outside this public repo.

This step intentionally keeps browser API calls behind the Vite dev proxy. Later static-hosting work will add explicit API CORS and deploy-readiness configuration.

## Financial-items UI

The app can now exercise the existing `/financial-items` API contract:

- List saved financial items
- Create an example financial item
- Edit an existing financial item with a full `PUT` payload
- Delete an item
- Show loading, empty, validation/error, and stale-data states

## Projection UI

The app can also exercise the existing `POST /projections` API contract through the Vite `/api/*` proxy:

- Enter a whole-year projection window between the API-supported `1` and `75` year range.
- Calculate from the current repository-backed financial items by sending only `{ "years": <value> }`.
- Review a year-grouped table that lists each item with contribution, growth, and item balance details while showing each year and combined balance once per year.
- Keep the aggregate final projected total visible above the table.
- Keep the last successful projection visible if a recalculation fails transiently.

This first projection UI intentionally does not send hypothetical unsaved items, persist scenarios, or add richer charts yet.

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
