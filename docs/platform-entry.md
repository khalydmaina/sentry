# HackCanton platform entry

Every field the project record on appsfactory.cc actually takes, in its own
order, so filling the form is copy and paste. The record is what judges open,
so it is kept accurate against the contracts in `main/daml/Wallet/`.

Anything marked **NEEDED** is yours to supply: I have no way to know it.

## projectName

Sentry

## tracks

Real-World Assets (RWA) & Business Workflows.

The track's expected output is an end-to-end workflow (create, update status,
transfer or fulfill, audit), a lightweight UI showing roles, a one-page business
brief and a short pilot plan. Sentry is that workflow: issue a holding, delegate
a policy, request a transfer, settle or escalate or reject, leave a record.

## challenges

**BitSafe Challenge.** Releasing a held request is a governed action: two
members, a threshold of two, and confirmations from parties hosted by different
participants. The threshold lives in BitSafe's `GovernanceRules`, which refuses
to execute below it, so nothing in our code counts confirmations.

**Grofty Wallet Bounty** (enter only if access arrives). The owner and agent
connect with Grofty, and signing the policy and approving a held request happen
with keys the owner holds. Grofty is MainNet-only and invitation-gated, so this
currently runs against a stand-in CIP-0103 provider.

## elevatorPitch

AI agents are being handed wallet keys, and the limits on what they can spend
live in the wallet software that calls the model. If the agent is compromised or
simply wrong, the thing enforcing the limit is the thing under attack.

Sentry moves the limit onto the ledger. The owner signs a policy that delegates
the agent a per-transaction cap, a rolling daily cap, an allowlist of
counterparties and an auto-approve threshold. A request inside the policy
settles immediately, anything outside it becomes a pending approval only the
owner can clear, and a request over the balance is rejected outright. The agent
has no other way to move the funds.

Canton keeps the policy readable by the owner and the agent alone: the issuer
sees the holding it minted and nothing about the limits, and a counterparty sees
only the payment it received. Every outcome, executed or rejected, leaves a
record.

## techStack

```
Daml, Canton, Canton JSON Ledger API v2, dpm, Decentralization Manager,
CIP-0103, @canton-network/dapp-sdk, React 19, TypeScript, Vite, Node.js,
GitHub Actions, LocalNet
```

## mvpMaterial

| Field | Value |
| --- | --- |
| `githubRepoUrl` | https://github.com/khalydmaina/sentry |
| `demoUrl` | https://sentry-canton.vercel.app (public since 25 Sep 2026; the desk explains that the ledger runs locally) |
| `demoVideoUrl` | optional, and not required by this hackathon. Leave blank unless a recording exists. |

## logo

`C:\Users\USER\Downloads\sentry-avatar-400.png`, 400x400 PNG, 2.4 KB. The
gate mark from the brand kit, void on lime. The inverse is beside it if a light
background reads better on the platform.

## contactInfo

- `email`: mainakhalid18@gmail.com
- `telegram`: **NEEDED**
- `discord`: **NEEDED**

## socials

- `telegram`: **NEEDED**
- `twitter`: **NEEDED**, or leave blank if there is no project account

## status

`preview` while drafting, `published` to enter judging. Publishing is gated on
1000 MANA and 6 of 6 materials uploaded, so this flips last, not first.
