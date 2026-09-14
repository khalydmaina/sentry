import { useState } from 'react'
import { LedgerGate } from '../components/LedgerGate'
import { Mark } from '../components/Mark'
import { Chip, CopyText, Meter, Micro } from '../components/ui'
import { useLedger, useNow } from '../ledger/LedgerContext'
import { isStale, windowTotal } from '../ledger/sentry'
import { amount, cid, windowLabel } from '../lib/format'
import { AgentSeat } from './desk/AgentSeat'
import { CreateWallet } from './desk/CreateWallet'
import { OwnerSeat } from './desk/OwnerSeat'
import type { Notice } from './desk/shared'

export function Desk() {
  return (
    <LedgerGate framed>
      <DeskBody />
    </LedgerGate>
  )
}

function DeskBody() {
  const { owner, policy, parties } = useLedger()
  const now = useNow()
  const [seat, setSeat] = useState<'owner' | 'agent'>('agent')
  const [last, setLast] = useState<{ notice: Notice; key: number } | null>(null)
  if (!owner || !parties) return null
  if (!policy) return <CreateWallet />

  const holding = owner.holdings.find((h) => h.cid === policy.holding)
  const balance = holding?.amount ?? 0
  const total = windowTotal(policy, now)
  const held = owner.pending.length
  const record = (notice: Notice) => setLast({ notice, key: Date.now() })

  return (
    <div className="page shell">
      <div className="page-head">
        <div>
          <Micro>Desk · live on the local sandbox</Micro>
          <h1 className="h1">One wallet, seen from both seats.</h1>
        </div>
        <p className="section-note">The agent requests from its seat. Anything outside the policy lands in the owner’s queue. Every command goes to the ledger as that seat’s party, and nothing is checked in this app first.</p>
      </div>

      <div className="strip">
        <div>
          <Micro>Holding</Micro>
          <div className="big">{amount(balance)}</div>
          <span className="help">
            WalletHolding {holding ? <CopyText text={holding.cid}>{cid(holding.cid)}</CopyText> : <span className="unlisted">not visible</span>} · signed by bank
          </span>
        </div>
        <div>
          <Micro>Rolling window · {windowLabel(policy.windowMs)}</Micro>
          <div className="big">
            {amount(total)}
            <small>of {amount(policy.dailyCap)}</small>
          </div>
          <Meter value={total} max={policy.dailyCap} />
        </div>
        <div>
          <Micro tone={held ? 'escalate' : undefined}>Held</Micro>
          <div className={`big ${held ? 'escalate' : ''}`}>{held}</div>
          <span className="help">{held ? 'waiting for the owner' : 'queue is clear'}</span>
        </div>
        <div>
          <Micro>Last outcome</Micro>
          <LastOutcome last={last} />
        </div>
      </div>

      <div className="seat-tabs" role="tablist" aria-label="Seat">
        <button role="tab" aria-selected={seat === 'agent'} onClick={() => setSeat('agent')}>
          Agent seat
        </button>
        <button role="tab" aria-selected={seat === 'owner'} onClick={() => setSeat('owner')}>
          Owner seat {held ? `· ${held} held` : ''}
        </button>
      </div>

      <div className="seats">
        <div className="seat" data-hidden={seat !== 'owner'}>
          <OwnerSeat policy={policy} onOutcome={record} />
        </div>
        <div className="seat" data-hidden={seat !== 'agent'}>
          <AgentSeat policy={policy} balance={balance} onOutcome={record} />
        </div>
      </div>
    </div>
  )
}

function LastOutcome({ last }: { last: { notice: Notice; key: number } | null }) {
  if (!last) {
    return (
      <div className="last-outcome">
        <Mark size={30} state="held" />
        <span className="text">No request from this session yet.</span>
      </div>
    )
  }
  const n = last.notice
  if (n.kind === 'outcome') {
    const o = n.outcome
    const passed = o.kind === 'executed'
    return (
      <div className="last-outcome" key={last.key}>
        <Mark size={30} state={passed ? 'passed' : 'held'} animate={o.kind !== 'rejected'} />
        <div className="text" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>
            {o.kind === 'executed' && <Chip kind="executed">Executed</Chip>}
            {o.kind === 'held' && <Chip kind="held">Held</Chip>}
            {o.kind === 'rejected' && <Chip kind="rejected">Rejected</Chip>}
          </span>
          <span>
            {o.kind === 'held'
              ? `${amount(o.pending.amount)} · ${o.pending.reasons[0]}`
              : `${amount(o.record.amount)} → ${o.record.counterparty.split('::')[0]}`}
          </span>
        </div>
      </div>
    )
  }
  if (n.kind === 'error') {
    return (
      <div className="last-outcome" key={last.key}>
        <Mark size={30} state="held" />
        <div className="text" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>{isStale(n.error) ? <Chip kind="stale">Stale · resubmit</Chip> : <Chip kind="refused">Refused</Chip>}</span>
          <span>no record was written</span>
        </div>
      </div>
    )
  }
  return (
    <div className="last-outcome" key={last.key}>
      <Mark size={30} state="held" />
      <span className="text">{n.title}</span>
    </div>
  )
}
