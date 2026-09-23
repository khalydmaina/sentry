import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Canton JSON API sends no CORS headers, so the dev server proxies it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Three participant nodes on one synchronizer. `/v2` is the wallet node,
    // `/counterparty/v2` hosts the bank and the counterparties, and
    // `/governance/v2` is the owner's second host.
    proxy: {
      '/counterparty/v2': { target: 'http://localhost:7864', rewrite: (p) => p.replace(/^\/counterparty/, '') },
      '/governance/v2': { target: 'http://localhost:8864', rewrite: (p) => p.replace(/^\/governance/, '') },
      '/v2': 'http://localhost:6864',
    },
    // The contract page imports the real Daml source from ../main.
    fs: { allow: ['..'] },
  },
})
