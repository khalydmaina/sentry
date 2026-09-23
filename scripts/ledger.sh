#!/usr/bin/env bash
# Starts a two-participant Canton network, uploads the Sentry contracts to both
# nodes and allocates the demo parties on the node that hosts them.
#
#   sandbox   :6864  Owner, Agent          - the wallet node
#   pebblebox :7864  Bank, Merchant, ...   - the counterparty node
#
# Both participants share one synchronizer and settle the same transactions,
# which is what makes the privacy page evidence rather than assertion.
# Ctrl-C stops them; all state is in memory only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/.ledger"
DAR="$ROOT/main/.daml/dist/sentry-0.1.0.dar"
SCRIPTS_DAR="$ROOT/test/.daml/dist/sentry-test-0.1.0.dar"
CONF="$ROOT/scripts/two-node.conf"

WALLET_JSON="http://localhost:6864"
COUNTERPARTY_JSON="http://localhost:7864"
WALLET_GRPC=6865
COUNTERPARTY_GRPC=7865

rm -rf "$RUN" && mkdir -p "$RUN"
(cd "$ROOT/test" && dpm build > "$RUN/build.out" 2>&1) || { cat "$RUN/build.out"; exit 1; }

cd "$RUN"
dpm sandbox --no-tty -c "$CONF" > "$RUN/sandbox.out" 2>&1 &
SANDBOX=$!
trap 'kill $SANDBOX 2>/dev/null || true' EXIT

echo "Starting two Canton participants..."
until grep -q 'Successfully started all nodes' "$RUN/log/canton.log" 2>/dev/null; do
  kill -0 $SANDBOX 2>/dev/null || { echo "Canton exited:"; tail -20 "$RUN/sandbox.out"; exit 1; }
  sleep 1
done

# Both participants join the synchronizer a moment after the nodes report
# started, and a package upload before that fails to autodetect one.
echo "Waiting for both participants to join the synchronizer..."
for attempt in $(seq 1 60); do
  connected=$(grep -c 'Connected to synchronizer and starting' "$RUN/log/canton.log" 2>/dev/null || true)
  [ "${connected:-0}" -ge 2 ] && break
  sleep 1
done
[ "${connected:-0}" -ge 2 ] || { echo "Participants never connected"; tail -20 "$RUN/log/canton.log"; exit 1; }

upload() { # name, json api
  echo "Uploading $(basename "$DAR") to $1..."
  for attempt in $(seq 1 30); do
    status=$(curl -s -o "$RUN/upload-$1.out" -w '%{http_code}' -X POST "$2/v2/packages" \
      -H 'Content-Type: application/octet-stream' --data-binary @"$DAR")
    [ "$status" = 200 ] && return 0
    grep -q CANNOT_AUTODETECT_SYNCHRONIZER "$RUN/upload-$1.out" || { echo "Upload to $1 failed ($status):"; cat "$RUN/upload-$1.out"; exit 1; }
    sleep 2
  done
  echo "Upload to $1 never succeeded"; cat "$RUN/upload-$1.out"; exit 1
}
upload sandbox "$WALLET_JSON"
upload pebblebox "$COUNTERPARTY_JSON"

allocate() { # script name, grpc port, label
  echo "Allocating $3 parties..."
  dpm script --dar "$SCRIPTS_DAR" --script-name "Setup:$1" \
    --ledger-host localhost --ledger-port "$2" --wall-clock-time \
    > "$RUN/setup-$3.out" 2>&1 || { cat "$RUN/setup-$3.out"; exit 1; }
}
allocate walletParties "$WALLET_GRPC" wallet
allocate counterpartyParties "$COUNTERPARTY_GRPC" counterparty

echo
echo "Ledger ready."
echo "  wallet node       $WALLET_JSON        Owner, Agent"
echo "  counterparty node $COUNTERPARTY_JSON  Bank, Merchant, Stranger, Outsider"
echo "Ctrl-C to stop."
wait $SANDBOX
