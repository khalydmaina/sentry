import { useEffect, useState } from 'react'
import { LedgerGate } from '../components/LedgerGate'
import { Banner, Micro, PartyToken } from '../components/ui'
import { NODES, NODE_NAME, NODE_PORT, type Node } from '../ledger/api'
import { useLedger } from '../ledger/LedgerContext'
import { useWallet } from '../ledger/WalletContext'
import { loadView, ledgerEndOf, ROLE_NODE, ROLES, TEMPLATE_NAMES, templateName, type Role, type View } from '../ledger/sentry'
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

/** A column on the matrix: one party, asked of the node that hosts it. */
interface Column {
  key: string
  label: string
  party: string
  node: Node
}

function PrivacyBody() {
  const { parties, offset } = useLedger()
  const { identity } = useWallet()
  const [views, setViews] = useState<Record<string, View> | null>(null)
  const [ends, setEnds] = useState<Record<Node, number> | null>(null)
  const [left, setLeft] = useState<string>('owner')
  const [right, setRight] = useState<string>('bank')

  // The demo roster, plus the connected wallet when it is not already one of
  // the demo roles. A real owner should see their own wallet here, not just
  // the six the script allocated.
  const columns: Column[] = [
    ...ROLES.map((r) => ({ key: r, label: r, party: parties?.[r] ?? '', node: ROLE_NODE[r] })),
    ...(identity && parties && !ROLES.some((r) => parties[r] === identity.partyId)
      ? [{ key: 'connected', label: identity.label, party: identity.partyId, node: 'wallet' as Node }]
      : []),
  ].filter((c) => c.party)

  const onNode = (n: Node) => columns.filter((c) => c.node === n)

  useEffect(() => {
    if (!parties || offset === null) return
    let live = true
    void (async () => {
      // Each node keeps its own offsets, so every node is asked at its own end.
      const at = Object.fromEntries(await Promise.all(NODES.map(async (n) => [n, await ledgerEndOf(n)] as const))) as Record<Node, number>
      const cols = columns
      const vs = await Promise.all(cols.map((c) => loadView(c.party, at[c.node], c.node)))
      if (!live) return
      setEnds(at)
      setViews(Object.fromEntries(cols.map((c, i) => [c.key, vs[i]])))
    })()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parties, offset, identity?.partyId])

  if (!parties || !views || !ends) {
    return (
      <div className="panel panel-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span className="blink" aria-hidden /> <span className="data body-2">Querying two participant nodes</span>
      </div>
    )
  }

  const count = (key: string, t: string) => (views[key]?.raw ?? []).filter((e) => templateName(e.templateId) === t).length
  const policySeenOffWallet = onNode('counterparty').some((c) => count(c.key, 'WalletPolicy') > 0)

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
                <th key={n} colSpan={onNode(n).length} style={{ textAlign: 'center', borderLeft: '1px solid var(--rule)' }}>
                  {NODE_NAME[n]} <span style={{ color: 'var(--mute)' }}>:{NODE_PORT[n]} · offset {ends[n]}</span>
                </th>
              ))}
            </tr>
            <tr>
              {NODES.flatMap((n) =>
                onNode(n).map((c, i) => (
                  <th key={c.key} style={i === 0 ? { borderLeft: '1px solid var(--rule)' } : undefined}>
                    {c.label}
                    {c.key === 'connected' && <span style={{ color: 'var(--signal)' }}> ·wallet</span>}
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
                  onNode(n).map((c, i) => {
                    const num = count(c.key, t)
                    const edge = i === 0 ? { borderLeft: '1px solid var(--rule)' } : undefined
                    return num ? (
                      <td key={c.key} className="yes" style={edge}>
                        ✓ {num} visible
                      </td>
                    ) : (
                      <td key={c.key} className="hatch" style={edge}>
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
        <Pane sel={left} setSel={setLeft} columns={columns} views={views} />
        <Pane sel={right} setSel={setRight} columns={columns} views={views} />
      </div>
    </>
  )
}

function Pane({ sel, setSel, columns, views }: { sel: string; setSel: (k: string) => void; columns: Column[]; views: Record<string, View> }) {
  const col = columns.find((c) => c.key === sel) ?? columns[0]
  const view = views[col.key]
  if (!view) return null
  const empty = view.raw.length === 0
  const role = (ROLES as readonly string[]).includes(col.key) ? (col.key as Role) : 'owner'
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
        <label className="micro" htmlFor={`pane-${col.key}`}>
          Ask {NODE_NAME[col.node]}:{NODE_PORT[col.node]} as
        </label>
        <select id={`pane-${col.key}`} className="select" value={col.key} onChange={(e) => setSel(e.target.value)}>
          {NODES.map((n) => (
            <optgroup key={n} label={`${NODE_NAME[n]} :${NODE_PORT[n]}`}>
              {columns
                .filter((c) => c.node === n)
                .map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                    {c.key === 'connected' ? ' (wallet)' : ''}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
      <PartyToken role={role} id={col.party} />
      <pre>{empty ? '[]' : JSON.stringify(body, null, 2)}</pre>
      <span className={empty ? 'micro' : 'micro signal'}>
        {empty ? `${NODE_NAME[col.node]} holds no contract data for this party` : `✓ ${view.raw.length} contracts on ${NODE_NAME[col.node]}`}
      </span>
    </div>
  )
}
