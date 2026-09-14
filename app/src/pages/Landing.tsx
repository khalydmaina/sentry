import { useEffect, useState } from 'react'
import { Mark, Wordmark } from '../components/Mark'
import { Chip, Micro, type ChipKind } from '../components/ui'

const TAPE: Array<{ line: string; kind: ChipKind; label: string; why: string }> = [
  { line: '40.00 → Merchant', kind: 'executed', label: 'Executed', why: 'allowlisted · under both caps · at or under the auto-approve threshold' },
  { line: '120.00 → Merchant', kind: 'held', label: 'Held', why: 'above the auto-approve threshold, waits for the owner' },
  { line: '10.00 → Stranger', kind: 'held', label: 'Held', why: 'counterparty not allowlisted' },
  { line: '5,000.00 → Merchant', kind: 'rejected', label: 'Rejected', why: 'insufficient balance, the only automatic rejection' },
]

function Tape() {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (shown >= TAPE.length) return
    const id = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 500 : 900)
    return () => clearTimeout(id)
  }, [shown])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Micro>Illustrative requests · the desk shows live ones</Micro>
      <div className="tape">
        {TAPE.slice(0, shown).map((t) => (
          <div className="tape-row arrive" key={t.line}>
            <span>{t.line}</span>
            <Chip kind={t.kind}>{t.label}</Chip>
            <span className="why">{t.why}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const WHO: Array<{ row: string; cells: Array<string | null> }> = [
  { row: 'WalletHolding · the wallet’s funds', cells: ['observer', 'observer', 'signatory', null, null] },
  { row: 'WalletPolicy · caps, allowlist, window', cells: ['signatory', 'observer', null, null, null] },
  { row: 'PendingApproval', cells: ['signatory', 'signatory', null, null, null] },
  { row: 'ExecutedTransfer', cells: ['signatory', 'observer', null, 'observer, own transfer', null] },
  { row: 'RejectedTransfer', cells: ['signatory', 'observer', null, null, null] },
  { row: 'WalletHolding · received by counterparty', cells: [null, null, 'signatory', 'observer', null] },
]

const REFUSALS: Array<{ try: string; because: string }> = [
  { try: 'Move the holding to itself', because: 'WalletHolding.Transfer is controlled by the owner.' },
  { try: 'Raise its own caps', because: 'UpdatePolicy is controlled by the owner.' },
  { try: 'Pay the way the owner can', because: 'OwnerTransfer is controlled by the owner.' },
  { try: 'Approve its own held request', because: 'PendingApproval.Approve is controlled by the owner.' },
  { try: 'Archive the policy', because: 'Only the owner signed WalletPolicy.' },
  { try: 'Write its own ExecutedTransfer', because: 'The record needs the owner’s signature.' },
  { try: 'Mint itself a holding', because: 'Holdings need Bank’s signature.' },
  { try: 'Send a zero or negative amount', because: 'RequestTransfer asserts amount > 0.0 before any other check.' },
]

const LIMITS: Array<{ text: string; detail: string }> = [
  { text: 'The issuer can archive a holding directly.', detail: 'Every signatory can archive its own contract. The policy then points at a dead holding until the owner repoints it with UpdatePolicy.' },
  { text: 'Nothing rate-limits escalations.', detail: 'An agent can raise as many PendingApprovals as it likes.' },
  { text: 'Funds sent to the owner land in an untracked second holding.', detail: 'The policy only spends from the one holding it points at.' },
  { text: 'The rolling cap bounds the total, not the count.', detail: 'Many tiny spends grow recentSpends inside the window.' },
  { text: 'Not wired to Canton Coin or a token standard.', detail: 'The Bank-issued holding exists to prove the enforcement mechanism.' },
]

export function Landing() {
  return (
    <>
      <section className="shell hero">
        <div className="hero-main">
          <div className="hero-copy">
            <Micro>HackCanton S3 · Canton Network / Daml</Micro>
            <h1 className="display">Spending limits your agent cannot argue with.</h1>
            <p className="lede">
              The owner signs a spending policy on Canton. The agent’s only way to move funds is a choice on that policy, so the ledger runs every check. The
              caps and allowlist are visible to the owner and the agent, and to no one else.
            </p>
            <div className="hero-actions">
              <a className="btn primary" href="#/desk">
                Run the demo
              </a>
              <a className="btn" href="#/contract">
                Read the contract
              </a>
            </div>
          </div>
          <Tape />
        </div>
        <aside className="hero-side">
          <Micro>The one idea</Micro>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="idea">
              <Micro tone="signal">Enforced by the ledger</Micro>
              <p>RequestTransfer checks the per-transaction cap, rolling cap, allowlist and auto-approve threshold inside the contract. There is no client-side check to patch around.</p>
            </div>
            <div className="idea">
              <Micro tone="signal">Policy is private</Micro>
              <p>WalletPolicy is signed by the owner and observed by the agent. Every other party gets no contract data for it.</p>
            </div>
          </div>
          <p className="data" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.75, color: 'var(--bone-3)' }}>
            Coinbase Spend Permissions: enforced on-chain, limits public.
            <br />
            canton-agent-mcp: private, enforced by the wallet app.
            <br />
            <span style={{ color: 'var(--bone)' }}>sentry: enforced by the ledger, private to owner and agent.</span>
          </p>
        </aside>
      </section>

      <section className="shell section">
        <div className="section-head">
          <div>
            <Micro tone="signal">The gap</Micro>
            <h2 className="h1">Neither rival has both properties.</h2>
          </div>
          <p className="section-note">Ledger-enforced spending limits are not new. A policy that is enforced by the ledger and also private to the parties on it is the difference.</p>
        </div>
        <div className="scroll-x">
          <table className="grid-table stack">
            <thead>
              <tr>
                <th />
                <th>Enforced by the ledger</th>
                <th>Policy is private</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Coinbase Spend Permissions</td>
                <td className="yes" data-label="Enforced by the ledger">✓ yes · on-chain contract on Base</td>
                <td className="no" data-label="Policy is private">× no · allowance is public state</td>
              </tr>
              <tr>
                <td>canton-agent-mcp</td>
                <td className="no" data-label="Enforced by the ledger">× no · the wallet app checks before signing</td>
                <td className="yes" data-label="Policy is private">✓ yes · the policy never touches the ledger</td>
              </tr>
              <tr className="us">
                <td>sentry</td>
                <td className="yes" data-label="Enforced by the ledger">✓ yes · Daml choice on WalletPolicy</td>
                <td className="yes" data-label="Policy is private">✓ yes · visible to owner and agent only</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="shell section">
        <div className="section-head">
          <div>
            <Micro>Request path · three outcomes</Micro>
            <h2 className="h1">One choice in, one record out.</h2>
          </div>
          <p className="section-note">The agent exercises RequestTransfer on the policy. Only the executed branch moves funds and rewrites the policy. A zero or negative amount is refused before any record exists.</p>
        </div>
        <div className="path">
          <div className="path-box">
            <span style={{ color: 'var(--signal)' }}>agent</span>
            <br />
            <span className="sub">RequestTransfer</span>
          </div>
          <div className="path-line" />
          <div className="path-box focus">
            WalletPolicy
            <br />
            <span className="sub">caps · allowlist · rolling window</span>
          </div>
          <div className="path-line" />
          <div className="outcomes">
            <div className="outcome">
              <div className="outcome-card executed">ExecutedTransfer</div>
              <div className="outcome-why">allowlisted, under both caps, at or under the threshold · funds move</div>
            </div>
            <div className="outcome">
              <div className="outcome-card held">PendingApproval</div>
              <div className="outcome-why">unlisted, over a cap, or above the threshold · policy untouched</div>
            </div>
            <div className="outcome">
              <div className="outcome-card rejected">RejectedTransfer</div>
              <div className="outcome-why">insufficient balance · the only automatic rejection</div>
            </div>
          </div>
        </div>
      </section>

      <section className="shell section">
        <div className="section-head">
          <div>
            <Micro>Who sees what</Micro>
            <h2 className="h1">Visibility comes from the signatures.</h2>
          </div>
          <p className="section-note">
            Read off the templates’ signatories and observers. The <a href="#/privacy" style={{ color: 'var(--signal)' }}>privacy page</a> runs the same table as live queries, one per party.
          </p>
        </div>
        <div className="scroll-x">
          <table className="grid-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Owner</th>
                <th>Agent</th>
                <th>Bank · issuer</th>
                <th>Counterparty</th>
                <th>Outsider</th>
              </tr>
            </thead>
            <tbody>
              {WHO.map((r) => (
                <tr key={r.row}>
                  <td style={{ color: 'var(--bone)' }}>{r.row}</td>
                  {r.cells.map((c, i) =>
                    c ? (
                      <td key={i} className="yes">
                        ✓ {c}
                      </td>
                    ) : (
                      <td key={i} className="hatch">
                        no data
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="shell section">
        <div className="section-head">
          <div>
            <Micro>What the ledger refuses</Micro>
            <h2 className="h1">Everything the agent might try instead.</h2>
          </div>
          <p className="section-note">Covered by testAgentHasNoOtherPath and testRejectsNonPositiveAmounts. Each one can also be sent from the agent seat on the desk, where the ledger’s own error comes back.</p>
        </div>
        <div className="refusals">
          {REFUSALS.map((r) => (
            <div className="refusal" key={r.try}>
              <Chip kind="refused">Refused</Chip>
              <div className="try">{r.try}</div>
              <div className="because">{r.because}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="shell section">
        <div className="section-head">
          <div>
            <Micro tone="escalate">Stated limitations</Micro>
            <h2 className="h1">Said before anyone asks.</h2>
          </div>
        </div>
        <ol className="limits">
          {LIMITS.map((l) => (
            <li key={l.text}>
              <div>
                {l.text}
                <span>{l.detail}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="shell cta-band">
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Mark size={40} state="held" />
          <h2 className="h1">Watch the ledger say no.</h2>
        </div>
        <div className="hero-actions">
          <a className="btn primary" href="#/desk">
            Run the demo
          </a>
          <a className="btn" href="#/contract">
            Read the contract
          </a>
        </div>
      </section>

      <footer className="shell footer">
        <Wordmark size={16} />
        <Micro>Local Canton sandbox · Daml 3.5 · HackCanton S3</Micro>
      </footer>
    </>
  )
}
