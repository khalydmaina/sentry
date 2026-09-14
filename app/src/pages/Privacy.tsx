import { useEffect, useState } from 'react'
import { LedgerGate } from '../components/LedgerGate'
import { Banner, Micro, PartyToken } from '../components/ui'
import { useLedger } from '../ledger/LedgerContext'
import { loadView, ROLES, TEMPLATE_NAMES, templateName, type Role, type View } from '../ledger/sentry'
import { partyId } from '../lib/format'

export function Privacy() {
  return (
    <div className="page shell">
      <div className="page-head">
        <div>
          <Micro>Privacy · queried live</Micro>
          <h1 className="h1">Who sees what, asked as each party.</h1>
        </div>
        <p className="section-note">Each column is one active-contracts query through the JSON Ledger API, made as that party at the same ledger offset. Hatched cells came back with no contract data.</p>
      </div>
      <LedgerGate>
        <PrivacyBody />
      </LedgerGate>
    </div>
  )
}

function PrivacyBody() {
  const { parties, offset } = useLedger()
  const [views, setViews] = useState<Record<Role, View> | null>(null)
  const [at, setAt] = useState<number | null>(null)
  const [left, setLeft] = useState<Role>('owner')
  const [right, setRight] = useState<Role>('outsider')

  useEffect(() => {
    if (!parties || offset === null) return
    let live = true
    void Promise.all(ROLES.map((r) => loadView(parties[r], offset))).then((vs) => {
      if (!live) return
      setViews(Object.fromEntries(ROLES.map((r, i) => [r, vs[i]])) as Record<Role, View>)
      setAt(offset)
    })
    return () => {
      live = false
    }
  }, [parties, offset])

  if (!parties || !views) {
    return (
      <div className="panel panel-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span className="blink" aria-hidden /> <span className="data body-2">Querying as six parties</span>
      </div>
    )
  }

  const count = (r: Role, t: string) => views[r].raw.filter((e) => templateName(e.templateId) === t).length

  return (
    <>
      <Banner kind="info" title="What this does and does not show.">
        All six parties are hosted on one sandbox node, so this is the ledger API’s per-party view. On a Canton network, a party’s node does not receive contract data
        from transactions it is not part of.
      </Banner>

      <div className="scroll-x">
        <table className="grid-table" style={{ minWidth: 960 }}>
          <thead>
            <tr>
              <th>
                Template <span style={{ color: 'var(--mute)' }}>· offset {at}</span>
              </th>
              {ROLES.map((r) => (
                <th key={r}>{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TEMPLATE_NAMES.map((t) => (
              <tr key={t}>
                <td style={{ color: 'var(--bone)' }}>{t}</td>
                {ROLES.map((r) => {
                  const n = count(r, t)
                  return n ? (
                    <td key={r} className="yes">
                      ✓ {n} visible
                    </td>
                  ) : (
                    <td key={r} className="hatch">
                      no data
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="views">
        <Pane role={left} setRole={setLeft} view={views[left]} party={parties[left]} />
        <Pane role={right} setRole={setRight} view={views[right]} party={parties[right]} />
      </div>
    </>
  )
}

function Pane({ role, setRole, view, party }: { role: Role; setRole: (r: Role) => void; view: View; party: string }) {
  const empty = view.raw.length === 0
  const body = view.raw.map((e) => ({
    template: templateName(e.templateId),
    contractId: `${e.contractId.slice(0, 8)}…`,
    createArgument: Object.fromEntries(
      Object.entries(e.createArgument).map(([k, v]) => [k, typeof v === 'string' && v.includes('::') ? partyId(v) : Array.isArray(v) ? v.map((x) => (typeof x === 'string' && x.includes('::') ? partyId(x) : x)) : v]),
    ),
  }))
  return (
    <div className={`view-pane ${empty ? 'empty-view' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label className="micro" htmlFor={`pane-${role}`}>
          Query as
        </label>
        <select id={`pane-${role}`} className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <PartyToken role={role} id={party} />
      <pre>{empty ? '[]' : JSON.stringify(body, null, 2)}</pre>
      <span className={empty ? 'micro' : 'micro signal'}>{empty ? 'no contract data for this party' : `✓ ${view.raw.length} contracts visible`}</span>
    </div>
  )
}
