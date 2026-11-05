# AGENTS.md

Guidance for coding agents working in this repo. [README.md](README.md) has the full setup and hosting details.

## What this is

The React front end for a personal retirement planner, live at https://financials.zachfirestone.com. Users enter their accounts, set saving and drawdown years, and see how long the money lasts. Projections are calculated by the Go API in the sibling repo [financials-api](https://github.com/zachfire9/financials-api).

The app has two session modes (`VITE_FINANCIALS_SESSION_MODE`):

- **`ephemeral`** (production): accounts live in the browser's `localStorage`. Projection requests send the accounts in the body, and the financial-items API is never called.
- **`persistent`** (local development): accounts are saved through the API's `/financial-items` CRUD routes.

Changes usually need to work in both modes.

## Commands

```powershell
npm install
npm test                 # Vitest + Testing Library in jsdom; run before every commit
npm run build            # tsc -b, then vite build into dist/
npm run dev              # local-only dev server on 127.0.0.1:5173, proxies /api to localhost:8080
npm run dev:ephemeral    # same, in ephemeral mode (loads .env.ephemeral)
```

The API must be running (`go run ./cmd/api` in financials-api) for projections to work locally. Use Node 22, the version CI uses.

## Code layout

| Path | Contents |
|------|----------|
| `src/App.tsx` | Accounts list and form, drag reorder, projection settings, session handling |
| `src/ProjectionResults.tsx` | Headline, summary, yearly table |
| `src/charts/` | Hand-built SVG charts and shared scales and colors (`chartUtils.ts`) |
| `src/financialItemsApi.ts` | API client (base URL, access token header, error parsing) |
| `src/projectionErrors.ts` | Maps API and network errors to plain-language messages |
| `src/savedSession.ts` | `localStorage` load/save for ephemeral mode |
| `src/numberInput.ts`, `src/format.ts`, `src/itemValidation.ts` | Parsing user input, formatting money and percents, form validation |
| `examples/` | Example backups; `src/examples.test.ts` checks their IDs and structure, and that each is documented in `examples/README.md` |
| `template.yaml` | SAM template: S3 bucket, CloudFront distribution, security headers |
| `infra/iam/` | Deploy role IAM policies (applied by hand, see below) |

## Conventions

- **Money is integer cents and rates are integer basis points** in every API payload. Convert at the edges with the helpers in `numberInput.ts` and `format.ts`; don't do float math on stored amounts.
- **Charts are hand-built SVG.** Don't add a chart library. Account colors come from `accountColors` in `src/charts/chartUtils.ts`, assigned in account order and never cycled. Accounts past the eighth fold into "Other" (`otherAccountColor`). The flow colors (contributions, growth, withdrawals, shortfall) are fixed too. Chart text uses ink colors, not series colors.
- **Styles** live in `src/styles.css` and use the CSS variables in `:root`. Reuse those tokens rather than adding raw colors. The font (Schibsted Grotesk) is bundled through fontsource; don't load fonts from a CDN.
- **Copy is plain language and sentence case.** Error messages say what went wrong and what to do, not HTTP details. Add new API error cases to `projectionErrors.ts`.
- **Accessibility:** every input has a label, errors are tied to their fields with `aria-describedby`, charts have a title and a text alternative (the yearly table), and the app must work with the keyboard.
- **Tests** sit next to the code (`*.test.ts(x)`). Use Testing Library queries by role and label, and mock the network with `vi.stubGlobal('fetch', vi.fn())`. Use fake data only. New behavior needs a test; bug fixes need a test that fails without the fix.
- **Commit messages** use conventional prefixes: `feat:`, `fix:`, `chore:`, `docs:`.

## Public repo rules

This repo is public. Never commit:

- Real financial data or real backup files (the `examples/` files are fake)
- Secrets or tokens (`VITE_FINANCIALS_ACCESS_TOKEN` lives in GitHub Secrets and the ignored `.env.production` only)
- The AWS account ID, distribution ID, certificate ARN, bucket names or other environment-specific values. Use placeholders like `<aws-account-id>`.
- LAN IPs, hostnames or machine names. `src/docsPrivacy.test.ts` checks `README.md` and `.env.example` for private addresses.

Filled-in IAM policies (`/*-policy*.json`, `/*-trust*.json` at the repo root) are gitignored. Keep it that way.

## Deploying

- **Every push to `master` deploys** through `.github/workflows/deploy-ui.yml`: tests, build, optional `sam deploy`, S3 sync, CloudFront invalidation, then a smoke test against the custom domain. Work on a branch and open a PR; don't push to `master` directly.
- **`template.yaml` changes** only reach AWS when the `DEPLOY_FRONTEND_INFRA` repo variable is `true`. CloudFormation replaces the whole distribution config on each update, so anything set by hand in the console is lost. The custom domain must come from the `CUSTOM_DOMAIN_NAME` and `CERTIFICATE_ARN` repo variables.
- **The deploy role's IAM policies** are managed by hand in AWS. `infra/iam/` is the source of truth: change the files in a PR, then the owner applies them with the commands in [infra/iam/README.md](infra/iam/README.md). The role is scoped to this stack's bucket, distribution and certificate, so a template change that adds a new kind of AWS resource also needs a policy update, or the deploy fails with AccessDenied.
- **The production API URL and access token** are build-time variables (`VITE_FINANCIALS_API_BASE_URL`, `VITE_FINANCIALS_ACCESS_TOKEN`) set in GitHub. The token ends up in the bundled JavaScript, so treat it as public; the API's throttling is what limits abuse.
