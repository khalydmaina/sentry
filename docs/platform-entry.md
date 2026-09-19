# HackCanton platform entry

Copy for the project record on appsfactory.cc. The record is what judges open,
so it is kept accurate against the contracts in `main/daml/Wallet/`.

## Project name

Sentry

## Track

Real-World Assets (RWA) & Business Workflows.

The track's expected output is an end-to-end workflow (create, update status,
transfer or fulfill, audit), a lightweight UI showing roles, a one-page business
brief and a short pilot plan. Sentry is that workflow: issue a holding, delegate
a policy, request a transfer, settle or escalate or reject, leave a record.

## Sponsor challenges

Grofty Wallet Bounty. The owner and agent connect with Grofty, and signing the
policy and approving a held request happen with keys the owner holds.

## Elevator pitch

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

## Tech stack

Daml, Canton, JSON Ledger API, dpm, React, TypeScript, Vite, LocalNet

## Contact

- Email: mainakhalid18@gmail.com
- Telegram: TODO
