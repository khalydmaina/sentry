# ICP / Ideal Customer Profile

> **What judges look for:** a clearly defined target user and the specific pain point you solve for them. The narrower and more concrete, the better.

---

## 1. Who they are

| | |
| --- | --- |
| **Segment** | Digital-asset treasury and operations teams that already run unattended payment automation and whose spending limits cannot be public. In the Canton ecosystem specifically: tokenized fund administrators, validator and node operators, wallet and payments teams, and agent infrastructure teams wiring tool-calling models to payment APIs. |
| **Company size / stage** | 10 to 500 people. Past the point of having automated something, before the point of having built an in-house control plane for it. Series A to Series C, or an established firm's digital-asset desk. |
| **User** | The platform or backend engineer who operates the agent. They install it, hold its credential, read the logs at 2am, and know their own `if` statement is the last line of defence. |
| **Buyer** | The person accountable for the money: head of treasury, COO, or at a smaller firm the founder. Not evaluating Daml. Answering whether this can run overnight and whether they can say something defensible if it goes wrong. |
| **Geography** | Wherever Canton's institutional base already is, which in practice means the US, UK, Switzerland and Singapore. Not a constraint we are choosing, just where the counterparties are. |

## 2. Their pain

- **Top pain point:** the agent holds the key, or holds a session that can use it, and every limit on it is code the agent's own process can reach. Prompt injection, a bad tool call, a compromised dependency and an ordinary bug all arrive at the same place.
- **How often it happens:** the spending is daily to hourly. The failure is rare and unbounded, which is exactly why it is unacceptable: it is not priced into anyone's monthly loss budget.
- **What it costs them:** on a bad day, the balance. On every other day, the automation they do not switch on, because the only safe setting is a human approving everything.
- **How they solve it today:** caps in config, a check before submitting, a spending key with a small float topped up by hand, and a human in the loop for anything material. Some have looked at Coinbase Spend Permissions and rejected it because it publishes their limits.

## 3. What they want

**Job to be done:** "When I hand an agent a wallet and go to bed, I want the limits enforced by something the agent cannot reach, so I can let routine payments settle without watching and still answer for every one of them afterwards."

- **What would make them switch:** seeing a refusal they ran themselves. `sentry-agent probe` sends four commands the agent is entitled to send and the ledger refuses all four, balance unchanged either side. That converts an engineer in about thirty seconds.
- **What would stop them:** integration effort against an asset model that is not yet a token standard; needing a participant node they do not have; trust in a hackathon-age codebase; and for the buyer, whether the held queue fits an approval process that already exists.

## 4. Where to find them

- **Communities, events and channels:** the Canton developer community and validator operators, HackCanton itself (mentors, judges and the other entrants are the profile), Canton Foundation channels, and agent tooling communities where teams wire models to payment APIs.
- **Tools and platforms they already rely on:** Canton validators and participant nodes, CIP-0103 wallets, Daml, and the orchestration frameworks their agents run in.
- **Three real, nameable targets that fit:**
  1. **BitSafe** ([bitsafe.finance](https://x.com/BitSafe_Finance)), whose Decentralization Manager we already build on and whose CBTC holders are exactly the custody-conscious profile.
  2. **Nocturnal** ([github.com/nocturnalwallet](https://github.com/nocturnalwallet/nocturnal-canton-wallet)), a CIP-0103 browser wallet that gives users a party and a key but no way to delegate bounded spending. The missing half is us.
  3. **Grofty** (wallet@grofty.cc), a Canton-native wallet whose users are being handed exactly this problem, and whose hackathon bounty is an open door to the conversation.

## 5. Who is NOT your customer (for now)

- **Retail crypto users.** They do not delegate spending to software, the amounts do not justify the setup, and the privacy argument means nothing to them.
- **Consumer AI assistants.** The spend is a few dollars of API credit. Nobody signs a Daml policy for that.
- **Teams on public EVM chains.** Coinbase Spend Permissions already serves them well. If publishing your caps is acceptable, that is a simpler product and we should not pretend otherwise.
- **Anyone wanting custody or key management.** Sentry holds no keys. Attaching to somebody else's CIP-0103 wallet is the point, not a gap.
- **Firms with no automation yet.** The problem only becomes urgent once something is already spending unattended. Selling to them means first selling automation, which is a different company.

## Checklist

- [x] The segment is narrow enough to name real companies or people
- [x] User and buyer are identified
- [x] The pain is described from their point of view
- [x] You know where to reach them
- [x] You have said who you are not targeting
