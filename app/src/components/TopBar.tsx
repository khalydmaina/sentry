import { NODES, NODE_NAME, NODE_PORT } from '../ledger/api'
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
  const reachable = NODES.filter((n) => offsets[n] !== null).length
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
          {/* One chip for the whole network. Which node is at which offset is
              diagnostic detail, and the privacy page already shows it per node
              where it carries an argument. */}
          {status === 'ready' && (
            <span className="chip quiet" title={NODES.map((n) => `${NODE_NAME[n]} :${NODE_PORT[n]} · ${offsets[n] === null ? 'unreachable' : `offset ${offsets[n]}`}`).join('\n')}>
              <span className="blink" style={{ animation: 'none' }} aria-hidden />
              {reachable} {reachable === 1 ? 'node' : 'nodes'}
            </span>
          )}
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
      <button
        className="chip quiet"
        onClick={() => void disconnect()}
        title={`${identity.partyId}\n${identity.kind === 'wallet' ? identity.wallet : 'demo user'}\nClick to disconnect`}
      >
        <span className="blink" style={{ animation: 'none' }} aria-hidden /> {identity.label}
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
  // The reason can be a sentence. The chip gets the gist, the title gets it all.
  if (status === 'error') {
    return (
      <span className="chip refused" title={error ?? undefined}>
        {error && error.length > 28 ? 'Wallet unusable here' : (error ?? 'Wallet refused')}
      </span>
    )
  }
  if (providers.length) {
    return (
      <button className="btn small" onClick={() => void connect(providers[0])} title={providers.map((p) => p.info.name).join(', ')}>
        Connect wallet
      </button>
    )
  }
  return (
    <span className="chip quiet" title="No CIP-0103 wallet announced itself. The demo runs as this ledger's own users.">
      No wallet
    </span>
  )
}
