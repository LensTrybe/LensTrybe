import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { themeTokens } from '../../lib/dashboardTheme'

const FONT = "'Inter', sans-serif"
const typeColor = { Client: '#3b82f6', Invoice: '#1DB954', Booking: '#a855f7' }

export default function WorkspaceSearch({ userId, navigate, isMobile, t: tProp }) {
  const t = tProp || themeTokens(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    const term = q.trim().replace(/[,()%]/g, ' ').trim()
    if (!userId || term.length < 2) { setResults([]); return }
    const like = `%${term}%`
    const timer = setTimeout(async () => {
      const [c, inv, bk] = await Promise.all([
        supabase.from('crm_contacts').select('id, name, email').eq('creative_id', userId).or(`name.ilike.${like},email.ilike.${like},company.ilike.${like}`).limit(5),
        supabase.from('invoices').select('id, client_name, status').eq('creative_id', userId).ilike('client_name', like).limit(4),
        supabase.from('bookings').select('id, client_name, service').eq('creative_id', userId).or(`client_name.ilike.${like},service.ilike.${like}`).limit(4),
      ])
      const res = [
        ...(c.data || []).map((x) => ({ type: 'Client', label: x.name || x.email || 'Client', sub: x.email || '', to: '/dashboard/clients/crm' })),
        ...(inv.data || []).map((x) => ({ type: 'Invoice', label: x.client_name || 'Invoice', sub: x.status || 'draft', to: '/dashboard/finance/invoicing' })),
        ...(bk.data || []).map((x) => ({ type: 'Booking', label: x.client_name || x.service || 'Booking', sub: x.service || '', to: '/dashboard/my-work/my-bookings' })),
      ].slice(0, 8)
      setResults(res)
      setOpen(true)
    }, 250)
    return () => clearTimeout(timer)
  }, [q, userId])

  const showEmpty = open && q.trim().length >= 2 && results.length === 0
  const panelBg = t.dark ? 'rgba(12,20,40,0.97)' : 'rgba(255,255,255,0.97)'
  const hoverBg = t.dark ? 'rgba(120,190,255,0.1)' : 'rgba(20,17,26,0.05)'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: t.textMuted, fontSize: 15, pointerEvents: 'none' }}>⌕</span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true) }}
        placeholder="Search your clients, invoices…"
        style={{ width: isMobile ? 160 : 260, boxSizing: 'border-box', padding: '10px 14px 10px 36px', borderRadius: 999, border: t.inputBorder, background: t.inputBg, fontSize: 13, color: t.text, fontFamily: FONT, outline: 'none' }}
      />
      {(open && results.length > 0) || showEmpty ? (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 40, background: panelBg, backdropFilter: 'blur(22px) saturate(140%)', WebkitBackdropFilter: 'blur(22px) saturate(140%)', border: t.glassBorder, borderRadius: 14, boxShadow: '0 24px 54px -16px rgba(0,0,0,0.5)', padding: 6, maxHeight: 320, overflowY: 'auto', minWidth: 240 }}>
          {showEmpty ? (
            <div style={{ padding: '12px', fontSize: 13, color: t.textMuted, fontFamily: FONT }}>No matches in your workspace.</div>
          ) : (
            results.map((r, i) => (
              <div
                key={i}
                onClick={() => { navigate(r.to); setOpen(false); setQ('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: typeColor[r.type], background: `${typeColor[r.type]}22`, borderRadius: 6, padding: '3px 7px', flexShrink: 0, fontFamily: FONT }}>{r.type}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: t.text, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
                  {r.sub ? <div style={{ fontSize: 11, color: t.textMuted, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</div> : null}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
