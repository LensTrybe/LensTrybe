import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { supabase } from '../../backend/supabaseClient'
import { LIVE } from '../../lib/mode'
import Icon from '../../components/Icon'

// Addresses from the old site that are already in people's inboxes (emails, bell notifications).
// After the swap they land on the matching page here instead of the home page.
const DASH = {
  'clients/messages': 'threads', 'clients/meetings': 'meetings', 'clients/crm': 'crm', 'clients/contacts': 'clients',
  'finance/contracts': 'contracts', 'finance/quotes': 'quotes', 'finance/invoicing': 'invoicing', 'finance/expenses': 'expenses', 'finance/tax': 'tax', 'finance/overview': 'money',
  'business/reviews': 'reviews', 'business/insights': 'insights', 'business/marketplace': 'marketplace', 'business/team': 'team',
  'portfolio-design/deliver': 'deliver', 'portfolio-design/brand-kit': 'brand-kit', 'portfolio-design/portfolio-website': 'website',
  'my-work/jobs': 'jobs', 'my-work/my-bookings': 'bookings', 'my-work/availability': 'availability',
  'settings/subscription': 'subscription', 'settings': 'settings', 'profile/edit-profile': 'profile', 'profile/view-profile': 'view-profile',
  'content/calendar': 'content-calendar', 'content/ideas': 'content-ideas',
  'founding': 'founding', 'collaborate': 'collaborate', 'inventory': 'inventory', 'notes': 'notes', 'projects': 'projects', 'lumi': 'lumi', 'referrals': 'referrals', 'support': 'support',
}

export function OldDashboard() {
  const { pathname, search } = useLocation()
  const rest = pathname.replace(/^\/dashboard\/?/, '').replace(/\/+$/, '')
  const proj = rest.match(/^projects\/([^/]+)$/)
  const to = proj ? 'projects/' + proj[1] : DASH[rest] || 'today'
  // keep the useful bits of the query (?booking=…, ?card=update)
  return <Navigate to={'/app/' + to + (search || '')} replace />
}

export function OldClientDashboard() { return <Navigate to="/portal" replace /> }

// /doc/invoice/<token> and /doc/quote/<token>: the per-document link in invoice and quote emails.
// document-pdf renders it (sent documents only, never drafts) and makes the PDF.
export function DocView() {
  const { type, token } = useParams()
  const ok = ['invoice', 'quote'].includes(type) && /^[0-9a-f-]{36}$/i.test(token || '')
  const [d, setD] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!ok || !LIVE) return
    supabase.functions.invoke('document-pdf', { body: { type, view_token: token, format: 'html' } })
      .then(({ data, error }) => { if (error || !data?.html) setErr('This link has expired or the document is no longer available.'); else { setD(data); document.title = (data.filename || 'Document') + ' · LensTrybe' } })
      .catch(() => setErr('This link has expired or the document is no longer available.'))
  }, [type, token]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!ok) return <Navigate to="/" replace />
  const pdf = async () => {
    if (busy) return; setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('document-pdf', { body: { type, view_token: token } })
      if (error || !data?.content_base64) throw new Error()
      const bin = atob(data.content_base64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' })); a.download = data.filename || type + '.pdf'; a.click()
    } catch { setErr('The PDF could not be made just now. Try again in a minute.') } finally { setBusy(false) }
  }
  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f6', padding: '24px 12px 48px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <Link to="/" style={{ color: '#141414', fontWeight: 700, letterSpacing: '.2em', fontSize: 12, textDecoration: 'none' }}>LENSTRYBE</Link>
          {d && <button type="button" onClick={pdf} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 999, border: 0, background: '#141414', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: busy ? .6 : 1 }}>{busy ? 'Making the PDF' : 'Download PDF'} <Icon name="arrow" size={14} /></button>}
        </div>
        {err ? <div style={{ background: '#fff', borderRadius: 14, padding: '32px 28px', color: '#141414' }}><b style={{ fontSize: 18 }}>{err}</b><p style={{ color: '#6b7280', marginTop: 8 }}>Ask the person who sent it for a new link, or open it from your portal.</p></div>
          : !d ? <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 60 }}>Opening your {type}…</p>
          : <iframe title={d.filename || type} srcDoc={d.html} sandbox="" style={{ width: '100%', minHeight: '80vh', border: 0, borderRadius: 14, background: '#fff', boxShadow: '0 10px 40px rgba(0,0,0,.08)' }} />}
      </div>
    </div>
  )
}
