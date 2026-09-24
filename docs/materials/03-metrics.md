# Metrics / Validation Evidence

> **What judges look for:** evidence from user research, interviews, tests and key metrics.

---

## What is actually validated, and what is not

Being straight about this up front, because the two halves are in very different states.

**Validated:** that the mechanism works and that the tests would notice if it stopped working. This is measured, reproducible, and generated during the delivery window.

**Not validated:** that firms will adopt it. Zero user interviews so far. The market claims live in the GTM material as labelled hypotheses with tests attached, and none of them have been run. Presenting them as findings would be inventing evidence, so they are not here.

---

## 1. Does the ledger actually refuse?

The core claim is that the agent cannot exceed its delegation, and that this is enforced by the contract rather than by client code. `agent/sentry-agent.mjs probe` sends four commands the agent is entirely free to send, from outside the browser, holding only its own credential:

| Attempt | Result |
| --- | --- |
| Move the holding directly | `DAML_AUTHORIZATION_ERROR` |
| Spend as the owner | `DAML_AUTHORIZATION_ERROR` |
| Raise its own caps | `DAML_AUTHORIZATION_ERROR` |
| Mint itself a holding | `DAML_AUTHORIZATION_ERROR` |

**4 of 4 refused, balance unchanged either side at 960.00.** Verified against `Policy.daml`: `RequestTransfer` is the only choice with `controller agent`.

The same agent, on the same run, using the one choice it does have, against a policy of per-transaction 100, daily 200, auto-approve 50 and an allowlist holding only the merchant:

| Request | Outcome | Decided by |
| --- | --- | --- |
| 40 to the merchant | `EXECUTED` | under every cap, auto-approved |
| 120 to the merchant | `HELD` | exceeds per-transaction cap |
| 10 to the stranger | `HELD` | counterparty not allowlisted |
| 5000 to the merchant | `REJECTED` | insufficient balance |

Four requests, four different verdicts, none of them taken by the agent's own code.

This is reproducible in one command by anyone with the repo, which is the point. It is not a screenshot.

## 2. Would the tests notice if the contract were wrong?

A passing suite proves the tests run. It does not prove they would catch a mistake. So the suite was tested by breaking the contract on purpose: seven one-character mutations to the rules that decide whether money moves.

**First run: 5 of 7 caught. Two survived.**

| Mutant | First run | After |
| --- | --- | --- |
| Per-transaction cap boundary (`>` → `>=`) | caught | caught |
| Rolling cap boundary | caught | caught |
| Auto-approve threshold boundary | caught | caught |
| Allowlist check removed entirely | caught | caught |
| Balance check boundary (`>` → `>=`) | **SURVIVED** | caught |
| Positive-amount guard (`> 0` → `>= 0`) | **SURVIVED** | caught |
| Rolling window boundary | caught | caught |

The two survivors were real gaps, not noise:

- **Spending exactly the balance was untested.** A `>` → `>=` slip would refuse a legitimate full-balance spend and no test would fail.
- **A zero-amount request to an unlisted counterparty was untested.** A weakened guard would escalate it rather than abort, leaving the owner a pending approval for nothing. The existing zero-amount test used an allowlisted counterparty, where `Transfer`'s own guard catches it further down, so the test passed for the wrong reason.

Both tests were written and the mutation run repeated: **7 of 7 caught.** Re-run today against the suite as it now stands, 31 scripts including the governance tests: still 7 of 7, and the contract restored clean afterwards.

That is the metric worth reporting. Not "the tests pass", but "the tests were shown to fail when the contract is wrong, and where they did not, that was fixed."

## 3. Is the privacy claim true across nodes?

Measured on three Canton participants sharing one synchronizer, with the same transactions settling across all of them. Each node is asked at its own ledger end, which is why the offsets differ: sandbox 174, pebblebox 143, sidebox 171.

| Template | `sandbox` owner | `sandbox` agent | `pebblebox` bank | `pebblebox` merchant | `pebblebox` stranger | `pebblebox` outsider | `sidebox` owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `WalletHolding` | 1 | 1 | 6 | 5 | no data | no data | 1 |
| `WalletPolicy` | 1 | 1 | **no data** | **no data** | no data | no data | 1 |
| `PendingApproval` | 2 | 2 | no data | no data | no data | no data | 2 |
| `ExecutedTransfer` | 5 | 5 | no data | 5 | no data | no data | 5 |
| `RejectedTransfer` | 1 | 1 | no data | no data | no data | no data | 1 |
| `GovernanceRules` | 1 | no data | no data | no data | no data | no data | 1 |
| `GovernanceExecutionResult` | 1 | no data | no data | no data | no data | no data | 1 |

