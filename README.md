# Financials UI

A local-first frontend for the Financials API. This repo has been reset from the old Django/Heroku prototype to a Vite + React + TypeScript app.

## Current status

- Runtime: Vite React single-page app
- Current branch focus: basic app shell
- Next planned area: connect to the `/financial-items` API
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

Start the dev server:

```powershell
npm run dev
```

The Vite dev server listens on port `5173` and includes a local proxy from `/api/*` to the Financials API target. That proxy is intended for local development and same-network smoke testing before adding API CORS support.

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
