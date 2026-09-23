import { useEffect, useState } from 'react'
import { LedgerGate } from '../components/LedgerGate'
import { Banner, Micro, PartyToken } from '../components/ui'
import { NODES, NODE_NAME, NODE_PORT, type Node } from '../ledger/api'
import { useLedger } from '../ledger/LedgerContext'
import { loadView, ledgerEndOf, ROLE_NODE, ROLES, ROLES_ON, TEMPLATE_NAMES, templateName, type Role, type View } from '../ledger/sentry'
import { partyId } from '../lib/format'

export function Privacy() {
  return (
    <div className="page shell">
      <div className="page-head">
        <div>
          <Micro>Privacy · queried live · two participant nodes</Micro>
          <h1 className="h1">Who sees what, asked of each node.</h1>
        </div>
        <p className="section-note">
          The owner and the agent are hosted by one Canton participant. The bank, the merchant and everyone else are hosted by a second one. Both sit on the same
          synchronizer and settle the same transactions. Each column below is an active-contracts query put to the node that hosts that party.
        </p>
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
  const [ends, setEnds] = useState<Record<Node, number> | null>(null)
  const [left, setLeft] = useState<Role>('owner')
  const [right, setRight] = useState<Role>('bank')

  useEffect(() => {
    if (!parties || offset === null) return
    let live = true
    void (async () => {
      // Each node keeps its own offsets, so every node is asked at its own end.
      const at = Object.fromEntries(await Promise.all(NODES.map(async (n) => [n, await ledgerEndOf(n)] as const))) as Record<Node, number>
      const vs = await Promise.all(ROLES.map((r) => loadView(parties[r], at[ROLE_NODE[r]], ROLE_NODE[r])))
      if (!live) return
      setEnds(at)
      setViews(Object.fromEntries(ROLES.map((r, i) => [r, vs[i]])) as Record<Role, View>)
    })()
    return () => {
      live = false
    }
  }, [parties, offset])

  if (!parties || !views || !ends) {
    return (
      <div className="panel panel-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span className="blink" aria-hidden /> <span className="data body-2">Querying two participant nodes</span>
      </div>
    )
  }

  const count = (r: Role, t: string) => views[r].raw.filter((e) => templateName(e.templateId) === t).length
  const policySeenOffWallet = ROLES_ON.counterparty.some((r) => count(r, 'WalletPolicy') > 0)

  return (
    <>
      <Banner kind={policySeenOffWallet ? 'reject' : 'allow'} title={policySeenOffWallet ? 'The policy left the wallet node.' : 'The policy never leaves the wallet node.'}>
        {policySeenOffWallet
          ? 'A counterparty node is holding the WalletPolicy. That should not happen and is worth investigating.'
          : 'The bank minted the holding and the merchant was paid, both from the second node. Neither received the WalletPolicy: it was never delivered to that participant, not merely filtered out of its answer.'}
      </Banner>

      <div className="scroll-x">
        <table className="grid-table" style={{ minWidth: 1040 }}>
          <thead>
            <tr>
              <th rowSpan={2}>Template</th>
              {NODES.map((n) => (
                <th key={n} colSpan={ROLES_ON[n].length} style={{ textAlign: 'center', borderLeft: '1px solid var(--rule)' }}>
                  {NODE_NAME[n]} <span style={{ color: 'var(--mute)' }}>:{NODE_PORT[n]} · offset {ends[n]}</span>
                </th>
              ))}
            </tr>
            <tr>
              {NODES.flatMap((n) =>
                ROLES_ON[n].map((r, i) => (
                  <th key={r} style={i === 0 ? { borderLeft: '1px solid var(--rule)' } : undefined}>
                    {r}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {TEMPLATE_NAMES.map((t) => (
              <tr key={t}>
                <td style={{ color: 'var(--bone)' }}>{t}</td>
                {NODES.flatMap((n) =>
                  ROLES_ON[n].map((r, i) => {
                    const num = count(r, t)
                    const edge = i === 0 ? { borderLeft: '1px solid var(--rule)' } : undefined
                    return num ? (
                      <td key={r} className="yes" style={edge}>
                        ✓ {num} visible
                      </td>
                    ) : (
                      <td key={r} className="hatch" style={edge}>
                        no data
                      </td>
                    )
                  }),
                )}
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
  const node = ROLE_NODE[role]
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
          Ask {NODE_NAME[node]}:{NODE_PORT[node]} as
        </label>
        <select id={`pane-${role}`} className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {NODES.map((n) => (
            <optgroup key={n} label={`${NODE_NAME[n]} :${NODE_PORT[n]}`}>
              {ROLES_ON[n].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <PartyToken role={role} id={party} />
      <pre>{empty ? '[]' : JSON.stringify(body, null, 2)}</pre>
      <span className={empty ? 'micro' : 'micro signal'}>
        {empty ? `${NODE_NAME[node]} holds no contract data for this party` : `✓ ${view.raw.length} contracts on ${NODE_NAME[node]}`}
      </span>
    </div>
  )
}
