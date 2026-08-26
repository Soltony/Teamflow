#!/usr/bin/env bash
#
# Verifies that a session survives an application restart, which it must,
# because sessions live in the database rather than in server memory.
#
# Run from the project root after `npx next build`:
#   bash scripts/test-restart-persistence.sh
#
set -uo pipefail

PORT=3399
BASE="http://localhost:$PORT"
LOG=".tmpwork/restart-server.log"
PHONE="0700000031"
PASSWORD='Restart!Pass1'

mkdir -p .tmpwork
pass=0
fail=0

check() {
  if [ "$2" = "$3" ]; then
    pass=$((pass + 1)); echo "  PASS  $1"
  else
    fail=$((fail + 1)); echo "  FAIL  $1 — expected $3, got $2"
  fi
}

start_server() {
  # Refuse to start on top of a server that is still running, otherwise the
  # readiness probe below would pass against the *old* process and the whole
  # restart test would silently prove nothing.
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/login" 2>/dev/null)" = "200" ]; then
    echo "  something is already serving port $PORT — aborting"; return 1
  fi
  node node_modules/next/dist/bin/next start -p "$PORT" > "$LOG" 2>&1 &
  SRV_PID=$!
  for _ in $(seq 1 45); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/login" 2>/dev/null)" = "200" ]; then
      return 0
    fi
    sleep 1
  done
  echo "  server failed to start:"; tail -5 "$LOG"; return 1
}

# `next start` runs the server in a grandchild, so killing the job we launched
# is not enough — kill whatever actually holds the port, then wait for it to be
# released before declaring the application down.
stop_server() {
  kill "$1" 2>/dev/null
  powershell -NoProfile -Command \
    "Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue |
     ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1
  for _ in $(seq 1 20); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/login" 2>/dev/null)" != "200" ]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

nav() { # a browser-style navigation
  curl -s -o /dev/null -w '%{http_code}' \
    -H 'accept: text/html' -H 'sec-fetch-dest: document' \
    ${1:+-H "cookie: $1"} "$BASE/dashboard" 2>/dev/null
}

echo ""
echo "Session persistence across an application restart"
echo ""

echo "1. Start the application"
start_server || exit 1
FIRST_PID=$SRV_PID
echo "  started (pid $FIRST_PID)"

echo ""
echo "2. Sign in"
LOGIN_ID=$(cat .next/static/chunks/app/login/page-*.js | grep -oE '"[0-9a-f]{40,42}"' | tr -d '"' | head -1)
COOKIE=$(curl -s -D - -o /dev/null -X POST "$BASE/login" \
  -H "Next-Action: $LOGIN_ID" \
  -H "Content-Type: text/plain;charset=UTF-8" \
  --data "[{\"phoneNumber\":\"$PHONE\",\"password\":\"$PASSWORD\"}]" \
  | grep -i '^set-cookie:' | sed -E 's/.*(nibteam_session=[^;]*).*/\1/' | tr -d '\r')

if [ -z "$COOKIE" ]; then
  echo "  FAIL  could not sign in — is the test user present?"
  kill "$FIRST_PID" 2>/dev/null
  exit 1
fi
echo "  signed in, cookie issued"
check "the session works before the restart" "$(nav "$COOKIE")" "200"

echo ""
echo "3. Stop the application"
stop_server "$FIRST_PID"
wait "$FIRST_PID" 2>/dev/null
check "the application is down" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/login" 2>/dev/null)" "000"

echo ""
echo "4. Start a brand new application process"
start_server || exit 1
echo "  started (pid $SRV_PID, previously $FIRST_PID)"

echo ""
echo "5. The same cookie against the restarted application"
check "the session still works after the restart" "$(nav "$COOKIE")" "200"
check "no cookie is still redirected to /login" "$(nav '')" "307"
check "a forged cookie is still rejected" "$(nav 'nibteam_session=forged')" "307"

stop_server "$SRV_PID"
wait "$SRV_PID" 2>/dev/null

echo ""
echo "$pass passed, $fail failed"
echo ""
[ "$fail" -eq 0 ]
