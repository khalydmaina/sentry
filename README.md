# sentry

[![ci](https://github.com/khalydmaina/sentry/actions/workflows/ci.yml/badge.svg)](https://github.com/khalydmaina/sentry/actions/workflows/ci.yml)

Spending limits an AI agent cannot argue with, enforced by Canton's ledger instead of wallet software. The owner signs a `WalletPolicy` delegating limited authority to an agent. `RequestTransfer` is the agent's only way to move funds: in-policy spends execute immediately, anything else becomes a `PendingApproval` for the owner, and insufficient balance is rejected. The policy is visible only to the owner and the agent.

HackCanton Season 3 entry. Live explainer: https://sentry-canton.vercel.app

## Test it yourself

You need Linux or WSL2 (CI runs Ubuntu 24.04; macOS is untested), git, JDK 17+,
Python 3, Node 20.19+, about 4 GB of free memory and 5 GB of disk.

**1. Install the Daml SDK, version 3.5.8.** Pass the version: without it the
installer fetches the newest SDK, and the build then stops with
`SDK_NOT_INSTALLED`. It is a download of about 3 GB, so allow some time.

```sh
curl -sSL https://get.digitalasset.com/install/install.sh | sh -s 3.5.8
export PATH="$HOME/.dpm/bin:$PATH"
```

If you already have a newer SDK, `dpm install 3.5.8` adds the pinned one alongside it.

On a slow or flaky connection, read the end of the install output. A dropped
download prints `connection reset` or `failed to copy content`, yet `dpm version`
still lists 3.5.8 afterwards, and running the install again does not repair the
half-downloaded parts. Delete `~/.dpm` and run the install command again from
the start.

**2. Check every claim with one command.**

```sh
git clone https://github.com/khalydmaina/sentry && cd sentry
./scripts/ci.sh
```

It runs the Daml tests, starts three Canton participants, creates a wallet,
sends the agent's four requests and the four forbidden commands, checks which
node holds the policy, runs a governed release and takes a host offline. Each
check prints `PASS` or `FAIL`, and it ends with `Every claim held.` Expect
roughly 5 to 10 minutes, most of it the ledger starting. It stops the ledger
when it finishes. This is the same script
[CI](https://github.com/khalydmaina/sentry/actions/workflows/ci.yml) runs on
every push.

**3. Or poke at it by hand.** Two terminals:

```sh
./scripts/ledger.sh                         # terminal 1: wait for "Ledger ready." (2 to 5 minutes)
```

```sh
python3 scripts/hosting-check.py            # terminal 2: creates a wallet, prints who holds the policy
node agent/sentry-agent.mjs request --amount 40 --to merchant
node agent/sentry-agent.mjs probe           # 4 of 4 refused, balance unchanged
cd app && npm install && npm run dev        # the desk, at http://localhost:5173
```

Ctrl-C in terminal 1 throws the whole ledger away. Start it again for a clean one.

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
governance/                     Clearing a held request under shared control
scripts/three-node.conf         The two extra Canton participants
scripts/host-owner.sc           Hosts the owner party on two of them
scripts/governance-setup.py     Two members, threshold two
scripts/governance-demo.py      A release that needs both signatures
scripts/outage-demo.py          What losing a host does
scripts/ledger.sh               All three participants, package upload, demo parties
scripts/mutants.sh              Breaks the policy rules on purpose, checks the tests notice
scripts/ci.sh                   Every claim in this README, checked against a live ledger
.github/workflows/ci.yml        Runs ci.sh and the mutants on a clean GitHub runner
```

`main` is the package deployed to the ledger. `test` holds scripts only, so `daml-script` never ships.

## Prerequisites

- JDK 17+ (developed on Temurin 21)
- Daml SDK 3.5.8 via dpm: `curl -sSL https://get.digitalasset.com/install/install.sh | sh -s 3.5.8`, then add `~/.dpm/bin` to `PATH`
- Python 3, used by the ledger script
- Node 20.19+ for the frontend and the agent

## Run the demo

```sh
./scripts/ledger.sh             # terminal 1: three participants, JSON APIs on 6864, 7864 and 8864
cd app && npm install && npm run dev   # terminal 2: http://localhost:5173
```

The ledger script builds the Daml, starts **three Canton participants on one synchronizer**, uploads the Sentry packages to all three, and allocates each party on the node that hosts it:

| Participant | JSON API | Parties |
| --- | --- | --- |
| `sandbox` | 6864 | owner, agent, founder |
| `pebblebox` | 7864 | bank, merchant, stranger, outsider |
| `sidebox` | 8864 | a second host for the owner, nobody's counterparty |

The owner party is hosted on `sandbox` and `sidebox`, and deliberately not on
`pebblebox`. That is what lets one topology show two things at once:

```
owner, asked of sandbox   (hosts owner): ['WalletHolding', 'WalletPolicy']
owner, asked of sidebox   (hosts owner): ['WalletHolding', 'WalletPolicy']
owner, asked of pebblebox (does not)   : ['WalletHolding']
bank,  asked of pebblebox              : ['WalletHolding']
```

The owner exists on two independent participants, and the counterparty's node
still never receives the policy, even when asked about the owner directly. It
holds the holding because the bank signed it, and nothing else.
Reproduce with `python3 scripts/hosting-check.py` against a fresh ledger.

### Losing a host

The hosting threshold says how many of the owner's hosts must confirm on its
behalf. At 1 the wallet survives losing one:

```sh
python3 scripts/outage-demo.py
```

```
  both hosts on the synchronizer           owner can spend: yes
  sidebox off the synchronizer             owner can spend: yes
  sidebox back on                          owner can spend: yes
```

A threshold of 2 means neither operator can move the owner's funds alone,
which sounds strictly better and is a trap: raising it needs both hosts online,
and once it is 2 and one host is gone the owner cannot act at all, including to
lower the threshold again. A threshold equal to the number of hosts has no
recovery path from a single outage. Found by wedging a test ledger into exactly
that state.

Two Canton details that cost time, in case they save yours: `reconnect_all`
restores a participant that never connected but not one that was explicitly
disconnected, where reconnecting the registered alias works immediately; and
the sandbox's built-in bootstrap connects some participants and not others,
varying between runs, which is why `scripts/connect-all.sc` exists.

`founder` is nobody's demo role. It stands in for a person arriving with their own wallet and their own party, owning nothing, and is the party a connected wallet acts as.

### Connecting a wallet

The owner can sign with a CIP-0103 wallet instead of the sandbox's demo user.
Wallets are found three ways, in `app/src/ledger/identity.ts`:

- **Canton's dApp SDK protocol.** The extension announces `{ id, name, target }`
  on `canton:announceProvider` and talks over `window.postMessage`. Sentry hands
  the announcement to the SDK's own `ExtensionAdapter`
  (`@canton-network/dapp-sdk`), which owns that transport and its handshake, so
  any wallet built on the SDK works without code of ours. The SDK is loaded only
  when such a wallet announces itself.
- An announcement carrying a callable provider, the EIP-6963 shape.
- An object injected at `window.cantonWallet`.

Commands go through `prepareExecuteAndWait` and are read back through the
wallet's `ledgerApi`, never with `actAs`. On LocalNet, `?wallet=mock` in a dev
build installs a stand-in wallet that speaks the SDK protocol and forwards to
the sandbox as `founder` (`?wallet=mock-injected` for the older shape). It
proves the plumbing, not signing: it holds no key.

Separate nodes are the point. The privacy page asks each participant what it holds, so "the bank cannot see the policy" is a fact about a separate node rather than a filter applied to one node's answer. The desk then walks through creating the wallet: the bank mints the holding on its own node and the owner signs the policy on theirs. Ctrl-C the script to throw all three ledgers away.

The first transaction across participants takes noticeably longer than the rest while the nodes exchange topology. Later ones settle in well under a second.

Pages:

- **Desk**: the owner seat (held queue, ledger, policy edits, direct payments) and the agent seat (requests, scenarios, a two-at-once race, and bypass attempts that submit forbidden commands so the ledger's refusal is shown).
- **Privacy**: an active-contracts query put to each participant, as each party it hosts, at that node's own offset. The governance contracts are rows too, because shared control is only shared if the members' nodes actually hold the proposals and confirmations.
- **Contract**: the Daml source, imported at build time.

The frontend never simulates. When the JSON API is down it says so and reconnects when the ledger comes back.

## Shared control over the held queue

One owner clearing a held request is right for one person and wrong for a
treasury, where releasing funds above a threshold should take more than one
signature. `governance/` puts that release behind BitSafe's
[Decentralization Manager](https://github.com/DLC-link/decentralization-manager):
the owner party becomes a governance party with members and a confirmation
threshold, and `GovernedApproval` is the domain action its `GovernanceRules`
executes once enough members have confirmed.

Nothing in Sentry counts confirmations or checks the threshold, in the same
way that nothing in the agent's client checks a spending cap. Both decisions
belong to a contract the proposer does not control.

```
testBelowThresholdCannotRelease   one of two confirmations: funds stay put
testThresholdReleases             two of two: 120.00 settles, recorded OwnerApproved
testDuplicateConfirmerRejected    the same member twice is one opinion twice
testNonMemberCannotConfirm        the agent cannot confirm its own request
testGovernedRejectionNeedsThreshold  refusing is governed too
testSingleMemberStillWorks        threshold of one is the old behaviour
```

Members are deliberately not observers on the governance contracts. Each
member hosts the governance party on its own participant and reads as it, so
visibility is a topology concern rather than something modelled in the
contract. The tests express that with `actAs member <> readAs owner`, and the
running ledger makes it real: Alice is hosted by `sandbox` and Bob by
`sidebox`, both of which host the owner.

`./scripts/ledger.sh` sets that up, and the whole release runs on it:

```sh
python3 scripts/governance-demo.py
```

```
Governance: 2 of 2 members
  Alice  hosted by sandbox
  Bob    hosted by sidebox

  agent requests 120.00        -> HELD, waiting on the owner
  Alice proposes a release
  Alice confirms               -> 1 of 2
  try to release on 1          -> REFUSED: Enough confirmations to execute action
  Bob confirms, from sidebox   -> 2 of 2
  release on 2                 -> SETTLED

  merchant balance 120.00 -> 240.00
```

The refusal in the middle is the ledger's, quoting the requirement it failed.
The two confirmations come from parties on different participants, so no single
node can release a held request on its own.

The same flow is on the desk, inside the held queue. A held request shows
`Shared control · 0 of 2`, a **Propose release** and a **Propose refusal**
button, then one button per member. Refusing is governed for the same reason
releasing is: one member should not be able to block a payment the others want
released. The release button stays live below the threshold on purpose: pressing
it early shows the contract refusing, in its own words, which is the same
argument the agent's bypass attempts make applied to the owner's side.

```
Shared control · 1 of 2 confirmations   [✓ alice] [confirm as bob] [Release on 1]
  -> Refused by the ledger. DAML_FAILURE: The requirement
     'Enough confirmations to execute action' was not met.
```

The vendored DARs in `governance/vendor/` are built from Decentralization
Manager at Apache-2.0, with the licence alongside them.

## The agent, outside the browser

The desk shows both seats in one page, which is convenient and misleading: a
real agent runs somewhere you do not control. `agent/sentry-agent.mjs` is that
agent, with its own credential and no dependencies beyond Node. It needs a
wallet to act on: create one on the desk, or with `python3 scripts/hosting-check.py`.

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

### Are the tests worth anything?

A passing suite proves the tests run, not that they would catch a mistake. `scripts/mutants.sh` makes seven one-character changes to the rules that decide whether money moves, and checks the suite fails on each:

```sh
./scripts/mutants.sh
```

```
per-transaction cap boundary       | caught
rolling cap boundary               | caught
auto-approve threshold boundary    | caught
allowlist check removed            | caught
balance check boundary             | caught
positive-amount guard weakened     | caught
rolling window boundary            | caught

7 of 7 mutants caught
```

It restores the contract with `git checkout`, so an interrupted run cannot leave a mutant behind. The first run of this scored 5 of 7: spending exactly the balance and a zero-amount request to an unlisted counterparty were both untested. Those two tests exist now.

Canton refuses a changed package with a name and version it has already seen (`KNOWN_PACKAGE_VERSION`). After editing Daml, restart the ledger script or bump `version` in the relevant `daml.yaml`.

## Checked on every push

A claim that holds on the author's laptop is a weaker claim.
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs
[`scripts/ci.sh`](scripts/ci.sh) on a clean GitHub runner: it installs the SDK,
boots the three participants, and fails if any answer differs from what this
README says.

```
PASS  31 scripts pass, 0 fail
PASS  sandbox (hosts the owner) holds the policy
PASS  sidebox (second host) holds the policy
PASS  pebblebox never received the policy, even asked as the owner
PASS  the bank sees its holding and not the policy
PASS  40 to merchant executes
PASS  120 to merchant is held
PASS  10 to stranger is held
PASS  5000 to merchant is rejected
PASS  4 of 4 refused with DAML_AUTHORIZATION_ERROR
PASS  balance 960.00 before and after
PASS  refused at 1 of 2
PASS  settled at 2 of 2
PASS  owner could spend throughout
```

A second job runs the mutants. The same script runs locally with
`./scripts/ci.sh`; it leaves its outputs in `.ci/`.

## Known limitations

- The issuer can archive a holding directly, which leaves `policy.holding` pointing at a dead contract until `UpdatePolicy` repoints it.
- Nothing limits how many `PendingApproval`s an agent can raise.
- Funds sent to the owner land in a second holding the policy does not track.
- `dailyCap` bounds the total spent in a window, not the number of spends, so many tiny spends grow `recentSpends`.
- The asset model is self-contained, not wired to Canton Coin or a token standard.
- The outsider and stranger share the counterparty node with the bank and the merchant, so their empty views are the ledger API's per-party filter. The claim demonstrated across nodes is the bank's and the merchant's: the participant hosting them never receives the policy.
- All three participants run in-memory, so everything is thrown away when the ledger stops.
- A wallet-connected owner onboards with their own party, but the issuer mints on request with no checks, which is a demo faucet rather than a funding model.
- No participant requires authentication, which is appropriate for a local demo and not for anything else.
- No real wallet extension has signed against Sentry yet; the wallet path is exercised with the stand-in described under Connecting a wallet.

## License

Apache License 2.0. See [LICENSE](LICENSE).

The contracts are licensed rather than merely readable on purpose: the argument
this project makes is that you should not trust a claim about enforcement you
cannot check yourself, and that is a weaker invitation if reading the code is
all anyone is permitted to do.

The DARs in `governance/vendor/` are third-party and carry their own licence,
also Apache 2.0, in `governance/vendor/LICENSE-decentralization-manager`.
