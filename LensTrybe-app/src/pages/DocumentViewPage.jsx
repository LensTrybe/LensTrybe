import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

// The public view of one invoice or quote, opened from the link in the email instead of
// a PDF attachment. The document HTML is the SAME markup document-pdf sends to PDFShift,
// so the branding, fonts and layout are identical to the PDF a creative downloads.
//
// Download is the browser's own print to PDF. No service, no rate limit, no cost, and it
// keeps working if PDFShift is ever unavailable.

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const TYPES = { invoice: 'Invoice', quote: 'Quote' }

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f6', fontFamily: "'Inter', system-ui, sans-serif", padding: '24px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

function Message({ title, detail }) {
  return (
    <Shell>
      <div style={{ background: '#fff', borderRadius: 14, padding: '40px 28px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 19, fontWeight: 700, color: '#14111a', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'rgba(20,17,26,0.6)', lineHeight: 1.6 }}>{detail}</div>
      </div>
    </Shell>
  )
}

export default function DocumentViewPage() {
  const { type, token } = useParams()
  const [state, setState] = useState({ loading: true, html: '', error: '', filename: '' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!TYPES[type]) {
        setState({ loading: false, html: '', error: 'not_found', filename: '' })
        return
      }
      const { data, error } = await supabase.functions.invoke('document-pdf', {
        body: { type, view_token: token, format: 'html' },
      })
      if (cancelled) return
      if (error || !data?.html) {
        setState({ loading: false, html: '', error: 'not_found', filename: '' })
        return
      }
      setState({ loading: false, html: data.html, error: '', filename: data.filename || TYPES[type] })
    }
    load()
    return () => { cancelled = true }
  }, [type, token])

  useEffect(() => {
    if (state.filename) document.title = state.filename
  }, [state.filename])

  if (state.loading) return <Message title="Loading…" detail="Fetching your document." />
  if (state.error) {
    return (
      <Message
        title="This link is not available"
        detail="The link may be wrong, or the document may have been withdrawn. Check with the creative who sent it."
      />
    )
  }

  return (
    <Shell>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .ltdoc-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .ltdoc-btn { border: none; border-radius: 10px; padding: 11px 20px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; background: ${GREEN}; color: ${GREEN_DARK}; }
        .ltdoc-btn:hover { filter: brightness(1.06); }
        .ltdoc-frame { background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .ltdoc-frame iframe { display: block; width: 100%; border: 0; min-height: 80vh; }
        /* Printing prints the document, never this page's chrome. */
        @media print {
          body { background: #fff; }
          .ltdoc-bar, .ltdoc-note { display: none !important; }
          .ltdoc-frame { box-shadow: none; border-radius: 0; }
        }
      `}</style>

      <div className="ltdoc-bar">
        <span style={{ fontSize: 13, color: 'rgba(20,17,26,0.6)' }}>
          Sent to you via <strong style={{ color: '#14111a' }}>LensTrybe</strong>
        </span>
        <button
          type="button"
          className="ltdoc-btn"
          onClick={() => {
            // Print the document itself, not the wrapper, so the output is just the page.
            const frame = document.getElementById('ltdoc-frame')
            if (frame?.contentWindow) { frame.contentWindow.focus(); frame.contentWindow.print() }
            else window.print()
          }}
        >
          Download or print
        </button>
      </div>

      <div className="ltdoc-frame">
        <iframe
          id="ltdoc-frame"
          title={state.filename}
          srcDoc={state.html}
          onLoad={(e) => {
            // Grow the frame to the document so there is no inner scrollbar.
            try {
              const doc = e.target.contentDocument
              if (doc?.body) e.target.style.height = `${doc.body.scrollHeight + 40}px`
            } catch { /* cross origin cannot happen with srcDoc, ignore anyway */ }
          }}
        />
      </div>

      <p className="ltdoc-note" style={{ fontSize: 12, color: 'rgba(20,17,26,0.5)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
        This link is private to you. Use Download or print to save a PDF copy.
      </p>
    </Shell>
  )
}
