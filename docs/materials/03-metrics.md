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

**4 of 4 refused, balance unchanged either side.** Verified against `Policy.daml`: `RequestTransfer` is the only choice with `controller agent`.

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

Both tests were written and the mutation run repeated: **7 of 7 caught.** The suite is 23 scripts.

That is the metric worth reporting. Not "the tests pass", but "the tests were shown to fail when the contract is wrong, and where they did not, that was fixed."

## 3. Is the privacy claim true across nodes?

Measured on two Canton participants sharing one synchronizer, with the same transactions settling across both:

| | wallet node `:6864` | counterparty node `:7864` |
| --- | --- | --- |
| `WalletPolicy` visible to | owner, agent, connected wallet | **nobody** |
| `WalletHolding` | yes | yes |
| `ExecutedTransfer` | yes | merchant only |

The bank issued the funds and the merchant was paid, and neither participant ever receives the policy. Not filtered from their answer: never delivered to that node.

The Privacy page computes this from live queries rather than displaying a fixed table, and flips to a red banner if the policy ever does appear on a counterparty node. It would report its own failure.

## 4. Does it behave under contention?

Two requests submitted simultaneously against the same policy: the ledger serialises them. The loser receives `LOCAL_VERDICT_LOCKED_CONTRACTS` and succeeds on resubmission against the replacement policy. Verified in the desk's race scenario and reproducible there.

This matters because the rolling cap is only meaningful if two concurrent requests cannot both consume the same headroom.

## 5. Numbers as they stand

| Measure | Value |
| --- | --- |
| Daml scripts passing | 23 |
| Mutants caught | 7 of 7 (was 5 of 7 before two tests were added) |
| Agent capabilities refused by the ledger | 4 of 4 |
| Participants the policy reaches | 1 of 2 |
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
