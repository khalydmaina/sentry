import type { ReactNode } from 'react'
import { HOSTED } from '../ledger/api'
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
  if (HOSTED) return <RunsLocally />
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

const REPO = 'https://github.com/khalydmaina/sentry'

/**
 * The hosted site has no ledger behind it. Everything past this point is read
 * live from three Canton participants, so it says where they run instead of
 * showing something that only looks like them.
 */
function RunsLocally() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
      <Banner kind="escalate" title="The live ledger runs locally.">
        This page reads three Canton participants over the JSON Ledger API, and a Canton participant is a JVM, not something a static host can run. Nothing here is
        simulated, so it does not pretend: run the network on your machine and this page fills in.
      </Banner>
      <div className="panel panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Micro>Run it yourself · two terminals</Micro>
        <code className="cmd">git clone {REPO} &amp;&amp; cd sentry</code>
        <code className="cmd">./scripts/ledger.sh</code>
        <code className="cmd">cd app &amp;&amp; npm install &amp;&amp; npm run dev</code>
        <p className="help" style={{ margin: 0 }}>
          Needs JDK 21 and the Daml SDK (dpm). Then open localhost:5173. The{' '}
          <a href={REPO} target="_blank" rel="noreferrer">
            README
          </a>{' '}
          covers the topology and what each page proves.
        </p>
      </div>
    </div>
  )
}
