import { useEffect, useState } from 'react'
import { TopBar } from './components/TopBar'
import { LedgerProvider } from './ledger/LedgerContext'
import { WalletProvider } from './ledger/WalletContext'
import { Contract } from './pages/Contract'
import { Desk } from './pages/Desk'
import { Landing } from './pages/Landing'
import { Privacy } from './pages/Privacy'

export type Route = 'landing' | 'desk' | 'privacy' | 'contract'

function parse(hash: string): Route {
  const r = hash.replace(/^#\/?/, '')
  return r === 'desk' || r === 'privacy' || r === 'contract' ? r : 'landing'
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parse(location.hash))
  useEffect(() => {
    const on = () => {
      setRoute(parse(location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  return (
    <LedgerProvider>
      <WalletProvider>
        <TopBar route={route} />
        <main>
          {route === 'landing' && <Landing />}
          {route === 'desk' && <Desk />}
          {route === 'privacy' && <Privacy />}
          {route === 'contract' && <Contract />}
        </main>
      </WalletProvider>
    </LedgerProvider>
  )
}
