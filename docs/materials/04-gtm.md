# GTM — Go-to-Market

> **What judges look for:** a go-to-market strategy, distribution channels, positioning and acquisition hypotheses. One page is enough. Hypotheses are fine, label them as hypotheses and say how you will test them.

---

## 1. Positioning

**In one sentence:** Sentry is the spending limit your AI agent cannot argue with, enforced by Canton and visible to nobody but you.

**Against the alternatives:**

| | Enforced by something the agent cannot reach | Limits stay private |
| --- | --- | --- |
| Caps in your own orchestration layer | no | yes |
| Coinbase Spend Permissions | yes | no |
| canton-agent-mcp | no | yes |
| **Sentry** | **yes** | **yes** |

We do not claim to be the first to delegate spending to an agent. We claim that today you choose between enforcement you can prove and limits you can keep private, and that on Canton you do not have to.

## 2. The wedge

The agent CLI, not the dashboard.

`sentry-agent probe` sends four commands the agent is perfectly entitled to send and prints the ledger refusing every one, with the balance unchanged either side. It runs in one command, needs no account, and makes the argument without us in the room. An engineer can run it, believe it, and show their treasury lead.

Dashboards are demoed. Command-line output gets pasted into somebody else's Slack, which is the distribution we actually want.

## 3. Channels, in order

1. **The Canton ecosystem.** Validators, super-validators, wallet teams and fund administrators. Small, published, technical, and already assembled around HackCanton. This is where the first ten users come from.
2. **Wallet partnerships.** A CIP-0103 wallet gives its users a party and a signing key but no way to delegate bounded spending. Sentry is the missing half, and the wallet has the users. Grofty is the obvious first conversation given the bounty.
3. **Agent tooling communities.** Teams connecting tool-calling models to payment APIs, who hit this on their first unattended deployment.
4. **Open source.** The contracts and the agent are public. Adoption at the Daml layer is worth more than sign-ups, because the enforcement is the product.

## 4. Acquisition hypotheses

Each of these is a hypothesis, not a finding.

**H1. The probe output converts better than a demo.**
Engineers trust a refusal they ran themselves more than a screen recording.
*Test:* share the probe output and a demo video with ten ecosystem engineers, five each, and compare replies and follow-up questions. Success is the probe group asking implementation questions at twice the rate.

**H2. The buyer's objection is auditability, not enforcement.**
Once they accept the ledger enforces the cap, the next question is what they can show afterwards.
*Test:* in the first ten buyer conversations, record the second question asked after the mechanism is understood. If audit and reporting dominate, the roadmap leads with the record rather than more policy controls.

**H3. Wallets will distribute this.**
A wallet team would rather integrate delegated spending than build it.
*Test:* pitch two CIP-0103 wallet teams during the hackathon. Success is one agreeing to a joint demo.

**H4. Privacy is the deciding factor, not a nice-to-have.**
We assume firms reject public-chain delegation specifically because caps and counterparties become readable.
*Test:* ask directly whether they would accept Coinbase Spend Permissions if it ran on Canton assets. A yes falsifies our main differentiator and we should know that early.

## 5. What "working" looks like

Deliberately small and countable, because none of it is evidence yet:

- 10 conversations with the ICP, with H2 and H4 recorded verbatim
- 3 engineers who have run `probe` themselves without us present
- 1 wallet team agreeing to a joint demo
- 1 team running the agent against their own policy on LocalNet

## 6. Pilot plan

1. **Weeks 1–2.** Ship the two-participant demo and the agent CLI, both public. Run the ten conversations. The goal is falsifying H4, not selling.
2. **Weeks 3–4.** Wire Sentry to a real wallet for signing and to a token standard for the asset, so a pilot moves something other than self-issued units.
3. **Weeks 5–8.** One design partner runs one real agent with a real cap for a month. The success measure is not volume. It is whether anything reached the held queue that should have, and whether the owner could explain every outcome afterwards.

## 7. Revenue, honestly

Not now. The contracts are open source and the enforcement should be. If this becomes a business it is the operational layer around it that is worth paying for: hosted participants, the approval experience, policy management across many agents, and reporting. Charging for the enforcement itself would be charging for the part we want everyone to check.

## Checklist

- [x] Positioning stated in one sentence
- [x] Channels identified and ordered
- [x] Acquisition hypotheses labelled as hypotheses
- [x] Each hypothesis has a test
- [x] Success criteria are countable
- [x] Fits on a page
