# Value / Problem Statement

> **What judges look for:** the problem, who has it, why it matters, why now, and why it belongs on Canton.

---

## The problem, in one sentence

When an AI agent is given a wallet, the limits on what it can spend live inside the software that calls the model, so the thing enforcing the limit is the same thing an attacker has already compromised.

## Who has it

A treasury or operations lead at a firm that has put an autonomous agent in front of real money: an agent that pays suppliers, tops up API credits, rebalances a position, or settles invoices without a human in the loop.

Not "companies using AI". The person with this problem has already made the decision to let software spend, and is now accountable for what it spends.

## Before and after

**Before.** The agent holds the key, or holds a session that can use the key. The caps are configuration: a value in a config file, a check in the orchestration layer, a rule in the wallet app. Every one of those is code the agent's own process can reach. Prompt injection, a bad tool call, a dependency compromise or an ordinary bug all arrive at the same place, which is a wallet that will do what it is told. The owner finds out afterwards, from the ledger.

**After.** The owner signs a policy on Canton that delegates a per-transaction cap, a rolling daily cap, an allowlist of counterparties and an auto-approve threshold. The agent's only way to move funds is to exercise one choice on that policy. A request inside the policy settles immediately. Anything outside it becomes a pending approval that only the owner can clear. A request over the balance is refused outright. The agent cannot move the holding directly, cannot spend as the owner, cannot widen its own caps and cannot mint itself more. Not because the client stops it, but because the ledger refuses the command.

The difference is where the limit lives. Before, it is advice. After, it is authority.

## Evidence the problem is real

Two products already exist to solve it, each solving half:

- **Coinbase Spend Permissions** puts delegated spending limits on-chain, so they are enforced by something the agent does not control. They are also public: anyone can read a company's caps, counterparties and cadence.
- **canton-agent-mcp** gives an agent the same shape of controls, privately, but enforces them in the wallet application. The enforcement point is back inside the software the agent is talking to.

Nobody had to explain the problem to either team. The gap is that you currently choose between enforcement you can prove and limits you can keep private.

## Why now

Agents that spend are shipping, not theoretical: tool-calling models now sit in front of payment APIs, and the agent payment surface is being standardised rather than improvised. Canton Mainnet carries real institutional assets and a regulated stablecoin, and wallets such as Grofty now give an agent's owner a first-class party and a signing key. The rails and the agents arrived at the same time; the control layer between them did not.

## Why this belongs on Canton, and why a database would not do

A database can enforce a spending limit perfectly well. What it cannot do is convince anyone else that it did. The limit and the record both live with whoever runs the service, so the counterparty, the auditor and the owner are all trusting the same operator. That is the position we are trying to get out of.

A public chain fixes the trust and breaks the confidentiality. Putting the policy on a transparent ledger publishes the caps, the allowlist and the spending cadence of whoever signed it. For a firm, that is competitively and operationally unacceptable.

Canton is the only one of the three where both hold at once:

- **The limit is enforced by the ledger.** `RequestTransfer` is the agent's only choice on the policy, and the caps are checked inside the contract when the command arrives. There is no client-side check to patch around.
- **The policy stays private.** It is signed by the owner and observed by the agent, and nobody else. We demonstrate this across two participant nodes: the bank that issued the funds and the merchant that was paid never receive the policy contract at all. It is not filtered out of their view, it is never delivered to their participant.
- **The record is still shared.** Every outcome leaves a contract the right parties can see, so an audit does not depend on our logs.

## Checklist

- [x] The problem fits in one sentence
- [x] It names a specific user, not "everyone"
- [x] The value is shown as a before and after
- [x] There is evidence the problem is real
- [x] "Why now" is answered
- [x] It is clear why this belongs on Canton
