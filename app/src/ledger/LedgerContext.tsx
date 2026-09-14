import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ledgerEnd, LedgerError } from './api'
import { loadParties, loadView, ROLES, walletPolicy, type Parties, type Policy, type Role, type View } from './sentry'

export type LedgerStatus = 'connecting' | 'offline' | 'no-parties' | 'ready'

interface LedgerState {
  status: LedgerStatus
  parties: Parties | null
  offset: number | null
  owner: View | null
  agent: View | null
  policy: Policy | null
  roleOf: (party: string) => Role | null
  refresh: () => Promise<void>
}

const Ctx = createContext<LedgerState | null>(null)
const POLL_MS = 1000

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LedgerStatus>('connecting')
  const [parties, setParties] = useState<Parties | null>(null)
  const [offset, setOffset] = useState<number | null>(null)
  const [owner, setOwner] = useState<View | null>(null)
  const [agent, setAgent] = useState<View | null>(null)
  const seen = useRef<number | null>(null)
  const partiesRef = useRef<Parties | null>(null)
  const inFlight = useRef(false)

  const tick = useCallback(async (force = false) => {
    if (inFlight.current && !force) return
    inFlight.current = true
    try {
      const end = await ledgerEnd()
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
    <Ctx.Provider value={{ status, parties, offset, owner, agent, policy, roleOf, refresh: () => tick(true) }}>
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
