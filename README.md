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
test/daml/Setup.daml            demoParties (parties and users) and demoSetup (plus a wallet)
app/                            React frontend over the JSON Ledger API
scripts/ledger.sh               Fresh sandbox, package upload, demo parties
```

`main` is the package deployed to the ledger. `test` holds scripts only, so `daml-script` never ships.

## Prerequisites

- JDK 17+ (developed on Temurin 21)
- Daml SDK via dpm: `curl https://get.digitalasset.com/install/install.sh | sh`, then add `~/.dpm/bin` to `PATH`
- Node 20.19+ for the frontend

## Run the demo

```sh
./scripts/ledger.sh             # terminal 1: sandbox on 6865, JSON API on 6864
cd app && npm install && npm run dev   # terminal 2: http://localhost:5173
```

The ledger script builds the Daml, starts a fresh in-memory sandbox, uploads `sentry-0.1.0.dar` and creates six parties with a ledger user each: bank, owner, agent, merchant, stranger, outsider. The desk then walks through creating the wallet: Bank mints the holding and the owner signs the policy. Ctrl-C the script to throw the ledger away.

Pages:

- **Desk**: the owner seat (held queue, ledger, policy edits, direct payments) and the agent seat (requests, scenarios, a two-at-once race, and bypass attempts that submit forbidden commands so the ledger's refusal is shown).
- **Privacy**: an active-contracts query as each of the six parties at the same offset.
- **Contract**: the Daml source, imported at build time.

The frontend never simulates. When the JSON API is down it says so and reconnects when the ledger comes back.

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
- All demo parties share one sandbox node, so the privacy page shows the ledger API's per-party view, not separate nodes.
