import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

// Dev only, and only when asked for: a stand-in CIP-0103 wallet, because the
// real one is MainNet-only and cannot be pointed at a local sandbox.
if (import.meta.env.DEV && new URLSearchParams(location.search).get('wallet') === 'mock') {
  const { installMockWallet } = await import('./ledger/mockWallet')
  installMockWallet()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
