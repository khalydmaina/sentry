import { NODES, NODE_NAME } from '../ledger/api'
import { useLedger } from '../ledger/LedgerContext'
import { useWallet } from '../ledger/WalletContext'
import type { Route } from '../App'
import { Wordmark } from './Mark'

const LINKS: Array<{ route: Route; label: string }> = [
  { route: 'desk', label: 'Desk' },
  { route: 'privacy', label: 'Privacy' },
  { route: 'contract', label: 'Contract' },
]

export function TopBar({ route }: { route: Route }) {
  const { status, offsets } = useLedger()
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
          {/* One chip per participant. Their offsets advance independently, so
              showing a single number would imply one shared ledger. */}
          {status === 'ready' &&
            NODES.map((n) => (
              <span key={n} className="chip quiet" title={`Canton participant ${NODE_NAME[n]}, JSON Ledger API`}>
                <span className="blink" style={{ animation: 'none' }} aria-hidden /> {NODE_NAME[n]}
                <span className="ledger-offset">· {offsets[n] === null ? 'unreachable' : `offset ${offsets[n]}`}</span>
              </span>
            ))}
          {status === 'connecting' && (
            <span className="chip flight">
              <span className="blink" aria-hidden /> Connecting
            </span>
          )}
          {status === 'offline' && <span className="chip refused">Ledger offline</span>}
          {status === 'no-parties' && <span className="chip held">No demo parties</span>}
          <WalletChip />
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

/**
 * A CIP-0103 wallet is how a real owner proves who they are. With no wallet
 * installed the app still runs on the local sandbox as the demo users, and
 * says so rather than pretending someone signed in.
 */
function WalletChip() {
  const { status, providers, identity, error, connect, disconnect } = useWallet()

  if (status === 'connected' && identity) {
    return (
      <button className="chip quiet" onClick={() => void disconnect()} title={`${identity.partyId}\nClick to disconnect`}>
        <span className="blink" style={{ animation: 'none' }} aria-hidden /> {identity.label}
        <span className="ledger-offset">· {identity.kind === 'wallet' ? identity.wallet : 'demo user'}</span>
      </button>
    )
  }
  if (status === 'connecting') {
    return (
      <span className="chip flight">
        <span className="blink" aria-hidden /> Approve in wallet
      </span>
    )
  }
  if (status === 'error') return <span className="chip refused" title={error ?? undefined}>{error ?? 'Wallet refused'}</span>
  if (providers.length) {
    return (
      <button className="btn small" onClick={() => void connect(providers[0])}>
        Connect {providers.length === 1 ? providers[0].info.name : 'wallet'}
      </button>
    )
  }
  return (
    <span className="chip quiet" title="No CIP-0103 wallet announced itself. The demo runs as the sandbox users.">
      Demo users · no wallet
    </span>
  )
}
