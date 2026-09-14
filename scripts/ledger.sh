#!/usr/bin/env bash
# Starts a fresh Canton sandbox, uploads the Sentry contracts and creates the
# demo parties. Ctrl-C stops the sandbox; its state is in memory only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/.ledger"
DAR="$ROOT/main/.daml/dist/sentry-0.1.0.dar"
SCRIPTS_DAR="$ROOT/test/.daml/dist/sentry-test-0.1.0.dar"
JSON_API="http://localhost:6864"

rm -rf "$RUN" && mkdir -p "$RUN"
(cd "$ROOT/test" && dpm build > "$RUN/build.out" 2>&1) || { cat "$RUN/build.out"; exit 1; }

cd "$RUN"
dpm sandbox --no-tty > "$RUN/sandbox.out" 2>&1 &
SANDBOX=$!
trap 'kill $SANDBOX 2>/dev/null || true' EXIT

echo "Starting Canton sandbox..."
until grep -q 'Successfully started all nodes' "$RUN/log/canton.log" 2>/dev/null; do
  kill -0 $SANDBOX 2>/dev/null || { echo "Sandbox exited:"; tail -20 "$RUN/sandbox.out"; exit 1; }
  sleep 1
done

# The synchronizer connects a moment after the nodes report started.
echo "Uploading $(basename "$DAR")..."
for attempt in $(seq 1 30); do
  status=$(curl -s -o "$RUN/upload.out" -w '%{http_code}' -X POST "$JSON_API/v2/packages" \
    -H 'Content-Type: application/octet-stream' --data-binary @"$DAR")
  [ "$status" = 200 ] && break
  grep -q CANNOT_AUTODETECT_SYNCHRONIZER "$RUN/upload.out" || { echo "Upload failed ($status):"; cat "$RUN/upload.out"; exit 1; }
  sleep 2
done
[ "$status" = 200 ] || { echo "Upload never succeeded"; cat "$RUN/upload.out"; exit 1; }

echo "Creating demo parties..."
dpm script --dar "$SCRIPTS_DAR" --script-name Setup:demoParties \
  --ledger-host localhost --ledger-port 6865 --wall-clock-time \
  --output-file "$RUN/parties.json" > "$RUN/setup.out" 2>&1 || { cat "$RUN/setup.out"; exit 1; }

echo "Ledger ready. JSON API on $JSON_API. Ctrl-C to stop."
wait $SANDBOX
