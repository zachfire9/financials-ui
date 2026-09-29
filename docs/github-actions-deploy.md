# GitHub Actions UI deploy

This repo deploys the Financials UI from GitHub Actions when changes are merged into `master`. The workflow uses GitHub OIDC to assume an AWS IAM role, so no long-lived AWS access keys should be stored in GitHub.

Workflow file: `.github/workflows/deploy-ui.yml`

## GitHub configuration

Add these repository settings in GitHub before enabling the workflow.

### Secrets

- `AWS_DEPLOY_ROLE_ARN`: ARN of the AWS IAM role that GitHub Actions can assume for this repo.
- `FINANCIALS_ACCESS_TOKEN`: private shared token passed to Vite as `VITE_FINANCIALS_ACCESS_TOKEN` during the production build.

### Variables

Required:

- `AWS_REGION`: AWS region for the frontend stack, for example `us-east-1`.
- `FRONTEND_STACK_NAME`: CloudFormation stack name, for example `financials-ui`.
- `VITE_FINANCIALS_API_BASE_URL`: deployed API Gateway base URL, for example `https://<api-id>.execute-api.<aws-region>.amazonaws.com`.
- `VITE_FINANCIALS_SESSION_MODE`: normally `ephemeral`.

Optional:

- `DEPLOY_FRONTEND_INFRA`: set to `true` only when the workflow should run `sam deploy` for frontend infrastructure before syncing static files. Defaults to `false` so regular UI deploys do not mutate CloudFront/DNS.
- `PRICE_CLASS`: CloudFront price class for optional infra deploys, normally `PriceClass_100`.
- `CUSTOM_DOMAIN_NAME`: custom domain for optional infra deploys, for example `financials.example.com`.
- `CERTIFICATE_ARN`: ACM certificate ARN for optional infra deploys. CloudFront certificates must be in `us-east-1`.
- `CUSTOM_DOMAIN_HOSTED_ZONE_ID`: Route 53 hosted zone ID for optional DNS record management. Leave blank if alias records are managed manually.

Keep real deployed API URLs, certificate ARNs, hosted zone IDs, and tokens in GitHub settings or private operator notes, not committed config files.

## Important token note

GitHub Secrets keep `FINANCIALS_ACCESS_TOKEN` out of git and out of workflow logs. However, the current static UI architecture still bundles `VITE_FINANCIALS_ACCESS_TOKEN` into the deployed JavaScript so the browser can send the `X-Financials-Access-Token` header. This is a pragmatic personal-use blocker, not true secret storage. A later CloudFront `/api/*` proxy or real identity layer would be needed to keep the token fully server-side.

## AWS OIDC role setup

Use a trust policy scoped to this repository and `master` branch. Replace placeholders before applying:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<aws-account-id>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:zachfire9/financials-ui:ref:refs/heads/master"
        }
      }
    }
  ]
}
```

The role needs enough permissions to sync static files and invalidate CloudFront:

- CloudFormation describe stack for the frontend stack outputs
- S3 put/delete/list object permissions for the frontend bucket
- CloudFront create invalidation for the frontend distribution

If `DEPLOY_FRONTEND_INFRA=true`, the role also needs permissions to run `sam deploy` for the frontend stack, including CloudFormation stack updates, S3 bucket policy/resource updates, CloudFront distribution updates, ACM read access, and optional Route 53 record changes if `CUSTOM_DOMAIN_HOSTED_ZONE_ID` is supplied.

## Workflow behavior

On `push` to `master`, and on manual `workflow_dispatch`, the workflow:

1. Checks out the repo.
2. Sets up Node 22.
3. Runs `npm ci`.
4. Runs `npm test`.
5. Builds the production Vite app with GitHub Variables/Secrets.
6. Assumes the AWS deploy role through OIDC.
7. Optionally runs frontend `sam deploy` when `DEPLOY_FRONTEND_INFRA=true`.
8. Reads the bucket, distribution ID, and frontend URL from CloudFormation outputs.
9. Syncs `dist/` to the S3 bucket with `--delete`.
10. Invalidates CloudFront with `/*`.
11. Smoke-tests the deployed frontend URL with `curl --head`.

## Rollback

To roll back a UI deploy, either:

- revert the bad commit on `master` and let the workflow redeploy, or
- manually deploy a known-good checkout:

```powershell
npm ci
npm run build
$bucket = aws cloudformation describe-stacks --stack-name "<frontend-stack-name>" --profile zachfire9 --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue | [0]" --output text
$distributionId = aws cloudformation describe-stacks --stack-name "<frontend-stack-name>" --profile zachfire9 --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId'].OutputValue | [0]" --output text
.\scripts\deploy-static.ps1 -BucketName $bucket -DistributionId $distributionId -Profile zachfire9
```
