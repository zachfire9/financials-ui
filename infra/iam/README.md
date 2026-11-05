# Deploy role IAM policies

The IAM role GitHub Actions uses to deploy this repo is managed by hand in AWS, not by `template.yaml`. These files are the source of truth for what that role should allow. Change them in a PR first, then apply them.

| File | Applies to |
|------|------------|
| `github-oidc-trust.json` | Trust policy of `financials-ui-github-deploy-role-v2`: only `master` of this repo can use the role |
| `github-deploy-policy.json` | Inline policy `financials-ui-github-deploy-policy` on the same role: deploy the frontend stack, sync the bucket, invalidate the distribution |

## Placeholders

Real account values are kept out of git. Fill these in a copy before applying:

| Placeholder | Where to find it |
|-------------|------------------|
| `<aws-account-id>` | `aws sts get-caller-identity --query Account --output text` |
| `<distribution-id>` | `FrontendDistributionId` output of the `financials-ui` stack |
| `<certificate-id>` | The ID at the end of the `CERTIFICATE_ARN` repo variable (ACM, us-east-1) |

The trust policy's `sub` uses GitHub's ID-based subject format (`zachfire9@373494/financials-ui@105614969`), which this repo is configured to send. See `docs/github-actions-deploy.md`.

## Applying

Save the filled-in copies in the repo root. `/*-policy*.json` and `/*-trust*.json` are gitignored there, so they can't be committed by accident.

```powershell
aws iam update-assume-role-policy --role-name financials-ui-github-deploy-role-v2 --policy-document file://github-oidc-trust.filled.json
aws iam put-role-policy --role-name financials-ui-github-deploy-role-v2 --policy-name financials-ui-github-deploy-policy --policy-document file://github-deploy-policy.filled.json
```

Then run the deploy workflow once with `DEPLOY_FRONTEND_INFRA=true` to confirm the role still works.

## Notes

- The distribution ID is pinned. If CloudFormation ever replaces the distribution, update `<distribution-id>`.
- A few actions have no resource-level scoping in AWS and stay on `*`: `cloudformation:ValidateTemplate`, `acm:ListCertificates`, `cloudfront:CreateDistribution` and `cloudfront:CreateOriginAccessControl`.
- Route 53 permissions aren't included because the stack doesn't manage DNS (`CUSTOM_DOMAIN_HOSTED_ZONE_ID` is unset). Add `route53:ChangeResourceRecordSets` scoped to the hosted zone if that changes.
