import { useLedger } from '../ledger/LedgerContext'
import type { Route } from '../App'
import { Wordmark } from './Mark'

const LINKS: Array<{ route: Route; label: string }> = [
  { route: 'desk', label: 'Desk' },
  { route: 'privacy', label: 'Privacy' },
  { route: 'contract', label: 'Contract' },
]

export function TopBar({ route }: { route: Route }) {
  const { status, offset } = useLedger()
  return (
    <header className="topbar">
      <div className="shell topbar-inner">
        <a href="#/" aria-label="sentry home">
          <Wordmark />
        </a>
        <nav className="nav" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.route} href={`#/${l.route}`} aria-current={route === l.route ? 'page' : undefined}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="topbar-status">
          {status === 'ready' && (
            <span className="chip quiet" title="Local Canton sandbox, JSON Ledger API">
              <span className="blink" style={{ animation: 'none' }} aria-hidden /> Sandbox
              <span className="ledger-offset">· offset {offset}</span>
            </span>
          )}
          {status === 'connecting' && (
            <span className="chip flight">
              <span className="blink" aria-hidden /> Connecting
            </span>
          )}
          {status === 'offline' && <span className="chip refused">Ledger offline</span>}
          {status === 'no-parties' && <span className="chip held">No demo parties</span>}
          {route === 'landing' && (
            <a className="btn primary small" href="#/desk">
              Run the demo
            </a>
          )}
        </div>
      </div>
    </header>
  )
}
