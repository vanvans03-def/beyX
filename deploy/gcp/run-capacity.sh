#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/beyx
install -d -m 700 perf
docker pull node:22-alpine >/dev/null
# Keep test dependencies in a separate directory, not in the database container.
docker run --rm --network host --memory=1g --cpus=1 \
  -e GCP_VM_CAPACITY=1 -e PERF_FETCH_CONNECTIONS=64 -e NODE_PATH=/app/perf/node_modules \
  -v /opt/beyx:/app -w /app node:22-alpine \
  sh -c 'npm install --prefix /app/perf --no-save --no-package-lock pg bcryptjs dotenv undici >/dev/null && mkdir -p /app/scripts/testing/node_modules && ln -sfn /app/perf/node_modules/undici /app/scripts/testing/node_modules/undici && node scripts/testing/run-gcp-capacity.cjs'
