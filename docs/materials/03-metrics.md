# Metrics / Validation Evidence

> **What judges look for:** user interviews, tests, validation notes and key success criteria. Show what you learned from real people and which numbers tell you the product works, not what you assume.

---

## Read this first

The two halves of this document are in very different states, and conflating them would be the dishonest move.

**Validated:** that the mechanism works, and that the tests would notice if it stopped working. Measured, reproducible from a clean checkout, and generated inside the delivery window.

**Not validated:** that anyone will adopt it. **Zero user interviews so far.** The market claims live in the GTM material as labelled hypotheses with tests attached, and none have been run. Presenting them as findings would be inventing evidence.

## 1. North Star metric

- **Metric:** **agent requests decided by the ledger on behalf of an owner who was not watching**, per week. Every request that settled, was held or was refused while nobody was in the loop.
- **Why this one:** it only moves if somebody actually delegated real spending to an agent and left it running. A dashboard login does not move it, a signup does not move it, and a demo does not move it. It is the single number that separates "interesting" from "in use".
- **How we measure it:** counted from the ledger, not from our own telemetry. Every outcome leaves an `ExecutedTransfer`, a `PendingApproval` or a `RejectedTransfer` contract, so the number is derivable by the owner from their own participant without trusting us.

## 2. What we needed to validate

| Assumption | Why it matters | Status |
| --- | --- | --- |
| The ledger, not our code, is what refuses an over-delegated request | The entire product claim. If a client-side check is load-bearing anywhere, there is no product | ✅ confirmed, see section 4 |
| The policy stays off a counterparty's participant | The reason this is on Canton and not a public chain | ✅ confirmed, see section 4 |
| Shared control can be added without us writing a threshold rule | Determines whether treasury-grade approval is realistic or a rebuild | ✅ confirmed, see section 4 |
| Users have this problem | Everything downstream | ⏳ testing, 0 of 10 conversations done |
| They would use our solution | Whether the wedge is the probe or something else | ⏳ untested |
| They would pay or switch | Whether there is a business rather than a tool | ⏳ untested |

## 3. Conversations

| # | Who (role, company type) | Date | Key takeaway |
| --- | --- | --- | --- |
| 1 | none yet | | |
| 2 | none yet | | |
| 3 | none yet | | |

**Strongest quote:** none. We have not spoken to a potential user yet, and the checklist item below stays unticked rather than being filled with something invented.

The plan is ten conversations with the ICP, recording two things specifically: the second question asked once the mechanism is understood, and whether privacy or auditability dominates. Targets are named in the ICP material.

## 4. Tests and results

Everything in this section was measured on a live three-participant Canton network and is reproducible from the repo.

### 4.1 Does the ledger actually refuse?

`agent/sentry-agent.mjs probe` sends four commands the agent is entirely free to send, from outside the browser, holding only its own credential:

| Attempt | Result |
| --- | --- |
| Move the holding directly | `DAML_AUTHORIZATION_ERROR` |
| Spend as the owner | `DAML_AUTHORIZATION_ERROR` |
| Raise its own caps | `DAML_AUTHORIZATION_ERROR` |
| Mint itself a holding | `DAML_AUTHORIZATION_ERROR` |

**4 of 4 refused, balance unchanged either side at 960.00.** `RequestTransfer` is the only choice on `WalletPolicy` with `controller agent`.

The same agent, using the one choice it does have, against a policy of per-transaction 100, daily 200, auto-approve 50 and an allowlist holding only the merchant:

| Request | Outcome | Decided by |
| --- | --- | --- |
| 40 to the merchant | `EXECUTED` | under every cap, auto-approved |
| 120 to the merchant | `HELD` | exceeds per-transaction cap |
| 10 to the stranger | `HELD` | counterparty not allowlisted |
| 5000 to the merchant | `REJECTED` | insufficient balance |

Four requests, four verdicts, none of them taken by the agent's own code.

### 4.2 Would the tests notice if the contract were wrong?

A passing suite proves the tests run, not that they would catch a mistake. So the contract was broken on purpose: seven one-character mutations to the rules that decide whether money moves.

**First run: 5 of 7 caught. Two survived**, and both were real gaps rather than noise. Spending exactly the balance was untested, and a zero-amount request to an unlisted counterparty was untested. Both tests were written and the run repeated: **7 of 7 caught**, re-verified today against the suite as it now stands, with the contract restored clean afterwards.

That is the metric worth reporting. Not "the tests pass", but "the tests were shown to fail when the contract is wrong, and where they did not, that was fixed".

### 4.3 Is the privacy claim true across nodes?

Measured on three participants sharing one synchronizer, each asked at its own ledger end, which is why the offsets differ: sandbox 174, pebblebox 143, sidebox 171.

