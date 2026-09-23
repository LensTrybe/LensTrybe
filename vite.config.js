import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// LensTrybe Next. Local only. Nothing here talks to the live site or the live database.
// Port 5180, fixed, so it never lands on the original site's dev server at 5173.
export default defineConfig({
  plugins: [react()],
  server: { port: 5180, host: true },
  preview: { port: 5181, strictPort: true },
})