`sandbox` and `sidebox` both host the owner, so both answer for it with the policy. `pebblebox` hosts the bank that issued the funds and the merchant that was paid, and it holds no policy for any party.

The sharpest version of the claim is not in the table above but in what happens when you ask the wrong node the right question: **put the query to `pebblebox` as the owner's own party and it still returns no policy.** A per-party filter would have nothing to do here, because the contract is simply not on that participant. That is the difference between privacy enforced by a view and privacy enforced by distribution.

Two honest readings of the same table:

- The stranger and the outsider share `pebblebox` with the bank and the merchant, so their empty columns are the ledger API's per-party filter, not a separate node. They are there to show roles, and they are not the privacy evidence.
- `GovernedApproval`, `GovernedRejection` and `GovernanceConfirmation` are empty because the run measured here completed: reaching the threshold archives the proposal and its confirmations and leaves the execution receipt. Mid-vote, those rows fill.

The Privacy page computes all of this from live queries rather than displaying a fixed table, and flips to a red banner if the policy ever does appear on a counterparty node. It would report its own failure.

## 4. Does it behave under contention?

Two requests submitted simultaneously against the same policy: the ledger serialises them. The loser receives `LOCAL_VERDICT_LOCKED_CONTRACTS` and succeeds on resubmission against the replacement policy. Verified in the desk's race scenario and reproducible there.

This matters because the rolling cap is only meaningful if two concurrent requests cannot both consume the same headroom.

## 5. Does shared control actually hold?

Releasing a held request is governed by BitSafe's Decentralization Manager with two members and a threshold of two. Alice is hosted by `sandbox` and Bob by `sidebox`, so the two confirmations come from parties that no single participant speaks for.

Measured live, in this order:

| Step | Result |
| --- | --- |
| Agent requests 120 | `HELD`, waiting on the owner |
| Alice proposes a release, Alice confirms | 1 of 2 |
| Release attempted on one confirmation | **REFUSED by the ledger** |
| Bob confirms, from `sidebox` | 2 of 2 |
| Release on two | `SETTLED`, merchant 40.00 to 160.00 |

The refusal in the middle is the measurement. Nothing in our code counts confirmations, for the same reason nothing in the agent's client checks a spending cap.

Separately, the owner party is hosted on two participants with a hosting threshold of one, so losing a host is survivable rather than fatal. Taking `sidebox` off the synchronizer, spending as the owner, and bringing it back: the owner could spend at every step, and the node reconnected.

## 6. Numbers as they stand

| Measure | Value |
| --- | --- |
| Daml scripts passing | 31 (25 tests, 6 that allocate parties or set up the demo) |
| Mutants caught | 7 of 7 (was 5 of 7 before two tests were added) |
| Agent capabilities refused by the ledger | 4 of 4, live, balance 960.00 either side |
| Participants that hold the policy | 2 of 3, both of them hosts of the owner |
| Participants a counterparty is hosted by that hold it | 0 of 1 |
| Confirmations needed to release a held request | 2, from parties on different participants |
| User interviews conducted | **0** |

## What would change my mind

The GTM material carries four hypotheses. **H4 is the one that matters**: we assume firms reject public-chain delegation specifically because their caps and counterparties become readable. The test is to ask directly whether they would accept Coinbase Spend Permissions if it ran on Canton assets. A yes falsifies the central differentiator, and I would rather find that out in the first ten conversations than after a pilot.

The plan is ten ICP conversations, recording the second question asked once the mechanism is understood, and whether privacy or auditability dominates. Until those happen, this section stays honest about being empty.

## Checklist

- [x] Evidence is measured, not asserted
- [x] Reproducible by a third party from the repo
- [x] Test quality itself is evidenced, not just test count
- [x] Gaps found are reported alongside fixes
- [x] What is *not* validated is stated plainly
- [x] A falsification test is named for the main hypothesis
