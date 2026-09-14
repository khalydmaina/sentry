import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Canton JSON API sends no CORS headers, so the dev server proxies it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/v2': 'http://localhost:6864' },
    // The contract page imports the real Daml source from ../main.
    fs: { allow: ['..'] },
  },
})
