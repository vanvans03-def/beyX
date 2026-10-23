$ErrorActionPreference = 'Stop'
# Keep this command running. Ports listen only on this computer, never 0.0.0.0.
# --command selects noninteractive plink on Windows; -N disables remote commands.
& gcloud.cmd compute ssh beyx-data-1 `
    --project=beyx-production-20261020 --zone=us-central1-a --tunnel-through-iap `
    --command=true --ssh-flag=-batch --ssh-flag=-N `
    --ssh-flag=-L --ssh-flag=127.0.0.1:55432:10.42.0.10:5432 `
    --ssh-flag=-L --ssh-flag=127.0.0.1:56379:10.42.0.10:6379
exit $LASTEXITCODE
