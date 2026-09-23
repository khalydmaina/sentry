# sentry

Spending limits an AI agent cannot argue with, enforced by Canton's ledger instead of wallet software. The owner signs a `WalletPolicy` delegating limited authority to an agent. `RequestTransfer` is the agent's only way to move funds: in-policy spends execute immediately, anything else becomes a `PendingApproval` for the owner, and insufficient balance is rejected. The policy is visible only to the owner and the agent.

HackCanton Season 3 entry.

## Provenance

HackCanton Season 3 runs its delivery phase from 18 September to 9 October 2026, and
judges score only work done inside that window. Work that predates it, disclosed as the
rules require:

- Commit `ddbdac9`, 14 September 2026. The Daml packages in `main/` and `test/` (three
  templates, 18 script tests), the React desk in `app/`, and `scripts/ledger.sh`. Built
  before the delivery phase opened and unchanged since.

Every commit after `ddbdac9` was made during the delivery phase.

## Layout

```
main/daml/Wallet/Holding.daml   WalletHolding: issuer-signed funds, Transfer controlled by the owner
main/daml/Wallet/Policy.daml    WalletPolicy (RequestTransfer, OwnerTransfer, UpdatePolicy), PendingApproval (Approve, Reject)
main/daml/Wallet/Records.daml   ExecutedTransfer, RejectedTransfer records
test/daml/Test/Wallet.daml      Daml Script tests, one per branch
test/daml/Test/Fixture.daml     Shared setup and helpers for the tests
test/daml/Setup.daml            Party allocation per participant, and demoSetup (plus a wallet)
app/                            React frontend over the JSON Ledger API
agent/sentry-agent.mjs          The agent as a program, outside the browser
scripts/two-node.conf           The second Canton participant
scripts/ledger.sh               Both participants, package upload, demo parties
```

`main` is the package deployed to the ledger. `test` holds scripts only, so `daml-script` never ships.

## Prerequisites

- JDK 17+ (developed on Temurin 21)
- Daml SDK via dpm: `curl https://get.digitalasset.com/install/install.sh | sh`, then add `~/.dpm/bin` to `PATH`
- Node 20.19+ for the frontend

## Run the demo

```sh
./scripts/ledger.sh             # terminal 1: two participants, JSON APIs on 6864 and 7864
cd app && npm install && npm run dev   # terminal 2: http://localhost:5173
```

The ledger script builds the Daml, starts **two Canton participants on one synchronizer**, uploads `sentry-0.1.0.dar` to both, and allocates each party on the node that hosts it:

| Participant | JSON API | Parties |
| --- | --- | --- |
| `sandbox` | 6864 | owner, agent, founder |
| `pebblebox` | 7864 | bank, merchant, stranger, outsider |

`founder` is nobody's demo role. It stands in for a person arriving with their own wallet and their own party, owning nothing, and is the party a connected wallet acts as.

Two nodes is the point. The privacy page asks each participant what it holds, so "the bank cannot see the policy" is a fact about a separate node rather than a filter applied to one node's answer. The desk then walks through creating the wallet: the bank mints the holding on its own node and the owner signs the policy on theirs. Ctrl-C the script to throw both ledgers away.

The first transaction across the two participants takes noticeably longer than the rest while the nodes exchange topology. Later ones settle in well under a second.

Pages:

- **Desk**: the owner seat (held queue, ledger, policy edits, direct payments) and the agent seat (requests, scenarios, a two-at-once race, and bypass attempts that submit forbidden commands so the ledger's refusal is shown).
- **Privacy**: an active-contracts query put to each participant, as each party it hosts, at that node's own offset.
- **Contract**: the Daml source, imported at build time.

The frontend never simulates. When the JSON API is down it says so and reconnects when the ledger comes back.

## The agent, outside the browser

The desk shows both seats in one page, which is convenient and misleading: a
real agent runs somewhere you do not control. `agent/sentry-agent.mjs` is that
agent, with its own credential and no dependencies beyond Node.

```sh
node agent/sentry-agent.mjs status
node agent/sentry-agent.mjs request --amount 40 --to merchant --memo "api credits"
node agent/sentry-agent.mjs probe
```

`request` prints what the ledger decided, not what the script decided:

```
EXECUTED   40.00 to Merchant     (AutoApproved)
HELD      120.00 to Merchant     waiting on the owner: above auto-approve threshold, owner sign-off required
HELD       10.00 to Stranger     waiting on the owner: counterparty not allowlisted
REJECTED 5000.00 to Merchant     insufficient balance
```

`probe` is the claim worth checking. It sends four commands the agent is
perfectly free to send, and shows the ledger refusing each one:

```
REFUSED    move the holding directly      DAML_AUTHORIZATION_ERROR
REFUSED    spend as the owner             DAML_AUTHORIZATION_ERROR
REFUSED    raise its own caps             DAML_AUTHORIZATION_ERROR
REFUSED    mint itself a holding          DAML_AUTHORIZATION_ERROR
```

The balance is unchanged afterwards. Nothing in the script enforces this:
delete every check in it and the agent still cannot do any of those things,
because the contracts give it exactly one choice.

Configure with `SENTRY_WALLET_API`, `SENTRY_COUNTERPARTY_API`,
`SENTRY_AGENT_USER` and `SENTRY_AGENT_TOKEN`. On the local sandbox the
participant requires no token, so the credential is not yet the thing keeping
the agent honest; the contract is.

## Build and test the contracts

```sh
cd test
dpm build     # builds main, then test
dpm test      # runs every script on the in-memory IDE ledger
```

Against a running sandbox, every test except the rolling-window one (which needs static time):

```sh
cd test
dpm script --dar .daml/dist/sentry-test-0.1.0.dar --upload-dar true \
  --all --skip-script-name Test.Wallet:testRollingWindowHasNoBoundaryDoubleSpend \
  --skip-script-name Setup:demoSetup --skip-script-name Setup:demoParties \
  --skip-script-name Setup:walletParties --skip-script-name Setup:counterpartyParties \
  --ledger-host localhost --ledger-port 6865 --wall-clock-time \
  --json-test-summary summary.json
```

Canton refuses a changed package with a name and version it has already seen (`KNOWN_PACKAGE_VERSION`). After editing Daml, restart the ledger script or bump `version` in the relevant `daml.yaml`.

## Known limitations

- The issuer can archive a holding directly, which leaves `policy.holding` pointing at a dead contract until `UpdatePolicy` repoints it.
- Nothing limits how many `PendingApproval`s an agent can raise.
- Funds sent to the owner land in a second holding the policy does not track.
- `dailyCap` bounds the total spent in a window, not the number of spends, so many tiny spends grow `recentSpends`.
- The asset model is self-contained, not wired to Canton Coin or a token standard.
- The outsider and stranger share the counterparty node with the bank and the merchant, so their empty views are the ledger API's per-party filter. The claim demonstrated across nodes is the bank's and the merchant's: neither participant receives the policy.
- Both participants run in-memory, so everything is thrown away when the ledger stops.
- A wallet-connected owner onboards with their own party, but the issuer mints on request with no checks, which is a demo faucet rather than a funding model.
- Neither participant requires authentication, which is appropriate for a local demo and not for anything else.
