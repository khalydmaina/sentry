import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Canton JSON API sends no CORS headers, so the dev server proxies it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Two participant nodes on one synchronizer. `/v2` is the wallet node that
    // hosts the owner and the agent; `/counterparty/v2` is the node that hosts
    // the bank, the merchant and everyone else.
    proxy: {
      '/counterparty/v2': { target: 'http://localhost:7864', rewrite: (p) => p.replace(/^\/counterparty/, '') },
      '/v2': 'http://localhost:6864',
    },
    // The contract page imports the real Daml source from ../main.
    fs: { allow: ['..'] },
  },
})
