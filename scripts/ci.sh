#!/usr/bin/env bash
# Everything the README claims, checked on one clean machine.
#
# Boots the three participants with scripts/ledger.sh, creates a wallet, and
# then asks the ledger each question the materials answer: what the four
# requests become, whether the agent's forbidden commands are refused, which
# node holds the policy, whether a held request needs both governance members,
# and whether the owner survives losing a host. Any answer that differs from
# the claim fails the run.
#
# Used by .github/workflows/ci.yml, and runnable locally the same way.
set -uo pipefail
export PYTHONUNBUFFERED=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/.ledger"
OUT="$ROOT/.ci"
rm -rf "$OUT" && mkdir -p "$OUT"
FAILED=0

pass() { echo "  PASS  $1"; }
fail() { echo "  FAIL  $1"; FAILED=1; }
section() { echo; echo "== $1"; }

section "Contracts: every Daml script on the in-memory ledger"
(cd "$ROOT" && dpm build --all > "$OUT/build.out" 2>&1) || { cat "$OUT/build.out"; exit 1; }
(cd "$ROOT/test" && dpm test > "$OUT/test.out" 2>&1)
ok=$(grep -c ": ok," "$OUT/test.out" || true)
bad=$(grep -ciE ": (failed|error)|Aborted" "$OUT/test.out" || true)
grep ": ok," "$OUT/test.out" | sed 's/^daml\//    /; s/: ok,.*//'
[ "$ok" -gt 0 ] && [ "$bad" -eq 0 ] && pass "$ok scripts pass, 0 fail" || { fail "$ok pass, $bad fail"; cat "$OUT/test.out"; }

section "Ledger: three Canton participants on one synchronizer"
"$ROOT/scripts/ledger.sh" > "$OUT/ledger.out" 2>&1 &
LEDGER=$!
stop() {
  kill "$LEDGER" 2>/dev/null
  # Killing ledger.sh does not reach the Canton JVM: dpm hands the sandbox to
  # a java process outside that tree, which Ctrl-C only reaches because it
  # signals the whole terminal. Stop it by its own command line.
  pkill -f "dpm sandbox" 2>/dev/null
  pkill -f "canton-open-source.*three-node.conf" 2>/dev/null
  wait 2>/dev/null
}
trap stop EXIT
started=$(date +%s)
until grep -q "Ledger ready." "$OUT/ledger.out"; do
  if ! kill -0 "$LEDGER" 2>/dev/null; then
    cat "$OUT/ledger.out"; tail -50 "$RUN/log/canton.log" 2>/dev/null; exit 1
  fi
  [ $(( $(date +%s) - started )) -gt 1500 ] && { echo "Ledger not ready after 25 min"; cat "$OUT/ledger.out"; exit 1; }
  sleep 5
done
sed -n '/Ledger ready./,$p' "$OUT/ledger.out" | grep -v "Ctrl-C"
echo "  ready in $(( $(date +%s) - started ))s"

section "Privacy: which node holds the policy"
python3 "$ROOT/scripts/hosting-check.py" | tee "$OUT/privacy.out"
has() { grep -F "$1" "$OUT/privacy.out" | grep -q "'WalletPolicy'"; }
has "owner, asked of sandbox" && pass "sandbox (hosts the owner) holds the policy" || fail "sandbox is missing the policy"
has "owner, asked of sidebox" && pass "sidebox (second host) holds the policy" || fail "sidebox is missing the policy"
has "owner, asked of pebblebox" && fail "pebblebox received the policy" || pass "pebblebox never received the policy, even asked as the owner"
has "bank," && fail "the bank can see the policy" || pass "the bank sees its holding and not the policy"

section "Agent: four requests, decided by the ledger"
agent() { node "$ROOT/agent/sentry-agent.mjs" "$@"; }
expect() { # label, wanted exit code, agent args...
  local label=$1 want=$2; shift 2
  agent request "$@"; local got=$?
  [ "$got" -eq "$want" ] && pass "$label" || fail "$label (exit $got, wanted $want)"
}
expect "40 to merchant executes"            0 --amount 40 --to merchant --memo "api credits"
expect "120 to merchant is held"            2 --amount 120 --to merchant --memo "over auto-approve"
expect "10 to stranger is held"             2 --amount 10 --to stranger --memo "not allowlisted"
expect "5000 to merchant is rejected"       3 --amount 5000 --to merchant --memo "over balance"

section "Agent: commands it is free to send, refused by the ledger"
agent probe | tee "$OUT/probe.out"
probe=${PIPESTATUS[0]}
auth=$(grep -c "DAML_AUTHORIZATION_ERROR" "$OUT/probe.out" || true)
[ "$probe" -eq 0 ] && [ "$auth" -eq 4 ] && pass "4 of 4 refused with DAML_AUTHORIZATION_ERROR" || fail "probe exit $probe, $auth authorization errors"
grep -q "Balance before: 960.00" "$OUT/probe.out" && grep -q "Balance after:  960.00" "$OUT/probe.out" \
  && pass "balance 960.00 before and after" || fail "balance moved during the probe"

section "Shared control: a held request needs both governance members"
python3 "$ROOT/scripts/governance-demo.py" | tee "$OUT/governance.out"
gov=${PIPESTATUS[0]}
grep -q "try to release on 1 .*REFUSED" "$OUT/governance.out" && pass "refused at 1 of 2" || fail "released on one confirmation"
[ "$gov" -eq 0 ] && pass "settled at 2 of 2" || fail "did not settle at 2 of 2"

section "Availability: the owner survives losing a host"
python3 "$ROOT/scripts/outage-demo.py" | tee "$OUT/outage.out"
[ "${PIPESTATUS[0]}" -eq 0 ] && pass "owner could spend throughout" || fail "owner lost the ability to spend"

section "Result"
if [ "$FAILED" -eq 0 ]; then echo "  Every claim held."; else echo "  At least one claim did not hold."; fi
exit "$FAILED"
