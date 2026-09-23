# ICP / Audience Definition

> **What judges look for:** a segment narrow enough to name, the user and the buyer separated, the pain in their words, where to reach them, and who you are deliberately not serving.

---

## The segment

**Digital-asset treasury and operations teams that have already automated payments, and whose limits cannot be public.**

Concretely, the first ten conversations are with organisations that are already on Canton and already run something unattended:

- **Tokenized fund administrators and asset managers** on Canton, who run scheduled settlement, redemption and rebalancing jobs against real holdings.
- **Validator and node operators** in the Canton ecosystem, who hold CC for fees, run automated top-ups and swaps, and are technical enough to adopt a Daml-level control.
- **Wallet and payments teams building on Canton**, such as those shipping CIP-0103 wallets and bridges, who are being asked by their own users for delegated spending.
- **Agent infrastructure teams** wiring tool-calling models to payment APIs, who currently implement caps in their own orchestration layer and know it is the weak point.

These are nameable. The Canton ecosystem is small enough that the validators, super-validators and wallet teams are a published list, and the hackathon itself puts several of them in one Telegram group.

## The user and the buyer are not the same person

**The user** is the platform or backend engineer who operates the agent. They install it, hold its credential, read the logs at 2am, and are the one who notices that the only thing standing between a bad tool call and the treasury is their own `if` statement. They want a control they do not have to maintain and cannot accidentally bypass.

**The buyer** is the person accountable for the money: a head of treasury, a COO, or at a smaller firm the founder. They are not evaluating Daml. They are answering a different question, which is whether they can let this thing run overnight and say something defensible afterwards if it goes wrong.

Sentry has to satisfy both, and they are convinced by different artefacts. The engineer is convinced by `sentry-agent probe`, which sends four commands the agent is free to send and shows the ledger refusing all four. The buyer is convinced by the held queue and the record: every outcome, executed or refused, leaves a contract with the reason attached.

## The pain, from their side

From the engineer, roughly:

> "The agent has the key. I have caps in config and a check before I submit. If the model gets talked into something, or a dependency I don't control gets popped, none of that matters. I'm the last line of defence and I know it."

From the buyer:

> "I can't let it run unattended, and I can't put our payment limits on a public chain where every counterparty can read them. So we keep a human in the loop for everything, which is most of the reason we automated it in the first place."

The shape of the pain is that today's options are all-or-nothing. Either a human approves everything, which erases the value of the agent, or the agent is trusted with everything, which nobody is comfortable signing off on. Sentry's whole proposition is the middle: routine spending settles without anyone watching, and everything else waits for a signature.

## Where to reach them

- **The Canton ecosystem directly.** Validator and SV operators, the Canton developer community, and the wallet teams shipping CIP-0103. Small, technical, reachable, and already in the same rooms.
- **HackCanton itself.** Mentors, judges and the other entrants are exactly the profile: 18 teams are registered, and several are building the payment, custody and fund-administration rails this sits on top of.
- **Agent tooling communities.** Teams wiring models to payment APIs hit this problem on their first production deployment.
- **The agent CLI as the wedge.** `sentry-agent` runs standalone and its `probe` output is a self-contained argument. It is shareable in a way a dashboard is not.

## Segments we are deliberately not targeting, and why

- **Retail crypto users.** They do not delegate spending to software, the amounts do not justify the setup, and the privacy argument means nothing to them.
- **Consumer AI assistants.** The spend is a few dollars of API credit. Nobody is signing a Daml policy for that.
- **Teams on public EVM chains.** Coinbase Spend Permissions already serves them well. If publishing your caps is acceptable, that is a simpler product and we should not pretend otherwise.
- **Anyone wanting custody or key management.** Sentry does not hold keys, and the wallet is somebody else's job. Attaching to a CIP-0103 wallet is the point.
- **Firms with no automation yet.** The problem only becomes urgent once something is already spending unattended. Selling to them means first selling automation, which is a different company.

## Checklist

- [x] The segment is narrow enough to name real companies or people
- [x] User and buyer are identified
- [x] The pain is described from their point of view
- [x] You know where to reach them
- [x] You have said who you are not targeting
