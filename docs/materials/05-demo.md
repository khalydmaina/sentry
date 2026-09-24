# Demo / MVP

> **What judges look for:** a working prototype, code quality, and depth of Canton integration.

---

## Links

| | |
| --- | --- |
| Repository | https://github.com/khalydmaina/sentry |
| Track | Real-World Assets (RWA) & Business Workflows |
| Runs on | Canton LocalNet, three participants on one synchronizer |

Everything below runs from a clean checkout. Nothing is mocked, simulated or pre-recorded: the frontend has no fallback data and says so when the ledger is unreachable.

## Run it

```sh
./scripts/ledger.sh                    # three Canton participants, packages uploaded to all three
cd app && npm install && npm run dev   # http://localhost:5173
```

The ledger script starts `sandbox` on 6864, `pebblebox` on 7864 and `sidebox` on 8864, waits for all three to join the synchronizer, uploads the packages to each, and allocates every party on the node that hosts it. The owner is hosted on `sandbox` and `sidebox` and deliberately not on `pebblebox`, so one topology shows both that the owner survives losing a host and that the counterparty's node still never receives the policy.

## The workflow, end to end

The track asks for create, update status, transfer or fulfil, and audit. Sentry is that workflow:

1. **Issue.** The bank mints a `WalletHolding` on its own participant. Signed by the issuer alone.
2. **Delegate.** The owner signs a `WalletPolicy` carrying a per-transaction cap, a rolling cap over a window, a counterparty allowlist and an auto-approve threshold.
3. **Request.** The agent exercises `RequestTransfer`, its only choice on that policy.
4. **Settle, hold or refuse.** Inside the policy it executes immediately. Outside it, it becomes a `PendingApproval` only the owner can clear. Over the balance, it is rejected outright.
5. **Record.** Every outcome leaves an `ExecutedTransfer` or a `RejectedTransfer` carrying the reason.

Roles are visible throughout: issuer, owner, agent, counterparty, and a party with no role at all.

## The two things worth looking at

### 1. The agent is a program, not a tab

```sh
node agent/sentry-agent.mjs request --amount 40 --to merchant --memo "api credits"
```

```
EXECUTED   40.00 to Merchant     (AutoApproved)
HELD      120.00 to Merchant     above auto-approve threshold, owner sign-off required
HELD       10.00 to Stranger     counterparty not allowlisted
REJECTED 5000.00 to Merchant     insufficient balance
```

It holds its own credential and runs outside the browser, which is the situation the product is actually about.

Then the part that makes the claim checkable:

```sh
node agent/sentry-agent.mjs probe
```

```
REFUSED    move the holding directly      DAML_AUTHORIZATION_ERROR
REFUSED    spend as the owner             DAML_AUTHORIZATION_ERROR
REFUSED    raise its own caps             DAML_AUTHORIZATION_ERROR
REFUSED    mint itself a holding          DAML_AUTHORIZATION_ERROR
4 of 4 refused by the ledger.
```

Four commands the agent is perfectly free to send, refused by the contracts, balance unchanged either side. **Delete every check in that script and nothing changes**, because the refusal belongs to the ledger. `RequestTransfer` is the only choice on `WalletPolicy` with `controller agent`.

### 2. Privacy is demonstrated across nodes, not asserted

The Privacy page queries each participant for what it holds, at that node's own offset. Measured live on the three-node network:

```
                           sandbox :6864    pebblebox :7864                        sidebox :8864
                           owner   agent    bank  merchant  stranger  outsider     owner (2nd host)
WalletHolding              1       1        6     5         no data   no data      1
WalletPolicy               1       1        no data no data no data   no data      1
PendingApproval            2       2        no data no data no data   no data      2
ExecutedTransfer           5       5        no data 5       no data   no data      5
RejectedTransfer           1       1        no data no data no data   no data      1
GovernanceRules            1       no data  no data no data no data   no data      1
GovernanceExecutionResult  1       no data  no data no data no data   no data      1
```

The bank issued the funds and the merchant was paid, and **`pebblebox` never receives the `WalletPolicy` at all**. Ask it as the owner's own party and it still returns nothing, because a per-party filter has nothing to do when the contract was never delivered to that participant. Meanwhile `sidebox`, the owner's second host, answers with the policy exactly as `sandbox` does.

The banner on that page is computed from the data, so it turns red and says so if the policy ever does reach a counterparty node.

## Depth of Canton integration

- **Daml is the enforcement**, not a record of decisions made elsewhere. Caps, allowlist, rolling window and escalation are all inside `RequestTransfer`.
- **`RequestTransfer` is nonconsuming** so that escalations and rejections never archive the policy, and only the branch that moves money replaces it. Two concurrent requests contend correctly: the loser gets `LOCAL_VERDICT_LOCKED_CONTRACTS` and succeeds on resubmission.
- **Three participants on one synchronizer**, with the same transaction settling across them, and the owner party hosted on two of them.
- **Shared control over the held queue.** Clearing a held request is a governed action needing two confirmations from parties on different participants, built on BitSafe's Decentralization Manager rather than a threshold rule of our own.
- **JSON Ledger API v2** throughout, with package-name template references.
- **CIP-0103 wallet identity.** Provider discovery on both `canton:announceProvider` and `window.cantonWallet`, `prepareExecuteAndWait` for generic Daml commands, events read back through `ledgerApi`, and disclosed contracts with all four required fields, because a wallet submits through a validator that has never seen these contracts.
- **No `actAs` anywhere on the wallet path**, since a wallet submits only as its connected party.

## Honest limitations

Listed in full in the README. The ones that matter to a judge:

- The asset model is self-contained rather than wired to Canton Coin or a token standard.
- The issuer mints on request with no checks, which is a demo faucet, not a funding model.
- All three participants run in memory, so state is thrown away when the ledger stops.
- No participant requires authentication, which is right for a local demo and nothing else.
- The Grofty integration runs against a stand-in CIP-0103 provider. Grofty is MainNet-only and invitation-gated, so an end-to-end demo on their wallet depends on access we do not have yet.

## Provenance

The contracts, the test suite and the first frontend were built before the delivery phase and are disclosed in the README as commit `ddbdac9`. Everything from 18 September onward is in the commit history: the two-participant topology, the wallet identity layer, disclosed contracts, the agent program and these materials.
