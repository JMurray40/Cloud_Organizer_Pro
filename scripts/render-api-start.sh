#!/bin/bash
set -e
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run start