| Template | `sandbox` owner | `sandbox` agent | `pebblebox` bank | `pebblebox` merchant | `pebblebox` stranger | `pebblebox` outsider | `sidebox` owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `WalletHolding` | 1 | 1 | 6 | 5 | no data | no data | 1 |
| `WalletPolicy` | 1 | 1 | **no data** | **no data** | no data | no data | 1 |
| `PendingApproval` | 2 | 2 | no data | no data | no data | no data | 2 |
| `ExecutedTransfer` | 5 | 5 | no data | 5 | no data | no data | 5 |
| `RejectedTransfer` | 1 | 1 | no data | no data | no data | no data | 1 |
| `GovernanceRules` | 1 | no data | no data | no data | no data | no data | 1 |
| `GovernanceExecutionResult` | 1 | no data | no data | no data | no data | no data | 1 |

The sharpest version of the claim is what happens when you ask the wrong node the right question: **put the query to `pebblebox` as the owner's own party and it still returns no policy.** A per-party filter has nothing to do here, because the contract is not on that participant.

Two honest readings of the same table. The stranger and the outsider share `pebblebox` with the bank and the merchant, so their empty columns are the ledger API's per-party filter and not the privacy evidence. And `GovernedApproval`, `GovernedRejection` and `GovernanceConfirmation` are empty because the measured run completed: reaching the threshold archives the proposal and its confirmations and leaves the execution receipt.

### 4.4 Does it behave under contention?

Two requests submitted simultaneously against the same policy: the ledger serialises them. The loser receives `LOCAL_VERDICT_LOCKED_CONTRACTS` and succeeds on resubmission against the replacement policy. This matters because a rolling cap is only meaningful if two concurrent requests cannot both consume the same headroom.

### 4.5 Does shared control hold?

Two members, threshold of two, Alice hosted by `sandbox` and Bob by `sidebox`:

| Step | Result |
| --- | --- |
| Agent requests 120 | `HELD` |
| Alice proposes a release and confirms | 1 of 2 |
| Release attempted on one confirmation | **REFUSED by the ledger** |
| Bob confirms, from `sidebox` | 2 of 2 |
| Release on two | `SETTLED`, merchant 40.00 to 160.00 |

The refusal in the middle is the measurement. Separately, the owner party is hosted on two participants with a hosting threshold of one: taking `sidebox` off the synchronizer, spending as the owner, and bringing it back, the owner could spend at every step.

### 4.6 What we changed because of what we measured

- Two tests were added after the mutation run, because two deliberate errors survived.
- The privacy page gained a row for `GovernanceExecutionResult`, which is the only governance contract still active after a release. The page claimed to show what each node holds and was dropping one.
- The page banner said the policy never leaves the wallet node, which stopped being true the moment the owner gained a second host. It now says it never reaches a counterparty node, which is what the code actually checks.

## 5. Product and on-ledger metrics

| Metric | How we measure it | Now | Target by submission |
| --- | --- | --- | --- |
| Users who tried the demo | people other than the author who ran `ledger.sh` and opened the desk | **0** | 3 |
| Users who completed the core flow | reached an executed transfer and a held request | **0** | 3 |
| Engineers who ran `probe` themselves | asked and counted, not instrumented | **0** | 3 |
| Transactions on DevNet / MainNet | **0**, and this is deliberate: LocalNet is fully eligible and DevNet needs a static IP, a sponsor and a 2 to 7 day wait | **0** | 0, unless a sponsor materialises |
| Active parties in the demo topology | allocated across three participants | **8** | 8 |
| Daml scripts passing | `dpm test` | **31** (25 tests, 6 setup) | 31+ |
| Mutants caught | `scripts/mutants.sh` | **7 of 7** | 7 of 7 |
| Claims checked on a machine that is not the author's | `scripts/ci.sh` on a clean GitHub runner, every push | **14 of 14** | 14 of 14 |

We have no analytics on the site and are not adding any. Counting demo users by asking three people is a smaller and truer number than counting page views.

## 6. Success criteria after the hackathon

| Metric | Target in 90 days |
| --- | --- |
| Conversations with the ICP, with H2 and H4 recorded verbatim | 10 |
| Engineers who ran `probe` without us present | 3 |
| Wallet teams agreeing to a joint demo | 1 |
| Teams running the agent against their own policy | 1 |
| Asset model wired to a real token standard rather than self-issued units | done or explicitly abandoned |
| Design partner running one real agent with a real cap for a month | 1 |

## 7. What we still don't know

- **Whether privacy is the deciding factor or a nice-to-have.** This is H4 in the GTM material and it is the one that matters. The test is to ask directly whether they would accept Coinbase Spend Permissions if it ran on Canton assets. A yes falsifies the central differentiator, and finding that out in the first ten conversations is worth more than finding it out after a pilot.
- **Whether the buyer's real objection is enforcement or auditability.** Recorded as the second question asked once the mechanism is understood.
- **Whether anyone will run a participant node for this.** The honest answer today is that most of the ICP will not, which is why wallet distribution matters more than direct adoption.
- **Whether the held queue fits an approval process that already exists**, or asks firms to build a new one.

## Checklist

- [x] One North Star metric with a clear definition
- [ ] At least 3 conversations with potential users **(0 so far, and not faked)**
- [x] Assumptions are marked confirmed, rejected or still testing
- [x] At least one test with a number attached
- [x] Current values and targets are filled in
- [x] You show what changed because of what you learned
