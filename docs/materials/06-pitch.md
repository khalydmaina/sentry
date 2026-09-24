# Pitch

> **What judges look for:** a clear, convincing pitch: the problem, the solution, the demo, and what happens next.

---

## The 30-second version

Firms are handing AI agents wallet keys. The limits on what those agents can spend live in the software that calls the model, so the thing enforcing the limit is the thing under attack.

Sentry moves the limit onto Canton. The owner signs a policy that delegates a per-transaction cap, a rolling daily cap, a counterparty allowlist and an auto-approve threshold. Inside the policy, a payment settles. Outside it, it waits for the owner. Over the balance, it is refused. The agent has no other way to reach the funds, and nobody but the owner and the agent can read the limits.

Say this, not "we secure AI agents".

## Three minutes, in order

The Grand Final is live and the Grofty bounty wants a video of three minutes or less, so the same run order serves both.

| Time | Beat | What is on screen |
| --- | --- | --- |
| 0:00 | The problem, in the one sentence above | Nothing. Say it to the room. |
| 0:20 | Why the two existing answers each solve half: Coinbase Spend Permissions is enforced but public, canton-agent-mcp is private but enforced in the wallet app | The gap table from the landing page |
| 0:40 | The owner signs a policy. Read the four numbers out loud. | Desk, owner seat, policy card |
| 1:00 | The agent asks for 40 and it settles. Then 120 and it is held. Then an unlisted counterparty, held. Then over the balance, rejected. | Terminal running `sentry-agent.mjs`, ledger table filling behind it |
| 1:40 | **The moment.** `probe`: four commands the agent is free to send, four refusals from the ledger. Say the line: delete every check in this script and nothing changes. | `4 of 4 refused by the ledger` |
| 2:10 | Privacy across nodes. The bank issued the money, the merchant was paid, neither participant ever receives the policy. | Privacy page, live matrix |
| 2:30 | The owner is not a single point of failure either: the owner party is hosted on two participants, and clearing a held request runs under shared control. Lose a host, the wallet still answers. | Governance state on the privacy page |
| 2:45 | What is real and what is not: the mechanism is verified, adoption is not, zero interviews, ten conversations is the next step | Nothing. Say it. |

The order matters. The refusal comes before the privacy, because the refusal is the claim and privacy is why it has to be Canton.

## The one moment that carries the pitch

Everything else is a description. `probe` is the proof, and it is the only part a judge cannot get from the README:

```
REFUSED    move the holding directly      DAML_AUTHORIZATION_ERROR
REFUSED    spend as the owner             DAML_AUTHORIZATION_ERROR
REFUSED    raise its own caps             DAML_AUTHORIZATION_ERROR
REFUSED    mint itself a holding          DAML_AUTHORIZATION_ERROR
4 of 4 refused by the ledger.
```

It lands because the agent is a program holding its own credential, outside the browser, and because the errors come back from Canton rather than from our code. If time runs short, cut the privacy page before cutting this.

## The three questions, and the answers

**"Why not a database?"** A database enforces a limit perfectly well. It cannot convince anyone else that it did, because the limit and the record both live with whoever runs the service. The counterparty, the auditor and the owner all end up trusting the same operator.

**"Why not a public chain?"** It fixes the trust and publishes the caps, the allowlist and the spending cadence of whoever signed the policy. Ask a treasury lead whether that is acceptable. Canton is the only place both hold at once, and the privacy page measures it rather than asserting it.

**"What is not built?"** Said plainly, before being asked: the asset model is self-contained rather than a token standard, the issuer mints on request like a faucet, the participants run in memory, and there are zero user interviews. The Grofty integration runs against a stand-in CIP-0103 provider because Grofty is MainNet-only and invitation-gated.

Claiming narrowly is the whole voice of this project. A judge who catches one overclaim discounts everything else.

## What we ask for

Not funding. Three things, in this order:

1. **Ten introductions** to people accountable for an agent that already spends. The GTM material carries four hypotheses and H4 is the one that decides whether this product exists.
2. **A MainNet validator path**, so the Grofty demo runs end to end rather than against a stand-in.
3. **A token standard to sit on**, which turns the self-contained asset model into a real funding path.

## Delivery notes

- The lexicon is executed, held, rejected. Use those words and no others for the three outcomes.
- No spinners on screen. Motion is 120, 200 and 400ms, and a pause reads as broken.
- Read the four policy numbers aloud once. The audience needs them to follow the four requests.
- Do not say "secure", "trustless" or "unhackable". Say the ledger refuses the command.
- Have the ledger already running before the pitch starts. The first cross-participant transaction is slow while topology is exchanged, and that is not the thing to demonstrate.

## Checklist

- [x] The problem is one sentence a non-technical judge understands
- [x] The demo has one moment that proves the claim, and it is identified
- [x] The run order is timed and fits three minutes
- [x] The two obvious objections are answered before being asked
- [x] What is not built is said by us, not found by a judge
- [x] The ask is specific and is not money
