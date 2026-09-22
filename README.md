# Financials UI

A local-first frontend for the Financials API. This repo has been reset from the old Django/Heroku prototype to a Vite + React + TypeScript app.

## Current status

- Runtime: Vite React single-page app
- Current branch focus: SAM-managed static AWS frontend hosting infrastructure
- Implemented workflows: financial-items CRUD, browser-owned ephemeral JSON sessions, JSON backup export/import, local proxy smoke testing, repository-backed or request-supplied saving/drawdown projection previews, placeholder-safe static deploy commands, and SAM-managed S3/CloudFront frontend infrastructure
- Static hosting direction: S3/CloudFront first via `npm run build` output in `dist/`; Amplify Hosting remains a later migration option if its familiar GitHub-connected workflow becomes preferable
- Later planned area: deployed access control before real data

## Requirements

- Node.js 20+
- npm 10+
- Optional for AWS infrastructure deploys: AWS CLI and AWS SAM CLI

## Local development

Install dependencies:

```powershell
npm install
```

Copy local config:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` if your local API is not available at `http://localhost:8080`. Keep real machine-specific addresses, hostnames, and private runtime values out of commits. For static AWS hosting, copy `.env.production.example` to ignored `.env.production` instead of putting deployed values in `.env.example`.

Session modes:

- `VITE_FINANCIALS_SESSION_MODE=persistent` keeps the existing API-backed financial item CRUD workflow.
- `VITE_FINANCIALS_SESSION_MODE=ephemeral` keeps imported JSON data in browser memory only. Create/edit/delete/reorder actions do not call the financial-items API, projections send the current items in the request body, and refreshing or closing the browser loses unsaved changes unless you export JSON again.

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

This local network smoke test intentionally keeps browser API calls behind the Vite dev proxy. Static-hosting builds use `VITE_FINANCIALS_API_BASE_URL` directly instead.

## Financial-items UI

The app can now exercise the existing `/financial-items` API contract:

- List saved financial items
- Create an example financial item
- Edit an existing financial item with a full `PUT` payload
- Delete an item
- Export a JSON backup file for saved items or the current browser-owned session
- Import a JSON backup file, replacing saved items in persistent mode or replacing the current browser session in ephemeral mode
- Show loading, empty, validation/error, backup success, and stale-data states

## Projection UI

The app can also exercise the existing `POST /projections` API contract through the Vite `/api/*` proxy:

- Enter saving years, optional drawdown years, annual withdrawal, and annual withdrawal inflation assumptions.
- Optionally grow saving-year annual contributions by the withdrawal inflation rate for the projection only; saved financial item contribution values are not changed.
- Calculate from the current repository-backed financial items in persistent mode or from the current browser-owned imported items in ephemeral mode by sending `savingYears`, `drawdownYears`, `annualWithdrawalCents`, `annualWithdrawalInflationRateBasisPoints`, and, for ephemeral mode, request-supplied `items`.
- Review a year-grouped table that lists each item with phase, annual withdrawal, contribution, withdrawal, growth, and item balance details while showing each year, annual withdrawal, and combined balance once per year.
- Keep the aggregate final projected total visible above the table.
- Keep the last successful projection visible if a recalculation fails transiently.

This drawdown projection UI intentionally does not send hypothetical unsaved items, persist scenarios, choose item-specific drawdown return rates, configure withdrawal ordering, or add richer charts yet.

Use fake/example data only while testing this public repo workflow. Real financial values belong in local/private runtime data, not committed docs or fixtures.

## Static AWS hosting

Use this workflow for a low-cost S3 + CloudFront static deploy. Keep real bucket names, CloudFront distribution IDs, deployed API URLs, API keys, and custom domains out of committed files unless you intentionally decide they are public-safe.

The deployed backend API must already exist from the sibling `financials-api` SAM stack. Static hosting should use `ephemeral` session mode until the next access-control step adds deployed API protection; use fake data only before then.

