#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

API_HOST="${API_HOST:-0.0.0.0}"
API_PORT="${API_PORT:-8000}"

if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and blank lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    # Only export valid KEY=VALUE assignments
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done < .env
fi

if [ -x ".venv/bin/uvicorn" ]; then
  UVICORN=".venv/bin/uvicorn"
elif command -v uvicorn >/dev/null 2>&1; then
  UVICORN="uvicorn"
else
  echo "uvicorn not found. Create the venv and install deps:"
  echo "  python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

exec "$UVICORN" app.main:app --host "${API_HOST}" --port "${API_PORT}" --reload
