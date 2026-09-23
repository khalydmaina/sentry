import { useState } from 'react'
import { AmountField, Button, Chip, Micro, PartyToken } from '../../components/ui'
import { useLedger } from '../../ledger/LedgerContext'
import { useWallet } from '../../ledger/WalletContext'
import { mintHolding, signPolicy, type Role } from '../../ledger/sentry'
import { COUNTERPARTY_ROLES, NoticeBanner, parseAmount, WINDOWS, type Notice } from './shared'

type Step = 'idle' | 'flight' | 'done'

export function CreateWallet() {
  const { parties, refresh } = useLedger()
  // A connected wallet signs the policy itself; otherwise the sandbox's demo user does.
  const { identity } = useWallet()
  const [balance, setBalance] = useState('1000.00')
  const [perTx, setPerTx] = useState('200.00')
  const [daily, setDaily] = useState('300.00')
  const [threshold, setThreshold] = useState('50.00')
  const [windowMs, setWindowMs] = useState(120_000)
  const [allowed, setAllowed] = useState<Role[]>(['merchant'])
  const [steps, setSteps] = useState<[Step, Step]>(['idle', 'idle'])
  const [notice, setNotice] = useState<Notice | null>(null)
  if (!parties) return null

  const values = { balance: parseAmount(balance), perTx: parseAmount(perTx), daily: parseAmount(daily), threshold: parseAmount(threshold) }
  const err = (v: number | null, positive = false) => (v === null ? 'Not a number.' : positive ? (v <= 0 ? 'Must be above 0.00.' : undefined) : v < 0 ? 'Cannot be negative.' : undefined)
  const errors = { balance: err(values.balance, true), perTx: err(values.perTx), daily: err(values.daily), threshold: err(values.threshold) }
  const valid = !Object.values(errors).some(Boolean)
  const busy = steps.includes('flight')

  async function create() {
    if (!parties || !valid) return
    setNotice(null)
    try {
      setSteps(['flight', 'idle'])
      const holding = await mintHolding(parties, values.balance!)
      setSteps(['done', 'flight'])
      await signPolicy(
        parties,
        holding,
        {
          startingBalance: values.balance!,
          perTxCap: values.perTx!,
          dailyCap: values.daily!,
          autoApproveThreshold: values.threshold!,
          windowMs,
          allowed: allowed.map((r) => parties[r]),
        },
        identity?.submit,
      )
      setSteps(['done', 'done'])
      await refresh()
    } catch (e) {
      setSteps(['idle', 'idle'])
      setNotice({ kind: 'error', error: e })
    }
  }

  const stepChip = (s: Step) => (s === 'done' ? <Chip kind="executed">Created</Chip> : s === 'flight' ? <Chip kind="flight">In flight</Chip> : <Chip kind="quiet">Waiting</Chip>)

  return (
    <div className="page shell">
      <div className="page-head">
        <div>
          <Micro>Desk · no wallet on this ledger yet</Micro>
          <h1 className="h1">Create the wallet.</h1>
        </div>
        <p className="section-note">Two transactions, two signers. Bank issues the holding, then the owner signs the policy that delegates to the agent.</p>
      </div>

      {notice && <NoticeBanner notice={notice} />}

      <div className="create">
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">
              <span className="step-num">01</span> Bank mints the holding
            </span>
            {stepChip(steps[0])}
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <AmountField id="balance" label="Starting balance" value={balance} onChange={setBalance} error={errors.balance} help="WalletHolding.amount. Bank-issued units, not Canton Coin." />
            <dl className="kv" style={{ margin: 0 }}>
              <dt>signed by</dt>
              <dd>
                <PartyToken role="bank" id={parties.bank} compact />
              </dd>
              <dt>visible to</dt>
              <dd style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <PartyToken role="owner" id={parties.owner} compact />
                <PartyToken role="agent" id={parties.agent} compact />
              </dd>
            </dl>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">
              <span className="step-num">02</span> Owner signs the policy
            </span>
            {stepChip(steps[1])}
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="form-grid">
              <AmountField id="pertx" label="Per-transaction cap" value={perTx} onChange={setPerTx} error={errors.perTx} />
              <AmountField id="daily" label="Rolling cap" value={daily} onChange={setDaily} error={errors.daily} help="dailyCap, summed over the window below" />
              <AmountField id="threshold" label="Auto-approve at or under" value={threshold} onChange={setThreshold} error={errors.threshold} />
              <div className="field">
                <label className="micro" htmlFor="window">
                  Rolling window
                </label>
                <select id="window" className="select" value={windowMs} onChange={(e) => setWindowMs(Number(e.target.value))}>
                  {WINDOWS.map((w) => (
                    <option key={w.ms} value={w.ms}>
                      {w.label}
                    </option>
                  ))}
                </select>
                <div className="help">Short windows let the demo show spends rolling off.</div>
              </div>
              <div className="field span">
                <span className="micro">Allowlist</span>
                <div className="party-picker">
                  {COUNTERPARTY_ROLES.map((r) => (
                    <PartyToken
                      key={r}
                      role={r}
                      id={parties[r]}
                      compact
                      showRole={false}
                      pressed={allowed.includes(r)}
                      onClick={() => setAllowed((a) => (a.includes(r) ? a.filter((x) => x !== r) : [...a, r]))}
                    />
                  ))}
                </div>
                <div className="help">Anyone not selected can still be paid, but only after the owner approves.</div>
              </div>
            </div>
            <dl className="kv" style={{ margin: 0 }}>
              <dt>signed by</dt>
              <dd>
                <PartyToken role="owner" id={parties.owner} compact />
              </dd>
              <dt>visible to</dt>
              <dd>
                <PartyToken role="agent" id={parties.agent} compact />
              </dd>
            </dl>
          </div>
        </section>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" onClick={create} disabled={!valid} busy={busy} busyLabel={steps[0] === 'flight' ? 'Minting' : 'Signing'}>
          Mint and sign
        </Button>
      </div>
    </div>
  )
}
