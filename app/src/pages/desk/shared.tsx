import type { ReactNode } from 'react'
import { LedgerError } from '../../ledger/api'
import { isStale, refusalText, type Outcome, type Role } from '../../ledger/sentry'
import { amount, partyId } from '../../lib/format'
import { Banner } from '../../components/ui'

export const WINDOWS: Array<{ ms: number; label: string }> = [
  { ms: 60_000, label: '1 minute' },
  { ms: 120_000, label: '2 minutes' },
  { ms: 600_000, label: '10 minutes' },
  { ms: 3_600_000, label: '1 hour' },
  { ms: 86_400_000, label: '24 hours' },
]

export const COUNTERPARTY_ROLES: Role[] = ['merchant', 'stranger', 'bank', 'outsider']

export function parseAmount(v: string): number | null {
  if (!/^-?\d+(\.\d{0,10})?$/.test(v.trim())) return null
  return Number(v)
}

export type Notice =
  | { kind: 'outcome'; outcome: Outcome; actor: 'agent' | 'owner' }
  | { kind: 'error'; error: unknown }
  | { kind: 'text'; tone: 'allow' | 'escalate' | 'reject' | 'info'; title: string; body?: string }

export function NoticeBanner({ notice }: { notice: Notice }) {
  const name = (id: string) => partyId(id).split('::')[0]
  if (notice.kind === 'text') return <Banner kind={notice.tone} title={notice.title}>{notice.body}</Banner>
  if (notice.kind === 'error') {
    const err = notice.error
    if (isStale(err)) {
      return (
        <Banner kind="reject" title="Policy contract is stale." glyph="↻">
          A transfer committed first and replaced it. Resubmit against the current policy.
        </Banner>
      )
    }
    const code = err instanceof LedgerError ? err.code : 'ERROR'
    return (
      <Banner kind="reject" title="Refused by the ledger.">
        <code>{code}</code>: {refusalText(err)}
      </Banner>
    )
  }
  const o = notice.outcome
  if (o.kind === 'executed') {
    const via = o.record.via === 'OwnerApproved' ? ' Approved by the owner.' : o.record.via === 'OwnerDirect' ? ' Paid directly by the owner.' : ''
    return (
      <Banner kind="allow" title={`${amount(o.record.amount)} sent to ${name(o.record.counterparty)}.`}>
        Recorded as ExecutedTransfer, signed by the owner.{via}
      </Banner>
    )
  }
  if (o.kind === 'held') {
    return (
      <Banner kind="escalate" title="Held for the owner’s sign-off.">
        {o.pending.reasons.join(' · ')}.
      </Banner>
    )
  }
  const owner = o.record.via === 'OwnerRejected'
  return (
    <Banner kind="reject" title={owner ? 'Rejected by the owner.' : `Rejected: ${o.record.reasons.join(', ')}.`}>
      {owner ? `${amount(o.record.amount)} to ${name(o.record.counterparty)} will not move.` : 'Nothing moved.'} Recorded as RejectedTransfer.
    </Banner>
  )
}

export function SeatHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="seat-head">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
        <span className="micro seat-title" style={{ color: 'var(--bone)' }}>
          {title}
        </span>
        {children}
      </div>
    </div>
  )
}
