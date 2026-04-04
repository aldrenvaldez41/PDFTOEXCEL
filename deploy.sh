#!/bin/bash
set -e
cd "$(dirname "$0")"
git pull
docker compose up --build -d
docker image prune -f
echo "Deployed successfully"
