import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { partyKnown } from './api'
import { connectWallet, disconnectWallet, discoverProviders, WalletError, type Identity, type ProviderDetail } from './identity'

export type WalletStatus = 'none' | 'available' | 'connecting' | 'connected' | 'error'

interface WalletState {
  status: WalletStatus
  /** CIP-0103 wallets that answered the discovery request. */
  providers: ProviderDetail[]
  identity: Identity | null
  error: string | null
  connect: (detail: ProviderDetail) => Promise<void>
  disconnect: () => Promise<void>
}

const Ctx = createContext<WalletState | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [providers, setProviders] = useState<ProviderDetail[]>([])
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [status, setStatus] = useState<WalletStatus>('none')
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<ProviderDetail | null>(null)

  useEffect(() => {
    let live = true
    void discoverProviders().then((found) => {
      if (!live) return
      setProviders(found)
      setStatus((s) => (s === 'none' && found.length ? 'available' : s))
    })
    return () => {
      live = false
    }
  }, [])

  const connect = useCallback(async (detail: ProviderDetail) => {
    setStatus('connecting')
    setError(null)
    try {
      const id = await connectWallet(detail)

      // A wallet on another network connects perfectly well and then cannot do
      // anything here, because its party does not exist on these participants
      // and its own validator has never seen Sentry's package. Say so now
      // rather than after a command fails.
      if (!(await partyKnown(id.partyId))) {
        await disconnectWallet(detail).catch(() => {})
        setError(
          `${detail.info.name} is connected to a different Canton network. Its party is unknown to this ledger, so it cannot sign here.`,
        )
        setStatus('error')
        return
      }

      setIdentity(id)
      setCurrent(detail)
      setStatus('connected')
    } catch (err) {
      const e = err instanceof WalletError ? err : null
      setError(e?.rejected ? 'Rejected in the wallet.' : e?.expired ? 'The approval expired. Wallets allow three minutes.' : (err as Error).message)
      setStatus('error')
    }
  }, [])

  const disconnect = useCallback(async () => {
    if (current) await disconnectWallet(current)
    setIdentity(null)
    setCurrent(null)
    setError(null)
    setStatus(providers.length ? 'available' : 'none')
  }, [current, providers.length])

  return <Ctx.Provider value={{ status, providers, identity, error, connect, disconnect }}>{children}</Ctx.Provider>
}

export function useWallet(): WalletState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWallet outside WalletProvider')
  return v
}
