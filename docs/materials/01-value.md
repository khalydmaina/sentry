# Value / Problem Statement

> **What judges look for:** what problem you solve, why it matters and why now, and what value you create for the people who have it. A real problem, stated specifically, with evidence that it exists.

---

## 1. The problem in one sentence

**Treasury and platform teams that have already put an autonomous agent in front of real money** struggle to **bound what it can spend** because **the caps live inside the same software the agent runs on**, which costs them **either the value of the automation or an unbounded loss when the agent is wrong**.

Put the other way round: the thing enforcing the limit is the thing under attack.

## 2. The value you create

| | Today | With Sentry |
| --- | --- | --- |
| **What the user does** | Writes caps into config and a check before submitting, holds the agent's key in the same process, and keeps a human approving anything that matters | Signs one policy on Canton delegating a per-transaction cap, a rolling cap, an allowlist and an auto-approve threshold, then lets the agent run |
| **Time / cost / risk** | Either a person approves every payment, which erases the reason for the agent, or nothing bounds a compromised agent but the code it has already reached | Routine spending settles with nobody watching; anything outside the policy waits for a signature; nothing outside it can settle at all |

- **Value proposition in one line:** the spending limit your AI agent cannot argue with, enforced by Canton and readable by nobody but you.
- **Why users would switch from what they do today:** because the control they have now is advice, and the one they get is authority. `RequestTransfer` is the agent's only choice on the policy, and deleting every check in the agent's own code changes nothing about what it can spend.

## 3. Why it matters

**Cost of the problem.** The failure is unbounded rather than expensive on average. A cap in an orchestration layer is reachable by prompt injection, a bad tool call, a compromised dependency or an ordinary bug, and all four arrive at the same place: a wallet that does what it is told. The owner finds out afterwards, from the ledger. We do not have a dollar figure for this and will not invent one; what we can state is the shape, which is that the loss is bounded by the balance rather than by the policy.

**The real cost being paid today is the automation that does not happen.** Firms that will not accept an unbounded agent keep a human in the approval path for everything, which is most of the reason they automated in the first place.

**How many have it.** Unquantified, and deliberately not guessed. The population we can name is narrow and real: organisations already running unattended payment automation against tokenized assets. In the Canton ecosystem specifically, validators, fund administrators and wallet teams are a published and reachable list.

**Evidence the problem is real.** Two products already exist to solve it, each solving half:

- **Coinbase Spend Permissions** puts delegated spending limits on-chain, enforced by something the agent does not control. They are also public: anyone can read a company's caps, counterparties and cadence.
- **canton-agent-mcp** gives an agent the same shape of controls, privately, but enforces them in the wallet application, which puts the enforcement point back inside the software the agent is talking to.

Nobody had to explain the problem to either team. The gap is that today you choose between enforcement you can prove and limits you can keep private.

## 4. Why now

**What changed.** Tool-calling models now sit in front of payment APIs in production rather than in demos, and the agent payment surface is being standardised rather than improvised. On Canton specifically, CIP-0103 was approved on 29 January 2026 and gives any dApp a vendor-neutral way to reach a user's wallet and signing key, so an agent's owner now has a first-class party and a key to sign a policy with. Canton Mainnet carries real institutional assets and a regulated stablecoin.

**Why this could not be solved well before.** The three pieces landed separately. Agents that spend arrived without a control layer; ledger-enforced delegation arrived only in public form; and until CIP-0103 there was no standard way for an owner to hold the key that signs the delegation. The rails and the agents arrived at the same time and the layer between them did not.

## 5. Why Canton

**What Canton makes possible here.** Both halves at once, which is the entire claim:

- **The limit is enforced by the ledger.** The caps, the allowlist, the rolling window and the escalation are checked inside `RequestTransfer` when the command arrives. There is no client-side check to patch around.
- **The policy stays private.** It is signed by the owner and observed by the agent, and reaches no one else. Measured across three participants: the node hosting the bank that issued the funds and the merchant that was paid holds no policy at all, and returns none even when the query is put to it as the owner's own party.
- **The record is still shared.** Every outcome leaves a contract the right parties can see, so an audit does not depend on our logs.
- **Shared control is available without building it.** Releasing a held request runs through BitSafe's Decentralization Manager at a threshold of two, with confirmations from parties on different participants.

**Why a public chain or a plain database would not do.**

A database enforces a spending limit perfectly well. What it cannot do is convince anyone else that it did, because the limit and the record both live with whoever runs the service. The counterparty, the auditor and the owner all end up trusting the same operator, which is the position the product exists to escape.

A public chain fixes the trust and breaks the confidentiality. Putting the policy on a transparent ledger publishes the caps, the allowlist and the spending cadence of whoever signed it. For a firm that is competitively and operationally unacceptable, and it is the reason Spend Permissions is not simply the answer.

## Checklist

- [x] The problem fits in one sentence
- [x] It names a specific user, not "everyone"
- [x] The value is shown as a before and after
- [x] There is evidence the problem is real
- [x] "Why now" is answered
- [x] It is clear why this belongs on Canton
