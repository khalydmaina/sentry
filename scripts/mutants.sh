#!/usr/bin/env bash
# Mutation testing for Sentry's policy checks.
#
# A passing suite proves the tests run, not that they would notice if the
# contract were wrong. Each mutant is a plausible one-character error in a rule
# that decides whether money moves. A suite worth anything fails on every one.
#
# Restore is `git checkout`, so even a hard kill cannot leave a mutant behind.
set -uo pipefail

ROOT="$HOME/sentry"
REL="main/daml/Wallet/Policy.daml"
SRC="$ROOT/$REL"
export PATH="$HOME/.dpm/bin:$PATH"

restore() { (cd "$ROOT" && git checkout -- "$REL"); }
trap restore EXIT INT TERM

run_suite() {
  (cd "$ROOT" && dpm build --all > /dev/null 2>&1) || return 1
  (cd "$ROOT/test" && dpm test > /tmp/mut.out 2>&1) || return 1
  grep -qE ": ok," /tmp/mut.out && ! grep -qiE "FAILURE|Aborted|test failed" /tmp/mut.out
}

mutate() { # find replace
  python3 - "$SRC" "$1" "$2" <<'PY'
import sys
p, find, repl = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(p).read()
if find not in s:
    sys.exit(2)
open(p, 'w').write(s.replace(find, repl, 1))
PY
}

declare -a NAMES=(
  "per-transaction cap boundary"
  "rolling cap boundary"
  "auto-approve threshold boundary"
  "allowlist check removed"
  "balance check boundary"
  "positive-amount guard weakened"
  "rolling window boundary"
)
declare -a FIND=(
  'amount > p.perTxCap'
  'windowTotal + amount > p.dailyCap'
  'amount <= autoApproveThreshold'
  '[reasonNotAllowlisted | not (counterparty `elem` p.allowedCounterparties)]'
  'amount > h.amount'
  '(amount > 0.0)'
  'subTime now t < p.windowLength'
)
declare -a REPL=(
  'amount >= p.perTxCap'
  'windowTotal + amount >= p.dailyCap'
  'amount < autoApproveThreshold'
  '[]'
  'amount >= h.amount'
  '(amount >= 0.0)'
  'subTime now t <= p.windowLength'
)

caught=0; total=0
printf "%-34s | %s\n" "mutant" "result"
printf -- "-----------------------------------|--------\n"
for i in "${!NAMES[@]}"; do
  restore
  if ! mutate "${FIND[$i]}" "${REPL[$i]}"; then
    printf "%-34s | SKIPPED (pattern not found)\n" "${NAMES[$i]}"
    continue
  fi
  total=$((total+1))
  if run_suite; then
    printf "%-34s | SURVIVED\n" "${NAMES[$i]}"
  else
    printf "%-34s | caught\n" "${NAMES[$i]}"
    caught=$((caught+1))
  fi
done

restore
(cd "$ROOT" && dpm build --all > /dev/null 2>&1)
echo
echo "$caught of $total mutants caught"
(cd "$ROOT" && git diff --quiet -- "$REL" && echo "contract restored clean" || echo "WARNING: contract still modified")
