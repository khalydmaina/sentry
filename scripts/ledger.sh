#!/usr/bin/env bash
# Starts a three-participant Canton network, uploads the Sentry contracts to all
# nodes, and allocates the demo parties on the node that hosts them.
#
#   sandbox   :6864  Owner, Agent          - the wallet node
#   pebblebox :7864  Bank, Merchant, ...   - the counterparty node
#   sidebox   :8864  a second host for the owner, nobody's counterparty
#
# All three share one synchronizer and settle the same transactions, which is
# what makes the privacy page evidence rather than assertion. The owner is
# hosted on sandbox and sidebox and deliberately not on pebblebox, so one
# topology shows both that the owner exists on more than one independent node
# and that the counterparty's node still never receives the policy.
# Ctrl-C stops them; all state is in memory only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/.ledger"
DAR="$ROOT/main/.daml/dist/sentry-0.1.0.dar"
SCRIPTS_DAR="$ROOT/test/.daml/dist/sentry-test-0.1.0.dar"
CONF="$ROOT/scripts/three-node.conf"
REMOTE="$ROOT/scripts/remote.conf"

WALLET_JSON="http://localhost:6864"
COUNTERPARTY_JSON="http://localhost:7864"
GOVERNANCE_JSON="http://localhost:8864"
WALLET_GRPC=6865
COUNTERPARTY_GRPC=7865
GOVERNANCE_GRPC=8865

rm -rf "$RUN" && mkdir -p "$RUN"
(cd "$ROOT/test" && dpm build > "$RUN/build.out" 2>&1) || { cat "$RUN/build.out"; exit 1; }

cd "$RUN"
dpm sandbox --no-tty -c "$CONF" > "$RUN/sandbox.out" 2>&1 &
SANDBOX=$!
trap 'kill $SANDBOX 2>/dev/null || true' EXIT

echo "Starting three Canton participants..."
until grep -q 'Successfully started all nodes' "$RUN/log/canton.log" 2>/dev/null; do
  kill -0 $SANDBOX 2>/dev/null || { echo "Canton exited:"; tail -20 "$RUN/sandbox.out"; exit 1; }
  sleep 1
done

# The built-in bootstrap connects some participants and not others, and which
# ones varies between runs, so every participant is reconnected explicitly.
# reconnect_all is idempotent.
echo "Connecting all participants to the synchronizer..."
console() { dpm canton-console -c "$REMOTE" --no-tty < "$1" 2>&1 | sed 's/\x1b\[[0-9]*m//g'; }
for attempt in $(seq 1 30); do
  out=$(console "$ROOT/scripts/connect-all.sc" || true)
  echo "$out" | grep -q "CONNECTED=.*sandbox:1.*pebblebox:1.*sidebox:1" && break
  sleep 3
done
echo "$out" | grep -o "CONNECTED=.*" || { echo "Participants never connected"; exit 1; }

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
upload sidebox "$GOVERNANCE_JSON"

allocate() { # script name, grpc port, label
  echo "Allocating $3 parties..."
  dpm script --dar "$SCRIPTS_DAR" --script-name "Setup:$1" \
    --ledger-host localhost --ledger-port "$2" --wall-clock-time \
    > "$RUN/setup-$3.out" 2>&1 || { cat "$RUN/setup-$3.out"; exit 1; }
}
allocate walletParties "$WALLET_GRPC" wallet
allocate counterpartyParties "$COUNTERPARTY_GRPC" counterparty

# Host the owner on a second participant, before it holds any contracts.
echo "Hosting the owner party on sandbox and sidebox..."
console "$ROOT/scripts/host-owner.sc" | grep -oE "HOSTS=.*|SANDBOX_ERR=.*|SIDEBOX_ERR=.*" || true

echo
echo "Ledger ready."
echo "  wallet node       $WALLET_JSON        Owner, Agent"
echo "  counterparty node $COUNTERPARTY_JSON  Bank, Merchant, Stranger, Outsider"
echo "  governance node   $GOVERNANCE_JSON  second host for the Owner party"
echo "Ctrl-C to stop."
wait $SANDBOX
