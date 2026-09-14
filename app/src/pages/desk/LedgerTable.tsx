import { Fragment, useEffect, useRef, useState } from 'react'
import { Chip, CopyText, Micro } from '../../components/ui'
import { useLedger } from '../../ledger/LedgerContext'
import type { View } from '../../ledger/sentry'
import { amount, cid, clock } from '../../lib/format'

interface Row {
  cid: string
  at: Date
  amount: number
  counterparty: string
  memo: string
  outcome: 'executed' | 'held' | 'rejected'
  via: string
  template: string
  reasons: string[]
  signatories: string[]
  observers: string[]
}

const VIA: Record<string, string> = {
  AutoApproved: 'auto-approved',
  OwnerApproved: 'owner approved',
  OwnerDirect: 'owner paid directly',
  AutoRejected: 'auto-rejected',
  OwnerRejected: 'owner rejected',
}

export function rows(view: View): Row[] {
  const out: Row[] = [
    ...view.executed.map((r) => ({ cid: r.cid, at: r.at, amount: r.amount, counterparty: r.counterparty, memo: r.memo, outcome: 'executed' as const, via: VIA[r.via], template: 'ExecutedTransfer', reasons: [], signatories: r.signatories, observers: r.observers })),
    ...view.pending.map((r) => ({ cid: r.cid, at: r.requestedAt, amount: r.amount, counterparty: r.counterparty, memo: r.memo, outcome: 'held' as const, via: 'waiting for the owner', template: 'PendingApproval', reasons: r.reasons, signatories: r.signatories, observers: r.observers })),
    ...view.rejected.map((r) => ({ cid: r.cid, at: r.at, amount: r.amount, counterparty: r.counterparty, memo: r.memo, outcome: 'rejected' as const, via: VIA[r.via], template: 'RejectedTransfer', reasons: r.reasons, signatories: r.signatories, observers: r.observers })),
  ]
  return out.sort((a, b) => b.at.getTime() - a.at.getTime())
}

export function LedgerTable({ view, allowed }: { view: View; allowed: string[] }) {
  const { roleOf } = useLedger()
  const [open, setOpen] = useState<string | null>(null)
  const list = rows(view)
  const seen = useRef<Set<string> | null>(null)
  const fresh = new Set(seen.current ? list.filter((r) => !seen.current!.has(r.cid)).map((r) => r.cid) : [])
  useEffect(() => {
    seen.current = new Set(list.map((r) => r.cid))
  })

  const who = (ids: string[]) => ids.map((id) => roleOf(id) ?? id.split('::')[0]).join(', ')

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Ledger</span>
        <Micro>{list.length} records</Micro>
      </div>
      <div className="panel-body" style={{ paddingTop: 12 }}>
        {list.length === 0 ? (
          <div className="empty">
            <span className="sq" aria-hidden />
            <p style={{ fontSize: 16 }}>No agent activity yet</p>
            <p className="help">Every row here is a record on the ledger.</p>
          </div>
        ) : (
          <div className="scroll-x">
            <table className="ledger">
              <thead>
                <tr>
                  <th className="amount-cell">Amount</th>
                  <th>Counterparty</th>
                  <th>Memo</th>
                  <th>Time</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const unlisted = !allowed.includes(r.counterparty)
                  const isOpen = open === r.cid
                  return (
                    <Fragment key={r.cid}>
                      <tr
                        className={`row ${fresh.has(r.cid) ? 'arrive' : ''}`}
                        onClick={() => setOpen(isOpen ? null : r.cid)}
                        aria-expanded={isOpen}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setOpen(isOpen ? null : r.cid)
                          }
                        }}
                      >
                        <td className="amount-cell">{amount(r.amount)}</td>
                        <td className={unlisted ? 'unlisted' : ''} title={r.counterparty}>
                          {r.counterparty.split('::')[0]}
                          {unlisted && <span className="help" style={{ color: 'inherit' }}> · unlisted</span>}
                        </td>
                        <td className="memo">{r.memo}</td>
                        <td className="time">{clock(r.at)}</td>
                        <td>
                          <Chip kind={r.outcome}>{r.outcome}</Chip>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="detail">
                          <td colSpan={5}>
                            <div className="detail-grid">
                              <div>
                                <span className="micro">Contract</span>
                                {r.template} <CopyText text={r.cid}>{cid(r.cid)}</CopyText>
                              </div>
                              <div>
                                <span className="micro">Signed by</span>
                                {who(r.signatories)}
                              </div>
                              <div>
                                <span className="micro">Also visible to</span>
                                {who(r.observers) || 'no observers'}
                              </div>
                              <div>
                                <span className="micro">Path</span>
                                {r.via}
                              </div>
                              <div style={{ gridColumn: 'span 2' }}>
                                <span className="micro">Reasons</span>
                                {r.reasons.length ? r.reasons.join(' · ') : 'none, every check passed'}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
