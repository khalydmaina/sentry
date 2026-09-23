import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ledgerEnd, LedgerError, NODES, type Node } from './api'
import { loadParties, loadView, ROLES, walletPolicy, type Parties, type Policy, type Role, type View } from './sentry'

export type LedgerStatus = 'connecting' | 'offline' | 'no-parties' | 'ready'

interface LedgerState {
  status: LedgerStatus
  parties: Parties | null
  /** The wallet node's offset. Kept for pages that only read that node. */
  offset: number | null
  /** Every participant's own offset. They advance independently. */
  offsets: Record<Node, number | null>
  owner: View | null
  agent: View | null
  policy: Policy | null
  roleOf: (party: string) => Role | null
  refresh: () => Promise<void>
}

const NO_OFFSETS = Object.fromEntries(NODES.map((n) => [n, null])) as Record<Node, number | null>

const Ctx = createContext<LedgerState | null>(null)
const POLL_MS = 1000

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LedgerStatus>('connecting')
  const [parties, setParties] = useState<Parties | null>(null)
  const [offset, setOffset] = useState<number | null>(null)
  const [offsets, setOffsets] = useState<Record<Node, number | null>>(NO_OFFSETS)
  const [owner, setOwner] = useState<View | null>(null)
  const [agent, setAgent] = useState<View | null>(null)
  const seen = useRef<number | null>(null)
  const partiesRef = useRef<Parties | null>(null)
  const inFlight = useRef(false)

  const tick = useCallback(async (force = false) => {
    if (inFlight.current && !force) return
    inFlight.current = true
    try {
      // Every participant is asked for its own end. The wallet node decides
      // whether we are connected at all; a counterparty node that is down
      // shows as a missing offset rather than taking the whole page offline.
      const ends = await Promise.all(NODES.map(async (n) => [n, await ledgerEnd(n).catch(() => null)] as const))
      setOffsets(Object.fromEntries(ends) as Record<Node, number | null>)
      const end = ends.find(([n]) => n === 'wallet')?.[1]
      if (end === null || end === undefined) throw new LedgerError(0, 'LEDGER_UNREACHABLE', 'The wallet node did not answer.')
      let p = partiesRef.current
      if (!p) {
        try {
          p = await loadParties()
          partiesRef.current = p
          setParties(p)
        } catch (err) {
          if (err instanceof LedgerError && err.code !== 'LEDGER_UNREACHABLE') {
            setStatus('no-parties')
            return
          }
          throw err
        }
      }
      if (force || seen.current !== end) {
        const [o, a] = await Promise.all([loadView(p.owner, end), loadView(p.agent, end)])
        seen.current = end
        setOffset(end)
        setOwner(o)
        setAgent(a)
      }
      setStatus('ready')
    } catch {
      setStatus('offline')
      setOffsets(NO_OFFSETS)
      partiesRef.current = null
      seen.current = null
    } finally {
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    void tick()
    const id = setInterval(() => void tick(), POLL_MS)
    return () => clearInterval(id)
  }, [tick])

  const roleOf = useCallback(
    (party: string) => (parties ? (ROLES.find((r) => parties[r] === party) ?? null) : null),
    [parties],
  )

  const policy = owner && parties ? walletPolicy(owner, parties) : null

  return (
    <Ctx.Provider value={{ status, parties, offset, offsets, owner, agent, policy, roleOf, refresh: () => tick(true) }}>
      {children}
    </Ctx.Provider>
  )
}

export function useLedger(): LedgerState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLedger outside LedgerProvider')
  return v
}

/** Re-renders once a second for countdowns against the rolling window. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}