1. Copy the production placeholder config locally:

   ```powershell
   Copy-Item .env.production.example .env.production
   ```

2. Edit `.env.production` with your deployed API Gateway base URL and ephemeral mode:

   ```env
   VITE_FINANCIALS_API_BASE_URL=https://<api-id>.execute-api.<aws-region>.amazonaws.com
   VITE_FINANCIALS_SESSION_MODE=ephemeral
   ```

3. Build the static app:

   ```powershell
   npm run build
   ```

4. Sync `dist/` to the provided frontend bucket:

   ```powershell
   .\scripts\deploy-static.ps1 -BucketName "<frontend-bucket-name>" -Profile zachfire9
   ```

5. If the site is served through CloudFront, include the distribution ID so the script requests an invalidation:

   ```powershell
   .\scripts\deploy-static.ps1 -BucketName "<frontend-bucket-name>" -DistributionId "<cloudfront-distribution-id>" -Profile zachfire9
   ```

Suggested AWS shape:

- A private S3 bucket stores the `dist/` files.
- CloudFront serves the bucket over HTTPS.
- CloudFront Origin Access Control allows CloudFront to read from the private bucket without making the bucket public.
- SPA fallback maps CloudFront 403/404 responses to `index.html` so direct browser refreshes work.
- Configure the API stack's CORS allowed origins with the CloudFront/static site origin, using deploy parameters instead of committed real values.

### SAM-managed frontend infrastructure

This repo includes `template.yaml` for creating the low-cost frontend hosting resources with SAM/CloudFormation. The template creates:

- a private S3 bucket for built files
- a CloudFront Origin Access Control
- a CloudFront distribution
- a bucket policy allowing CloudFront read access only
- SPA fallback behavior for browser routes
- stack outputs for the bucket name, distribution ID, CloudFront domain, and CloudFront URL

Validate the template if SAM is installed:

```powershell
npm run infra:validate
```

Create the frontend infrastructure with guided SAM deploy:

```powershell
npm run infra:deploy
```

Use `zachfire9` for the AWS profile when prompted by SAM. Leave `SiteBucketName` blank if you want CloudFormation to generate a bucket name, and keep `PriceClass_100` for the lowest-cost CloudFront edge-location default.

If you prefer running SAM directly:

```powershell
sam deploy --guided --profile zachfire9
```

`samconfig.toml` is ignored so real local stack settings stay out of git. `samconfig.example.toml` is a placeholder-safe reference if you want to copy it locally.

After the stack deploys, inspect the outputs:

```powershell
aws cloudformation describe-stacks --stack-name "<frontend-stack-name>" --profile zachfire9 --query "Stacks[0].Outputs" --output table
```

Use the stack outputs to deploy the current build assets:

```powershell
$bucket = aws cloudformation describe-stacks --stack-name "<frontend-stack-name>" --profile zachfire9 --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue | [0]" --output text
$distributionId = aws cloudformation describe-stacks --stack-name "<frontend-stack-name>" --profile zachfire9 --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId'].OutputValue | [0]" --output text
npm run build
.\scripts\deploy-static.ps1 -BucketName $bucket -DistributionId $distributionId -Profile zachfire9
```

Optional custom domain resources such as ACM certificates and Route 53 aliases are intentionally deferred until a domain is chosen. The first deploy can use the generated CloudFront URL from the `FrontendUrl` output.

Amplify Hosting remains a possible later migration if GitHub-connected deploys become worth the extra abstraction.

## Build and test

Run unit tests:

```powershell
npm test
```

Build the static app:

```powershell
npm run build
```

The production build is written to `dist/`, which is the directory to sync to the static S3 bucket or preview locally.

## Public repo boundaries

This repo is public, so committed files must not contain:

- Real financial data
- Secrets, API keys, passwords, or tokens
- LAN IPs, hostnames, router/firewall details, or machine names
- Environment-specific production configuration

Use placeholders in committed docs and `.env.example`; keep real local values in ignored `.env` files.
