import { useState } from 'react'
import { AmountField, Button, Micro, PartyToken } from '../../components/ui'
import { useLedger } from '../../ledger/LedgerContext'
import { useWallet } from '../../ledger/WalletContext'
import { approve, ownerTransfer, reject, updatePolicy, type Parties, type Policy, type Role } from '../../ledger/sentry'
import { amount, clock } from '../../lib/format'
import { LedgerTable } from './LedgerTable'
import { COUNTERPARTY_ROLES, NoticeBanner, parseAmount, SeatHead, WINDOWS, type Notice } from './shared'

export function OwnerSeat({ policy, onOutcome }: { policy: Policy; onOutcome: (n: Notice) => void }) {
  const { parties, owner, refresh, roleOf, ownerParty } = useLedger()
  const { identity } = useWallet()
  const [drawer, setDrawer] = useState<'edit' | 'pay' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  if (!parties || !owner) return null

  async function act(key: string, fn: () => Promise<Notice>) {
    setBusy(key)
    setNotice(null)
    try {
      const n = await fn()
      setNotice(n)
      onOutcome(n)
    } catch (error) {
      setNotice({ kind: 'error', error })
    } finally {
      setBusy(null)
      await refresh()
    }
  }

  const held = [...owner.pending].sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime())

  return (
    <div className="seat">
      <SeatHead title="Owner seat">
        <PartyToken role="owner" id={ownerParty ?? parties.owner} showRole={false} />
      </SeatHead>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button small onClick={() => setDrawer(drawer === 'edit' ? null : 'edit')} aria-expanded={drawer === 'edit'}>
          Edit policy
        </Button>
        <Button small onClick={() => setDrawer(drawer === 'pay' ? null : 'pay')} aria-expanded={drawer === 'pay'}>
          Pay directly
        </Button>
      </div>

      {drawer === 'edit' && (
        <EditPolicy
          policy={policy}
          onDone={(n) => {
            setDrawer(null)
            setNotice(n)
            void refresh()
          }}
        />
      )}
      {drawer === 'pay' && (
        <PayDirect
          parties={parties}
          onSubmit={(to, qty, memo) =>
            act('pay', async () => {
              const o = await ownerTransfer(parties, to, qty, memo, identity?.submit, ownerParty ?? undefined)
              setDrawer(null)
              return o ? { kind: 'outcome', outcome: o, actor: 'owner' } : { kind: 'text', tone: 'info', title: 'Submitted.' }
            })
          }
          busy={busy === 'pay'}
        />
      )}

      {notice && <NoticeBanner notice={notice} />}

      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">Held for your sign-off</span>
          <Micro tone={held.length ? 'escalate' : undefined}>{held.length} held</Micro>
        </div>
        <div className="panel-body">
          {held.length === 0 ? (
            <div className="empty">
              <span className="sq" aria-hidden />
              <p style={{ fontSize: 16 }}>Nothing held</p>
              <p className="help">Requests above the threshold, over a cap, or to an unlisted counterparty wait here.</p>
            </div>
          ) : (
            <div className="held-list">
              {held.map((p) => {
                const unlisted = !policy.allowed.includes(p.counterparty)
                return (
                  <article className="held-item" key={p.cid}>
                    <div>
                      <div className="amt">{amount(p.amount)}</div>
                      <div className="meta">
                        <span className={unlisted ? 'unlisted' : ''} title={p.counterparty}>
                          to {p.counterparty.split('::')[0]}
                          {roleOf(p.counterparty) ? ` · ${roleOf(p.counterparty)}` : ''}
                        </span>
                        <span>requested {clock(p.requestedAt)}</span>
                        {p.memo && <span>memo “{p.memo}”</span>}
                      </div>
                    </div>
                    <div className="actions">
                      <Button
                        variant="primary"
                        small
                        busy={busy === `approve:${p.cid}`}
                        disabled={Boolean(busy)}
                        onClick={() =>
                          act(`approve:${p.cid}`, async () => {
                            const o = await approve(parties, p.cid, identity?.submit, ownerParty ?? undefined)
                            return o ? { kind: 'outcome', outcome: o, actor: 'owner' } : { kind: 'text', tone: 'info', title: 'Submitted.' }
                          })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        small
                        variant="danger"
                        busy={busy === `reject:${p.cid}`}
                        disabled={Boolean(busy)}
                        onClick={() =>
                          act(`reject:${p.cid}`, async () => {
                            const o = await reject(parties, p.cid, identity?.submit, ownerParty ?? undefined)
                            return o ? { kind: 'outcome', outcome: o, actor: 'owner' } : { kind: 'text', tone: 'info', title: 'Submitted.' }
                          })
                        }
                      >
                        Reject
                      </Button>
                    </div>
                    <div className="reasons">
                      {p.reasons.map((r) => (
                        <span key={r}>{r}</span>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <LedgerTable view={owner} allowed={policy.allowed} />
    </div>
  )
}

function EditPolicy({ policy, onDone }: { policy: Policy; onDone: (n: Notice) => void }) {
  const { parties, roleOf, ownerParty } = useLedger()
  const { identity } = useWallet()
  const [perTx, setPerTx] = useState(policy.perTxCap.toFixed(2))
  const [daily, setDaily] = useState(policy.dailyCap.toFixed(2))
  const [threshold, setThreshold] = useState(policy.autoApproveThreshold.toFixed(2))
  const [windowMs, setWindowMs] = useState(policy.windowMs)
  const [allowed, setAllowed] = useState<string[]>(policy.allowed)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  if (!parties) return null

  const v = { perTx: parseAmount(perTx), daily: parseAmount(daily), threshold: parseAmount(threshold) }
  const err = (n: number | null) => (n === null ? 'Not a number.' : n < 0 ? 'Cannot be negative.' : undefined)
  const errors = { perTx: err(v.perTx), daily: err(v.daily), threshold: err(v.threshold) }
  const valid = !Object.values(errors).some(Boolean)
  const windows = WINDOWS.some((w) => w.ms === policy.windowMs) ? WINDOWS : [...WINDOWS, { ms: policy.windowMs, label: `${policy.windowMs / 1000}s` }]

  async function save() {
    setBusy(true)
    setNotice(null)
    try {
      await updatePolicy(parties!, { perTxCap: v.perTx!, dailyCap: v.daily!, autoApproveThreshold: v.threshold!, windowMs, allowed }, identity?.submit, ownerParty ?? undefined)
      onDone({ kind: 'text', tone: 'allow', title: 'Policy updated.', body: 'UpdatePolicy replaced the WalletPolicy contract. The rolling window history carries over.' })
    } catch (error) {
      setNotice({ kind: 'error', error })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="drawer panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Micro>UpdatePolicy</Micro>
      {notice && <NoticeBanner notice={notice} />}
      <div className="form-grid">
        <AmountField id="e-pertx" label="Per-transaction cap" value={perTx} onChange={setPerTx} error={errors.perTx} />
        <AmountField id="e-daily" label="Rolling cap" value={daily} onChange={setDaily} error={errors.daily} />
        <AmountField id="e-threshold" label="Auto-approve at or under" value={threshold} onChange={setThreshold} error={errors.threshold} />
        <div className="field">
          <label className="micro" htmlFor="e-window">
            Rolling window
          </label>
          <select id="e-window" className="select" value={windowMs} onChange={(e) => setWindowMs(Number(e.target.value))}>
            {windows.map((w) => (
              <option key={w.ms} value={w.ms}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field span">
          <span className="micro">Allowlist</span>
          <div className="party-picker">
            {COUNTERPARTY_ROLES.map((r) => {
              const id = parties[r]
              return (
                <PartyToken
                  key={r}
                  role={roleOf(id)}
                  id={id}
                  compact
                  showRole={false}
                  pressed={allowed.includes(id)}
                  onClick={() => setAllowed((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))}
                />
              )
            })}
          </div>
        </div>
      </div>
      <div>
        <Button variant="primary" disabled={!valid} busy={busy} busyLabel="Signing" onClick={save}>
          Sign update
        </Button>
      </div>
    </div>
  )
}

function PayDirect({ parties, onSubmit, busy }: { parties: Parties; onSubmit: (to: string, qty: number, memo: string) => void; busy: boolean }) {
  const [to, setTo] = useState<Role>('stranger')
  const [qty, setQty] = useState('25.00')
  const [memo, setMemo] = useState('owner payment')
  const value = parseAmount(qty)
  const error = value === null ? 'Not a number.' : value <= 0 ? 'Must be above 0.00.' : undefined
  return (
    <div className="drawer panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Micro>OwnerTransfer</Micro>
        <p className="help" style={{ margin: '6px 0 0' }}>
          The caps bound the agent, not the owner. This skips every check except the balance and is not counted in the agent’s rolling window.
        </p>
      </div>
      <div className="party-picker">
        {COUNTERPARTY_ROLES.map((r) => (
          <PartyToken key={r} role={r} id={parties[r]} compact showRole={false} pressed={to === r} onClick={() => setTo(r)} />
        ))}
      </div>
      <div className="form-grid">
        <AmountField id="owner-qty" label="Amount" value={qty} onChange={setQty} error={error} />
        <div className="field">
          <label className="micro" htmlFor="owner-memo">
            Memo
          </label>
          <input id="owner-memo" className="text-input" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
      </div>
      <div>
        <Button variant="primary" disabled={Boolean(error)} busy={busy} onClick={() => onSubmit(parties[to], value!, memo)}>
          Pay as owner
        </Button>
      </div>
    </div>
  )
}
