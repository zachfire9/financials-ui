param(
    [Parameter(Mandatory = $true)]
    [string]$BucketName,

    [string]$DistributionId = "",

    [string]$Profile = "zachfire9",

    [string]$Region = "us-east-1",

    [string]$DistPath = "dist"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DistPath)) {
    throw "Static build directory '$DistPath' does not exist. Run 'npm run build' before deploying."
}

Write-Host "Syncing $DistPath to s3://$BucketName using AWS profile '$Profile'..."
aws s3 sync $DistPath "s3://$BucketName" --delete --profile $Profile --region $Region

if ($DistributionId.Trim().Length -gt 0) {
    Write-Host "Creating CloudFront invalidation for distribution $DistributionId..."
    aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" --profile $Profile | Out-Null
    Write-Host "Invalidation requested."
} else {
    Write-Host "No CloudFront distribution ID supplied; skipping invalidation."
}

Write-Host "Static frontend deploy complete. Use fake data only until deployed access control is enabled."
