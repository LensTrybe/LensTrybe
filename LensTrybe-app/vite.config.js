import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Route components are split by React.lazy in App.jsx, which handles the pages.
        // These are the libraries, which lazy splitting alone does not separate well: a
        // library imported by two lazy routes is duplicated into both chunks unless it
        // is named here.
        //
        // Charts, PDF generation and the screenshot canvas are dashboard-only and heavy.
        // Naming them keeps them out of every public page, and out of each other.
        //
        // This has to be a function, not the object form every Vite 5 example shows.
        // Vite 8 bundles with rolldown, which rejects the object with "manualChunks is
        // not a function" partway through the build.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules[/\\](react|react-dom|react-router|react-router-dom|scheduler)[/\\]/.test(id)) return 'vendor-react'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-charts'
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf'
          if (id.includes('lucide-react')) return 'vendor-icons'
          return undefined
        },
      },
    },
    // The app was one large bundle by history rather than by design. 600kB is the point
    // at which a warning means something has gone wrong again, rather than being noise.
    chunkSizeWarningLimit: 600,
  },
})
