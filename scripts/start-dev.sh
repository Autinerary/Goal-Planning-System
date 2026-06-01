#!/usr/bin/env bash
# Start Goal Planning frontend and ServiceHub backend for local development.
# Run from repo root: ./scripts/start-dev.sh
# Optional: ./scripts/start-dev.sh --clean   (clears .next and node_modules/.cache first)

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Optional: raise file descriptor limit (avoids "EMFILE: too many open files")
ulimit -n 65536 2>/dev/null || true

if [ "$1" = "--clean" ]; then
  echo "Clearing build caches..."
  rm -rf "$ROOT/frontend/.next" "$ROOT/frontend/node_modules/.cache"
  rm -rf "$ROOT/servicehub-mvp/.next" "$ROOT/servicehub-mvp/node_modules/.cache"
  echo "Done."
fi

echo "Stopping any existing dev servers on 3000 and 3001..."
for port in 3000 3001; do
  pid=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill -9 $pid 2>/dev/null || true
  fi
done
sleep 2

echo "Starting ServiceHub (backend) on http://localhost:3001..."
cd "$ROOT/servicehub-mvp"
PORT=3001 npm run dev &
BACKEND_PID=$!
cd "$ROOT"

echo "Starting Frontend on http://localhost:3000..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!
cd "$ROOT"

echo ""
echo "Both servers are starting in the background."
echo "  Frontend:  http://localhost:3000"
echo "  ServiceHub: http://localhost:3001"
echo ""
echo "To stop: kill $BACKEND_PID $FRONTEND_PID"
echo "Or run: ./scripts/stop-dev.sh"
wait
