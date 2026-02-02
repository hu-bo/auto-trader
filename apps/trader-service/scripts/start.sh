#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${APP_PORT:-9003}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --reload

