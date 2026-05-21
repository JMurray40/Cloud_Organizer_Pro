#!/bin/bash
set -e
pnpm install --no-frozen-lockfile
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/db run push
