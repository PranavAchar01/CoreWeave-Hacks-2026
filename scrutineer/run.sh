#!/usr/bin/env bash
# ---------------------------------------------------------------------------------------
# Scrutineer, on your own machine. One command, nothing to install beyond node and python3.
#
#   ./run.sh            build, serve on :4173, open a browser, rebuild when you edit src/
#   ./run.sh --no-open  same, without opening a browser
#   PORT=8080 ./run.sh  somewhere else
#
# It watches src/ and rebuilds on save, so you can leave it running on the side.
# ---------------------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-4173}"
OPEN=1
[ "${1:-}" = "--no-open" ] && OPEN=0

command -v node >/dev/null || { echo "run.sh: needs node on PATH" >&2; exit 1; }
command -v python3 >/dev/null || { echo "run.sh: needs python3 on PATH" >&2; exit 1; }

# A port already in use is almost always this script still running in another window; say so
# rather than failing with a stack trace from the http server.
if command -v lsof >/dev/null && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "run.sh: port $PORT is already in use — is another copy running? (PORT=… to change)" >&2
  exit 1
fi

node build.js

PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

python3 -m http.server "$PORT" --directory site/public --bind 127.0.0.1 >/dev/null 2>&1 &
PIDS+=($!)

# Rebuild on save. Polls mtimes once a second, which needs nothing installed and is plenty
# for a directory of twenty files.
watch() {
  local last=""
  while true; do
    local now
    now=$(find src build.js -type f -newermt '1970-01-01' -exec stat -f '%m %N' {} + 2>/dev/null \
       || find src build.js -type f -printf '%T@ %p\n' 2>/dev/null)
    if [ -n "$last" ] && [ "$now" != "$last" ]; then
      printf '\nrun.sh: change detected, rebuilding…\n'
      node build.js || echo "run.sh: build failed, keeping the last good copy" >&2
    fi
    last="$now"
    sleep 1
  done
}
watch &
PIDS+=($!)

URL="http://localhost:$PORT"
echo
echo "  Scrutineer is running at $URL"
echo "  watching src/ — save a file and reload the page"
echo "  ctrl-c to stop"
echo
[ "$OPEN" = "1" ] && { command -v open >/dev/null && open "$URL"; } || true
wait
