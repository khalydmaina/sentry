import { useState } from 'react'
import { AmountField, Button, Chip, CopyText, Meter, Micro, PartyToken, type ChipKind } from '../../components/ui'
import { LedgerError } from '../../ledger/api'
import { useLedger, useNow } from '../../ledger/LedgerContext'
import {
  ATTEMPTS,
  isStale,
  loadView,
  preview,
  refusalText,
  requestTransfer,
  walletPolicy,
  windowTotal,
  type Outcome,
  type Policy,
  type Role,
} from '../../ledger/sentry'
import { amount, cid, windowLabel } from '../../lib/format'
import { COUNTERPARTY_ROLES, NoticeBanner, parseAmount, SeatHead, type Notice } from './shared'

const round2 = (n: number) => Math.floor(n * 100) / 100

export function AgentSeat({ policy, balance, onOutcome }: { policy: Policy; balance: number; onOutcome: (n: Notice) => void }) {
  const { parties, agent, refresh, ownerParty } = useLedger()
  const now = useNow()
  const [to, setTo] = useState<Role>('merchant')
  const [qty, setQty] = useState('40.00')
  const [memo, setMemo] = useState('api credits')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [race, setRace] = useState<Lane[] | null>(null)
  const [attempts, setAttempts] = useState<Record<string, { code: string; text: string } | 'flight'>>({})
  if (!parties || !agent) return null

  const agentPolicy = walletPolicy(agent, ownerParty!, parties.agent) ?? policy
  const value = parseAmount(qty)
  const counterparty = parties[to]
  const check = value === null ? null : preview(agentPolicy, balance, value, counterparty, now)
  const firstListed = COUNTERPARTY_ROLES.find((r) => agentPolicy.allowed.includes(parties[r]))
  const firstUnlisted = COUNTERPARTY_ROLES.find((r) => !agentPolicy.allowed.includes(parties[r]))

  async function submit(key: string, amt: number, role: Role, note: string) {
    setBusy(key)
    setNotice(null)
    setTo(role)
    setQty(amt.toFixed(2))
    setMemo(note)
    try {
      const fresh = walletPolicy(await loadView(parties!.agent), ownerParty!, parties!.agent)
      if (!fresh) throw new LedgerError(404, 'NO_POLICY', 'The agent sees no live WalletPolicy.')
      const o = await requestTransfer(parties!, fresh.cid, amt, parties![role], note)
      const n: Notice = o ? { kind: 'outcome', outcome: o, actor: 'agent' } : { kind: 'text', tone: 'info', title: 'Submitted.' }
      setNotice(n)
      onOutcome(n)
    } catch (error) {
      setNotice({ kind: 'error', error })
      onOutcome({ kind: 'error', error })
    } finally {
      setBusy(null)
      await refresh()
    }
  }

  async function runRace() {
    if (!firstListed) return
    const amt = Math.max(0.01, round2(Math.min(agentPolicy.autoApproveThreshold, agentPolicy.perTxCap) / 2))
    setBusy('race')
    setNotice(null)
    setRace([{ status: 'flight' }, { status: 'flight' }])
    const start = walletPolicy(await loadView(parties!.agent), ownerParty!, parties!.agent)
    if (!start) {
      setBusy(null)
      return
    }
    const lane = async (i: number) => {
      const update = (l: Lane) => setRace((r) => (r ? r.map((x, j) => (j === i ? l : x)) : r))
      try {
        const o = await requestTransfer(parties!, start.cid, amt, parties![firstListed], `race ${i === 0 ? 'A' : 'B'}`)
        update({ status: 'done', outcome: o, policyCid: start.cid })
      } catch (error) {
        if (!isStale(error)) return update({ status: 'refused', error })
        update({ status: 'stale', policyCid: start.cid, code: error instanceof LedgerError ? error.code : '' })
        const retryPolicy = walletPolicy(await loadView(parties!.agent), ownerParty!, parties!.agent)
        try {
          const o = await requestTransfer(parties!, retryPolicy!.cid, amt, parties![firstListed], `race ${i === 0 ? 'A' : 'B'} retry`)
          update({ status: 'retried', outcome: o, policyCid: start.cid, retryCid: retryPolicy!.cid, code: error instanceof LedgerError ? error.code : '' })
        } catch (e2) {
          update({ status: 'refused', error: e2 })
        }
      }
    }
    await Promise.all([lane(0), lane(1)])
    setBusy(null)
    await refresh()
  }

  async function attempt(id: string) {
    const a = ATTEMPTS.find((x) => x.id === id)!
    setAttempts((s) => ({ ...s, [id]: 'flight' }))
    const once = async () => {
      const view = await loadView(parties!.agent)
      await a.run(parties!, walletPolicy(view, ownerParty!, parties!.agent) ?? agentPolicy, view.pending[0])
    }
    try {
      // A spend elsewhere can replace the policy mid-attempt. Retry once so the
      // refusal shown is about authority, not a stale contract id.
      await once().catch((e) => (isStale(e) ? once() : Promise.reject(e)))
      setAttempts((s) => ({ ...s, [id]: { code: 'ACCEPTED', text: 'The ledger accepted this. That would be a bug.' } }))
    } catch (error) {
      setAttempts((s) => ({ ...s, [id]: { code: error instanceof LedgerError ? error.code : 'ERROR', text: refusalText(error) } }))
    }
  }

  const total = windowTotal(agentPolicy, now)
  const live = agentPolicy.recentSpends.filter((s) => now - s.at.getTime() < agentPolicy.windowMs)
  const nextRelease = live.length ? Math.min(...live.map((s) => s.at.getTime() + agentPolicy.windowMs)) - now : null

  const scenarios: Array<{ key: string; name: string; amt: number; role?: Role; note: string; disabled?: string }> = [
    {
      key: 'under',
      name: 'At the threshold',
      amt: round2(Math.min(agentPolicy.autoApproveThreshold, agentPolicy.perTxCap)),
      role: firstListed,
      note: 'under threshold',
      disabled: !firstListed ? 'Allowlist is empty' : agentPolicy.autoApproveThreshold <= 0 ? 'Threshold is 0.00' : undefined,
    },
    {
      key: 'over',
      name: 'Above the threshold',
      amt: round2(agentPolicy.autoApproveThreshold + Math.max(1, agentPolicy.autoApproveThreshold)),
      role: firstListed,
      note: 'above threshold',
      disabled: !firstListed ? 'Allowlist is empty' : undefined,
    },
    { key: 'unlisted', name: 'Unlisted counterparty', amt: 10, role: firstUnlisted, note: 'unlisted', disabled: !firstUnlisted ? 'Everyone is allowlisted' : undefined },
    { key: 'balance', name: 'More than the balance', amt: round2(balance + 100), role: firstListed ?? 'merchant', note: 'over balance' },
    { key: 'zero', name: 'Zero amount', amt: 0, role: firstListed ?? 'merchant', note: 'zero' },
  ]

  const expectChip = (e: string): { kind: ChipKind; label: string } =>
    e === 'executed' ? { kind: 'executed', label: 'Executed' } : e === 'held' ? { kind: 'held', label: 'Held' } : e === 'rejected' ? { kind: 'rejected', label: 'Rejected' } : { kind: 'refused', label: 'Refused' }

  return (
    <div className="seat">
      <SeatHead title="Agent seat">
        <PartyToken role="agent" id={parties.agent} showRole={false} />
      </SeatHead>

      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">WalletPolicy</span>
          <Micro>
            <CopyText text={agentPolicy.cid}>{cid(agentPolicy.cid)}</CopyText>
          </Micro>
        </div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <dl className="kv" style={{ margin: 0 }}>
            <dt>per-tx cap</dt>
            <dd>{amount(agentPolicy.perTxCap)}</dd>
            <dt>rolling cap</dt>
            <dd>
              {amount(agentPolicy.dailyCap)} / {windowLabel(agentPolicy.windowMs)}
            </dd>
            <dt>auto-approve ≤</dt>
            <dd>{amount(agentPolicy.autoApproveThreshold)}</dd>
            <dt>allowlist</dt>
            <dd>{agentPolicy.allowed.length ? agentPolicy.allowed.map((p) => p.split('::')[0]).join(', ') : 'empty'}</dd>
          </dl>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span className="micro">Window used</span>
              <span className="help num">
                {amount(total)} / {amount(agentPolicy.dailyCap)}
              </span>
            </div>
            <Meter value={total} max={agentPolicy.dailyCap} />
            <span className="help">{nextRelease !== null ? `Oldest spend rolls off in ${Math.max(0, Math.ceil(nextRelease / 1000))}s` : `Nothing spent in the last ${windowLabel(agentPolicy.windowMs)}`}</span>
          </div>
        </div>
        <div className="panel-body rule-top help">signed by owner · visible to agent · read here as the agent</div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">RequestTransfer</span>
          <Micro>the agent’s only choice</Micro>
        </div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <span className="micro">Counterparty</span>
            <div className="party-picker">
              {COUNTERPARTY_ROLES.map((r) => (
                <PartyToken key={r} role={r} id={parties[r]} compact showRole={false} pressed={to === r} onClick={() => setTo(r)} />
              ))}
            </div>
          </div>
          <AmountField
            id="agent-amount"
            label="Amount"
            value={qty}
            onChange={setQty}
            error={value === null ? 'Not a number.' : undefined}
            help={`Balance ${amount(balance)} · window ${amount(total)} / ${amount(agentPolicy.dailyCap)}`}
          />
          <div className="field">
            <label className="micro" htmlFor="agent-memo">
              Memo
            </label>
            <input id="agent-memo" className="text-input" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          {check && (
            <div className="checks" aria-live="polite">
              {!check.positive ? (
                <span className="bad">amount must be positive</span>
              ) : (
                <>
                  <span className={check.funded ? 'ok' : 'bad'}>{check.funded ? 'within balance' : 'insufficient balance'}</span>
                  <span className={check.listed ? 'ok' : 'fail'}>{check.listed ? 'counterparty allowlisted' : 'counterparty not allowlisted'}</span>
                  <span className={check.underPerTx ? 'ok' : 'fail'}>{check.underPerTx ? 'within per-tx cap' : 'exceeds per-transaction cap'}</span>
                  <span className={check.underWindow ? 'ok' : 'fail'}>{check.underWindow ? 'within rolling cap' : 'exceeds daily cap'}</span>
                  <span className={check.underThreshold ? 'ok' : 'fail'}>{check.underThreshold ? 'at or under auto-approve' : 'above auto-approve threshold'}</span>
                </>
              )}
              <span className="expect">
                Preview <Chip kind={expectChip(check.expect).kind}>{expectChip(check.expect).label}</Chip> <span className="help">the ledger decides</span>
              </span>
            </div>
          )}
          <Button variant="primary" busy={busy === 'manual'} disabled={value === null || Boolean(busy)} onClick={() => submit('manual', value!, to, memo)}>
            Submit as agent
          </Button>
          {notice && <NoticeBanner notice={notice} />}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">Scenarios</span>
          <Micro>each one submits</Micro>
        </div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="scenarios">
            {scenarios.map((s) => {
              const e = s.role ? preview(agentPolicy, balance, s.amt, parties[s.role], now).expect : 'refused'
              const chip = expectChip(e)
              return (
                <button key={s.key} className="scenario" disabled={Boolean(s.disabled) || Boolean(busy)} onClick={() => s.role && submit(s.key, s.amt, s.role, s.note)}>
                  <span className="name">{s.name}</span>
                  <span className="expect">
                    {s.disabled ?? `${amount(s.amt)} → ${s.role ? parties[s.role].split('::')[0] : ''}`}
                  </span>
                  {!s.disabled && (
                    <span className="help">
                      {busy === s.key ? <Chip kind="flight">In flight</Chip> : <>expect <Chip kind={chip.kind}>{chip.label}</Chip></>}
                    </span>
                  )}
                </button>
              )
            })}
            <button className="scenario" disabled={!firstListed || Boolean(busy)} onClick={runRace}>
              <span className="name">Two at once</span>
              <span className="expect">{firstListed ? 'same policy id, sent together' : 'Allowlist is empty'}</span>
              <span className="help">{busy === 'race' ? <Chip kind="flight">In flight</Chip> : <>expect <Chip kind="stale">One goes stale</Chip></>}</span>
            </button>
          </div>
          {race && <Race lanes={race} />}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">Other paths the agent might try</span>
        </div>
        <div className="panel-body">
          <p className="help" style={{ margin: '0 0 8px' }}>
            Each button sends the command to the ledger as the agent. Nothing is checked in this app first.
          </p>
          <div className="attempts">
            {ATTEMPTS.map((a) => {
              const r = attempts[a.id]
              const blocked = a.needsPending && agent.pending.length === 0
              return (
                <div className="attempt" key={a.id}>
                  <div>
                    <div className="what">{a.what}</div>
                    <div className="help">{a.choice}</div>
                  </div>
                  <Button small disabled={blocked || r === 'flight'} busy={r === 'flight'} busyLabel="Sending" onClick={() => attempt(a.id)}>
                    Try it
                  </Button>
                  {blocked && <div className="why">Needs a held request first. Try “Above the threshold”.</div>}
                  {r && r !== 'flight' && (
                    <div className="why">
                      <Chip kind={r.code === 'ACCEPTED' ? 'executed' : 'refused'}>{r.code === 'ACCEPTED' ? 'Accepted' : 'Refused'}</Chip> <b>{r.code}</b> {r.text}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}

type Lane =
  | { status: 'flight' }
  | { status: 'done'; outcome: Outcome | null; policyCid: string }
  | { status: 'stale'; policyCid: string; code: string }
  | { status: 'retried'; outcome: Outcome | null; policyCid: string; retryCid: string; code: string }
  | { status: 'refused'; error: unknown }

function Race({ lanes }: { lanes: Lane[] }) {
  const chipFor = (o: Outcome | null) =>
    !o ? <Chip kind="quiet">No record</Chip> : o.kind === 'executed' ? <Chip kind="executed">Executed</Chip> : o.kind === 'held' ? <Chip kind="held">Held</Chip> : <Chip kind="rejected">Rejected</Chip>
  return (
    <div className="lanes" aria-live="polite">
      {lanes.map((l, i) => (
        <div className="lane" key={i}>
          <Micro>Request {i === 0 ? 'A' : 'B'}</Micro>
          {l.status === 'flight' && <Chip kind="flight">In flight</Chip>}
          {l.status === 'done' && (
            <>
              {chipFor(l.outcome)}
              <span>committed first against {cid(l.policyCid)}</span>
            </>
          )}
          {(l.status === 'stale' || l.status === 'retried') && (
            <>
              <Chip kind="stale">Stale · resubmit</Chip>
              <span>
                {l.code || 'refused'}: {cid(l.policyCid)} was already replaced
              </span>
            </>
          )}
          {l.status === 'stale' && <Chip kind="flight">Resubmitting</Chip>}
          {l.status === 'retried' && (
            <>
              {chipFor(l.outcome)}
              <span>resubmitted against {cid(l.retryCid)}</span>
            </>
          )}
          {l.status === 'refused' && <NoticeBanner notice={{ kind: 'error', error: l.error }} />}
        </div>
      ))}
    </div>
  )
}
