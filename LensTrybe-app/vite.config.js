import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Route components are split by React.lazy in App.jsx, which handles the pages.
        // These are the libraries, which lazy splitting alone does not separate well:
        // a library imported by two lazy routes is duplicated into both chunks unless
        // it is named here.
        //
        // Charts, PDF generation and the screenshot canvas are dashboard-only and heavy.
        // Naming them keeps them out of every public page, and out of each other.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts'],
          'vendor-pdf': ['jspdf', 'html2canvas'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    // The app is one large bundle by history rather than by design. 600kB is the point
    // at which a warning means something has gone wrong again, rather than being noise.
    chunkSizeWarningLimit: 600,
  },
})
