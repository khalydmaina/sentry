# GTM / Go-to-Market

> **What judges look for:** a go-to-market strategy, distribution channels, positioning and acquisition hypotheses. One page is enough. Hypotheses are fine, label them as hypotheses and say how you will test them.

---

## 1. Positioning

**In one sentence:** For **treasury and platform teams running an agent that spends real money**, who **cannot bound it without either publishing their limits or trusting their own code**, **Sentry** is a **ledger-enforced spending policy** that **settles routine payments unattended and holds everything else for a signature**. Unlike **Coinbase Spend Permissions**, our **caps, counterparties and cadence stay off every participant but the owner's own**.

**What do users do today instead?** Caps in config, a check before submitting, a spending key with a small float topped up by hand, and a human approving anything material. Some have evaluated Spend Permissions and rejected it for publishing their limits.

**Why Canton and not any other chain?** Because the claim needs two properties at once and Canton is the only place they coexist:

| | Enforced by something the agent cannot reach | Limits stay private |
| --- | --- | --- |
| Caps in your own orchestration layer | no | yes |
| Coinbase Spend Permissions | yes | no |
| canton-agent-mcp | no | yes |
| **Sentry** | **yes** | **yes** |

We do not claim to be first to delegate spending to an agent. We claim you currently choose between enforcement you can prove and limits you can keep private, and that on Canton you do not have to.

## 2. First customers

- **Segment:** Canton-native teams already running unattended payment automation. Validator and node operators, tokenized fund administrators, and wallet teams whose users are asking for delegated spending.
- **Why them first:** they feel the pain most, they already have a participant node, and they can say yes without a procurement process. The Canton ecosystem is also small enough that they are a published, reachable list rather than a market to be segmented.
- **First targets:**
  1. **BitSafe**, whose Decentralization Manager we already build on. The integration is the conversation opener.
  2. **Nocturnal**, a CIP-0103 wallet with a party and a key but no delegation layer.
  3. **Grofty**, whose bounty is an open door and whose users have this problem now.
  4. **HackCanton entrants and mentors**, several of whom are building the payment and custody rails this sits on.

## 3. Distribution channels

| Channel | Why it reaches our users | First concrete action | Effort / cost |
| --- | --- | --- | --- |
| The agent CLI as the artefact | `probe` output gets pasted into somebody else's Slack; a dashboard gets demoed once and forgotten | Publish the probe transcript in the repo README and the Canton dev channel | Done, zero cost |
| Wallet partnerships | A CIP-0103 wallet gives users a party and a key but no bounded delegation. We are the missing half and they have the users | Pitch Nocturnal and Grofty during the hackathon | One conversation each |
| Canton ecosystem directly | Validators, SVs and fund administrators are small, technical, published and already assembled | Ten ICP conversations, targets named above | Two weeks of calls |
| Open source at the Daml layer | Adoption of the contracts is worth more than signups, because the enforcement is the product | Repo public with contracts, tests and mutation suite | Done |

## 4. Acquisition hypotheses

Every row is a hypothesis. None has been tested.

| Hypothesis | How we test it | Success metric | Status |
| --- | --- | --- | --- |
| **H1.** Engineers trust a refusal they ran themselves more than a demo video | Share the probe output with five ecosystem engineers and a demo video with five others | Probe group asks implementation questions at twice the rate | ⏳ untested |
| **H2.** The buyer's real objection is auditability, not enforcement | In ten buyer conversations, record the second question asked once the mechanism is understood | Audit and reporting dominate over more policy controls | ⏳ untested |
| **H3.** Wallets will distribute this rather than build it | Pitch two CIP-0103 wallet teams during the hackathon | One agrees to a joint demo | ⏳ untested |
| **H4.** Privacy is the deciding factor, not a nice-to-have | Ask directly whether they would accept Spend Permissions if it ran on Canton assets | A no from the majority. A yes falsifies our main differentiator | ⏳ untested, **and this is the one that matters** |

## 5. Business model

- **Who pays, and for what:** not the enforcement. The contracts are open source and should stay that way, because the whole argument is that anyone can check them. What is worth paying for is the operational layer: hosted participants, the approval experience, policy management across many agents, and reporting.
- **Pricing hypothesis:** per-agent monthly for policy management and approvals, with the contracts free forever. Untested, and deliberately not modelled in detail before the first ten conversations.
- **Revenue on Canton:** B2B licensing of the operational layer, and Featured App rewards if this reaches that bar. Not transaction fees: taking a cut of a payment the owner is already making would be charging for the part we want everyone to inspect.
- **Why now:** the agents and the rails arrived together, and the control layer between them did not.

## 6. First 90 days after the hackathon

| Period | Milestone | How we will know it is done |
| --- | --- | --- |
| Weeks 1 to 4 | Ten ICP conversations, aimed at falsifying H4 rather than selling | Ten written notes with the second question and the privacy answer recorded verbatim |
| Weeks 1 to 4 | A real CIP-0103 wallet signing against Sentry, replacing the stand-in provider | An owner signs a policy from a wallet we did not write |
| Weeks 5 to 8 | Asset model wired to a token standard rather than self-issued units | A pilot moves something other than demo units |
| Weeks 5 to 8 | One wallet team agreeing to a joint demo | Scheduled, with a date |
| Weeks 9 to 12 | One design partner running one real agent with a real cap for a month | Anything that should have reached the held queue did, and the owner can explain every outcome |

Note the success measure for the pilot is not volume. It is whether the held queue caught what it should have and whether the record was enough to answer for it afterwards.

## 7. Risks and what you need

**What could block adoption:**

- **Node access.** Most of the ICP will not run a participant for this. That is the strongest argument for wallet distribution over direct adoption, and it is a real constraint rather than a detail.
- **The asset model.** Self-issued units are fine for a demo and useless for a pilot. Until this sits on a token standard, nobody moves real value through it.
- **Trust in a hackathon-age codebase.** Mitigated by the mutation suite and by everything being reproducible, not by asking for the benefit of the doubt.
- **Approval process fit.** If the held queue does not map onto an approval flow a firm already has, it becomes a second inbox nobody watches.

**What we need from the ecosystem:**

1. **Ten introductions** to people accountable for an agent that already spends. This decides whether the product exists.
2. **A MainNet validator path**, so a wallet integration runs end to end rather than against a stand-in.
3. **A token standard to build on**, which turns the demo asset into a funding model.

## Checklist

- [x] Positioning fits in one sentence
- [x] First segment is specific, not "everyone in DeFi"
- [x] At least two channels with a concrete first action
- [x] At least three hypotheses, each with a metric
- [x] It is clear who pays and why
- [x] You can explain why Canton and not any chain
