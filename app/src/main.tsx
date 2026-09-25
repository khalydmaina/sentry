import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

// Dev only, and only when asked for: a stand-in CIP-0103 wallet, because the
// real one is MainNet-only and cannot be pointed at a local sandbox.
const mock = new URLSearchParams(location.search).get('wallet')
if (import.meta.env.DEV && (mock === 'mock' || mock === 'mock-injected')) {
  const { installMockWallet } = await import('./ledger/mockWallet')
  installMockWallet(mock === 'mock' ? 'extension' : 'injected')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
