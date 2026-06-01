#!/usr/bin/env bash
# Stop frontend and ServiceHub dev servers (ports 3000 and 3001).

for port in 3000 3001; do
  pid=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "Stopping process on port $port (PID $pid)..."
    kill -9 $pid 2>/dev/null || true
  fi
done
echo "Done. Ports 3000 and 3001 are free."
