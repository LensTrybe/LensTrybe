import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LIQUID_GLASS_CARD } from '../../lib/glassTokensLight'
import TileField from '../ui/TileField'

// Shared layout for the legal pages (Terms, Privacy, Cookies, Refunds).
// Section bodies are plain text: blank lines separate blocks, lines starting with
// "• " become a list, "### " a sub-heading. Inline [text](/path) makes a link and
// **text** makes bold.

export const LEGAL_DOCS = [
  { path: '/terms', label: 'Terms and Conditions' },
  { path: '/privacy', label: 'Privacy Policy' },
  { path: '/cookies', label: 'Cookies Policy' },
  { path: '/refunds', label: 'Refund Policy' },
]

const GREEN_DARK = '#0f7a37'

function renderInline(text, keyBase) {
  const out = []
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g
  let last = 0
  let m
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) {
      const href = m[2]
      const style = { color: GREEN_DARK, fontWeight: 600, textDecoration: 'underline' }
      out.push(href.startsWith('/')
        ? <Link key={`${keyBase}-${i++}`} to={href} style={style}>{m[1]}</Link>
        : <a key={`${keyBase}-${i++}`} href={href} style={style} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>{m[1]}</a>)
    } else {
      out.push(<strong key={`${keyBase}-${i++}`} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{m[3]}</strong>)
    }
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function Body({ text, sid }) {
  const blocks = String(text || '').trim().split(/\n\s*\n/)
  return blocks.map((block, bi) => {
    const lines = block.split('\n')
    const key = `${sid}-${bi}`
    if (lines.every((l) => l.trim().startsWith('• '))) {
      return (
        <ul key={key} style={{ margin: '0 0 14px', paddingLeft: 22 }}>
          {lines.map((l, li) => <li key={li} style={{ marginBottom: 6 }}>{renderInline(l.trim().slice(2), `${key}-${li}`)}</li>)}
        </ul>
      )
    }
    if (block.startsWith('### ')) {
      const [head, ...rest] = lines
      return (
        <div key={key}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: 15.5, fontWeight: 600, margin: '18px 0 8px' }}>{head.slice(4)}</h3>
          {rest.length > 0 && <Body text={rest.join('\n')} sid={key} />}
        </div>
      )
    }
    return <p key={key} style={{ margin: '0 0 12px', whiteSpace: 'pre-line' }}>{renderInline(block, key)}</p>
  })
}

export default function LegalDocument({ title, updated, intro, sections }) {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const location = useLocation()
  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => {
    if (!location.hash) { window.scrollTo(0, 0); return undefined }
    // Jump to a section when arriving with #anchor (the page renders after the browser's own jump).
    const t = setTimeout(() => {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)))
      if (el) el.scrollIntoView({ block: 'start' })
    }, 60)
    return () => clearTimeout(t)
  }, [location.pathname, location.hash])

  return (
    <div className="lt-legal" style={{ background: 'transparent', minHeight: '100vh', padding: isMobile ? '24px 16px' : '60px 24px', fontFamily: 'Inter, sans-serif', overflow: 'hidden', position: 'relative' }}>
      {!isMobile && <TileField animated={false} opacity={0.22} />}
      <style>{`
        .lt-legal a:hover { opacity: .8; }
        .lt-legal-nav a { text-decoration: none; }
        @media (max-width: 767px) {
          .lt-legal h1 { font-size: 26px !important; }
          .lt-legal h2 { font-size: 17px !important; }
          .lt-legal p, .lt-legal li { font-size: 15px !important; }
        }
        @media print {
          .lt-legal-nav, .lt-legal-toc { display: none !important; }
        }
      `}</style>
      <div style={{ maxWidth: 820, margin: '0 auto', color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: 15, ...LIQUID_GLASS_CARD, position: 'relative', zIndex: 2, padding: isMobile ? '28px 20px' : '48px 56px', borderRadius: 20 }}>
        <nav className="lt-legal-nav" aria-label="Legal documents" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
          {LEGAL_DOCS.map((d) => {
            const on = location.pathname === d.path
            return (
              <Link key={d.path} to={d.path} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? GREEN_DARK : 'rgba(20,17,26,0.12)'}`, background: on ? 'rgba(29,185,84,0.12)' : 'transparent', color: on ? GREEN_DARK : 'var(--text-secondary)' }}>{d.label}</Link>
            )
          })}
        </nav>

        <h1 style={{ color: 'var(--text-primary)', fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 8px' }}>{title}</h1>
        <p style={{ color: GREEN_DARK, fontSize: 14, margin: '0 0 28px' }}>LensTrybe · Last updated {updated}</p>

        {intro && <div style={{ marginBottom: 28 }}><Body text={intro} sid="intro" /></div>}

        {sections.length > 5 && (
          <div className="lt-legal-toc" style={{ margin: '0 0 36px', padding: '18px 22px', borderRadius: 14, background: 'rgba(20,17,26,0.03)', border: '1px solid rgba(20,17,26,0.08)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Contents</div>
            <ol style={{ margin: 0, paddingLeft: 20, columns: isMobile ? 1 : 2, columnGap: 32, fontSize: 14 }}>
              {sections.map((s) => (
                <li key={s.id} style={{ marginBottom: 4, breakInside: 'avoid' }}>
                  <a href={`#${s.id}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{s.title}</a>
                </li>
              ))}
            </ol>
          </div>
        )}

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} style={{ marginBottom: 36, scrollMarginTop: 90 }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: 19, fontWeight: 600, margin: '0 0 12px', borderBottom: '1px solid rgba(20,17,26,0.08)', paddingBottom: 8 }}>{i + 1}. {s.title}</h2>
            <Body text={s.body} sid={s.id} />
          </section>
        ))}

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(20,17,26,0.08)', fontSize: 13, color: 'var(--text-muted)' }}>
          <p style={{ margin: '0 0 4px' }}>LensTrybe · Queensland, Australia · lenstrybe.com</p>
          <p style={{ margin: 0 }}>© {new Date().getFullYear()} LensTrybe. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
