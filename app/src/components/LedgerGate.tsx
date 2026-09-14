import type { ReactNode } from 'react'
import { useLedger, type LedgerStatus } from '../ledger/LedgerContext'
import { Banner, Micro } from './ui'

/** Renders children only once the sandbox answers and the demo parties exist. */
export function LedgerGate({ children, framed }: { children: ReactNode; framed?: boolean }) {
  const { status } = useLedger()
  if (status === 'ready') return <>{children}</>
  if (framed) return <div className="page shell"><Fallback status={status} /></div>
  return <Fallback status={status} />
}

function Fallback({ status }: { status: Exclude<LedgerStatus, 'ready'> }) {
  if (status === 'connecting') {
    return (
      <div className="panel panel-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span className="blink" aria-hidden />
        <span className="data body-2">Connecting to the JSON Ledger API</span>
      </div>
    )
  }
  const offline = status === 'offline'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
      {offline ? (
        <Banner kind="reject" title="Ledger offline.">
          The JSON Ledger API on port 6864 did not answer. Nothing on this page is simulated, so it waits for a ledger.
        </Banner>
      ) : (
        <Banner kind="escalate" title="No demo parties on this ledger.">
          The sandbox is running, but the owner, agent and bank users do not exist yet.
        </Banner>
      )}
      <div className="panel panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Micro>{offline ? 'Start a fresh ledger' : 'Restart with the setup script'}</Micro>
        <code className="cmd">./scripts/ledger.sh</code>
        <p className="help" style={{ margin: 0 }}>
          Starts a Canton sandbox, uploads the sentry package and creates the demo parties. This page reconnects on its own.
        </p>
      </div>
    </div>
  )
}
