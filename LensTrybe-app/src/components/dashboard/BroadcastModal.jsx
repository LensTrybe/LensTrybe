import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { BroadcastBanner, BroadcastCard } from '../broadcasts/BroadcastHost'

// Admin > Broadcast. Write a message for creatives and/or clients, choose banner or card,
// optionally email it, and see what's been sent. Backed by the `broadcasts` Edge Function.
// Uses the theme-aware --lt-* tokens.

const GREEN = '#1DB954'
const PINK = '#FF2D78'

export const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Everyone (creatives and clients)' },
  { value: 'creatives', label: 'All creatives' },
  { value: 'clients', label: 'All clients' },
  { value: 'basic', label: 'Basic creatives' },
  { value: 'pro', label: 'Pro creatives' },
  { value: 'expert', label: 'Expert creatives' },
  { value: 'elite', label: 'Elite creatives' },
  { value: 'founding', label: 'Founding creatives' },
]
const audienceLabel = (v) => AUDIENCE_OPTIONS.find((o) => o.value === v)?.label || v

const field = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, fontSize: 14, fontFamily: 'inherit',
  color: 'var(--lt-text)', background: 'var(--lt-input-bg)', border: '1px solid var(--lt-input-border)', outline: 'none',
}
const label = { fontSize: 12, fontWeight: 600, color: 'var(--lt-muted)', marginBottom: 5, display: 'block' }
const btn = { padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--lt-border)', background: 'transparent', color: 'var(--lt-text)', whiteSpace: 'nowrap' }
const btnPrimary = { ...btn, background: GREEN, color: '#04120a', border: `1px solid ${GREEN}` }

async function callBroadcasts(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('broadcasts', { body: { action, ...payload } })
  if (!error) return { ok: true, ...(data || {}) }
  let body = null
  try { body = await error?.context?.json?.() } catch { /* not JSON */ }
  return { ok: false, error: body?.error || data?.error || error?.message || 'Something went wrong. Please try again.' }
}

function fmtDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}

function StyleTile({ active, title, text, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: '1 1 200px', textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
      border: `1.5px solid ${active ? GREEN : 'var(--lt-border)'}`, background: active ? 'rgba(29,185,84,0.08)' : 'transparent', color: 'var(--lt-text)',
    }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--lt-muted)', marginTop: 3, lineHeight: 1.45 }}>{text}</div>
    </button>
  )
}

function SentRow({ b, onEnd, ending }) {
  const ended = b.ends_at && new Date(b.ends_at).getTime() <= Date.now()
  const status = ended ? { t: `Ended ${fmtDate(b.ends_at)}`, c: 'var(--lt-faint)' } : b.ends_at ? { t: `Live until ${fmtDate(b.ends_at)}`, c: GREEN } : { t: 'Live', c: GREEN }
  return (
    <div style={{ padding: '12px 0', borderTop: '1px solid var(--lt-hairline)', display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: '1 1 260px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lt-text)' }}>{b.title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>
          {audienceLabel(b.audience)} · {b.style === 'card' ? 'Card' : 'Banner'} · Sent {fmtDate(b.created_at)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 2 }}>
          Reached {b.recipients} · Dismissed by {b.dismissed}{b.send_email ? ` · Emailed ${b.emailed}` : ''}
        </div>
        {b.email_error && <div style={{ fontSize: 12, color: PINK, marginTop: 2 }}>{b.email_error}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: status.c }}>{status.t}</span>
        {!ended && <button type="button" style={{ ...btn, padding: '6px 12px', fontSize: 12.5 }} disabled={ending} onClick={() => onEnd(b)}>{ending ? 'Ending…' : 'End now'}</button>}
      </div>
    </div>
  )
}

const EMPTY = { audience: 'all', style: 'banner', title: '', body: '', cta_label: '', cta_url: '', ends_on: '', send_email: false }

export default function BroadcastModal({ open, onClose, onSent }) {
  const [tab, setTab] = useState('new')
  const [f, setF] = useState(EMPTY)
  const [reach, setReach] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState([])
  const [loadingSent, setLoadingSent] = useState(false)
  const [ending, setEnding] = useState(null)
  const [emailPreview, setEmailPreview] = useState(null)
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setError(''); setConfirming(false) }

  useEffect(() => {
    if (!open) return
    let live = true
    setReach(null)
    callBroadcasts('count', { audience: f.audience }).then((r) => { if (live && r.ok) setReach(r) })
    return () => { live = false }
  }, [open, f.audience])

  const loadSent = useCallback(async () => {
    setLoadingSent(true)
    const r = await callBroadcasts('list')
    if (r.ok) setSent(r.broadcasts || [])
    setLoadingSent(false)
  }, [])
  useEffect(() => { if (open && tab === 'sent') void loadSent() }, [open, tab, loadSent])

  useEffect(() => {
    if (!open) { setConfirming(false); setError(''); setEmailPreview(null) }
  }, [open])

  const sample = useMemo(() => ({
    id: 'preview', title: f.title.trim() || 'Your title', body: f.body.trim() || 'Your message shows here.',
    style: f.style, cta_label: f.cta_label.trim() || null, cta_url: f.cta_url.trim() || null,
  }), [f])

  if (!open) return null

  function validate() {
    if (!f.title.trim()) return 'Add a title.'
    if (!f.body.trim()) return 'Add a message.'
    const hasLabel = !!f.cta_label.trim(); const hasUrl = !!f.cta_url.trim()
    if (hasLabel !== hasUrl) return 'Add both a button label and a link, or leave both empty.'
    if (hasUrl && !/^(\/(?!\/)|https:\/\/)/.test(f.cta_url.trim())) return 'The button link must start with / (a LensTrybe page) or https://.'
    if (f.ends_on && new Date(`${f.ends_on}T23:59:59`).getTime() <= Date.now()) return 'The end date must be in the future.'
    if (reach && reach.recipients === 0) return 'Nobody is in that audience yet.'
    return ''
  }

  async function send() {
    const v = validate()
    if (v) { setError(v); return }
    if (!confirming) { setConfirming(true); return }
    setBusy(true); setError('')
    const r = await callBroadcasts('send', {
      audience: f.audience, style: f.style, title: f.title, body: f.body,
      cta_label: f.cta_label || null, cta_url: f.cta_url || null, send_email: f.send_email,
      ends_at: f.ends_on ? new Date(`${f.ends_on}T23:59:59`).toISOString() : null,
    })
    setBusy(false); setConfirming(false)
    if (!r.ok) { setError(r.error); return }
    const n = r.broadcast?.recipients ?? 0
    onSent?.(r.emailError
      ? `Broadcast sent to ${n} in the app, but the email failed: ${r.emailError}`
      : `Broadcast sent to ${n} ${n === 1 ? 'person' : 'people'}${f.send_email ? `, emailed ${r.broadcast?.emailed ?? 0}` : ''}.`, r.emailError ? 'error' : 'success')
    setF(EMPTY)
    setSent((prev) => [r.broadcast, ...prev])
    setTab('sent')
  }

  async function end(b) {
    setEnding(b.id)
    const r = await callBroadcasts('end', { id: b.id })
    setEnding(null)
    if (r.ok) setSent((prev) => prev.map((x) => (x.id === b.id ? { ...x, ends_at: r.broadcast.ends_at } : x)))
  }

  async function previewEmail() {
    const r = await callBroadcasts('preview', { title: f.title, body: f.body, cta_label: f.cta_label, cta_url: f.cta_url })
    if (r.ok) setEmailPreview(r.html)
    else setError(r.error)
  }

  const tabBtn = (key, text) => (
    <button type="button" onClick={() => setTab(key)} style={{ ...btn, border: 'none', borderBottom: `2px solid ${tab === key ? GREEN : 'transparent'}`, borderRadius: 0, padding: '8px 2px', marginRight: 16, color: tab === key ? 'var(--lt-text)' : 'var(--lt-muted)' }}>{text}</button>
  )
  const reachText = reach
    ? `Reaches ${reach.recipients} ${reach.recipients === 1 ? 'person' : 'people'}${f.audience === 'all' ? ` (${reach.creatives} creative${reach.creatives === 1 ? '' : 's'}, ${reach.clients} client${reach.clients === 1 ? '' : 's'})` : ''}.`
    : 'Counting…'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(5,5,10,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 680, maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box', borderRadius: 18, padding: '20px 22px',
        background: 'var(--lt-modal-bg)', border: 'var(--lt-modal-border)', boxShadow: 'var(--lt-modal-shadow)', backdropFilter: 'var(--lt-modal-blur)', WebkitBackdropFilter: 'var(--lt-modal-blur)',
        color: 'var(--lt-text)', fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Broadcast message</div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ ...btn, border: 'none', fontSize: 22, padding: '2px 8px', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--lt-hairline)', margin: '8px 0 16px' }}>
          {tabBtn('new', 'New broadcast')}
          {tabBtn('sent', 'Sent')}
        </div>

        {tab === 'new' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={label}>Who gets it</label>
              <select value={f.audience} onChange={(e) => set('audience', e.target.value)} style={{ ...field, cursor: 'pointer' }}>
                {AUDIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 5 }}>{reachText} People who join after you send won't see it.</div>
            </div>

            <div>
              <label style={label}>How it shows</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <StyleTile active={f.style === 'banner'} onClick={() => set('style', 'banner')} title="Banner" text="A slim bar across the top of their dashboard. Good for everyday news." />
                <StyleTile active={f.style === 'card'} onClick={() => set('style', 'card')} title="Card" text="A card in the middle of the screen they tap to close. For important things." />
              </div>
              <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 5 }}>Either way it also goes in their notification bell. They see it the next time they open their dashboard (within a minute if they're on it) until they close it.</div>
            </div>

            <div>
              <label style={label}>Title</label>
              <input style={field} maxLength={120} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Bookings are here" />
            </div>
            <div>
              <label style={label}>Message</label>
              <textarea style={{ ...field, minHeight: 110, resize: 'vertical' }} maxLength={2000} value={f.body} onChange={(e) => set('body', e.target.value)} placeholder="Write your message…" />
              <div style={{ fontSize: 11.5, color: 'var(--lt-faint)', textAlign: 'right', marginTop: 3 }}>{f.body.length} / 2000</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div><label style={label}>Button label (optional)</label><input style={field} maxLength={40} value={f.cta_label} onChange={(e) => set('cta_label', e.target.value)} placeholder="e.g. Try it now" /></div>
              <div><label style={label}>Button link</label><input style={field} value={f.cta_url} onChange={(e) => set('cta_url', e.target.value)} placeholder="/dashboard/my-work/my-bookings" /></div>
              <div><label style={label}>Stop showing on (optional)</label><input style={field} type="date" value={f.ends_on} onChange={(e) => set('ends_on', e.target.value)} /></div>
            </div>

            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 13.5, color: 'var(--lt-text)' }}>
              <input type="checkbox" checked={f.send_email} onChange={(e) => set('send_email', e.target.checked)} style={{ marginTop: 3, accentColor: GREEN }} />
              <span>
                Also email it
                <span style={{ display: 'block', fontSize: 12, color: 'var(--lt-faint)', marginTop: 2 }}>
                  Only to people subscribed to LensTrybe emails{reach ? ` (${reach.subscribed} of ${reach.recipients})` : ''}, with an unsubscribe link. <button type="button" onClick={previewEmail} style={{ background: 'none', border: 'none', padding: 0, color: GREEN, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Preview email</button>
                </span>
              </span>
            </label>

            <div>
              <label style={label}>Preview</label>
              <div style={{ borderRadius: 14, padding: 14, background: 'var(--lt-surface-2)', border: '1px dashed var(--lt-border)', display: 'flex', justifyContent: 'center' }}>
                {f.style === 'card'
                  ? <BroadcastCard b={sample} inline onDismiss={() => {}} onCta={() => {}} />
                  : <div style={{ width: '100%' }}><BroadcastBanner b={sample} onDismiss={() => {}} onCta={() => {}} /></div>}
              </div>
            </div>

            {error && <div style={{ fontSize: 13, color: PINK }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
              {confirming && <span style={{ fontSize: 13, color: 'var(--lt-muted)' }}>Send to {reach?.recipients ?? 0} {reach?.recipients === 1 ? 'person' : 'people'}{f.send_email ? ` and email ${reach?.subscribed ?? 0}` : ''}? This can't be unsent.</span>}
              <button type="button" style={btn} onClick={confirming ? () => setConfirming(false) : onClose}>{confirming ? 'Back' : 'Cancel'}</button>
              <button type="button" style={btnPrimary} disabled={busy} onClick={send}>{busy ? 'Sending…' : confirming ? 'Yes, send it' : 'Send'}</button>
            </div>
          </div>
        ) : (
          <div>
            {loadingSent && sent.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--lt-muted)', padding: '10px 0' }}>Loading…</div>
            ) : sent.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--lt-muted)', padding: '10px 0' }}>Nothing sent yet.</div>
            ) : (
              sent.map((b) => <SentRow key={b.id} b={b} onEnd={end} ending={ending === b.id} />)
            )}
            <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 10, lineHeight: 1.5 }}>End now stops the banner or card showing to anyone who hasn't closed it yet. It stays in their notification bell.</div>
          </div>
        )}
      </div>

      {emailPreview && (
        <div onClick={(e) => { e.stopPropagation(); setEmailPreview(null) }} style={{ position: 'fixed', inset: 0, zIndex: 1260, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, borderRadius: 16, overflow: 'hidden', background: 'var(--lt-modal-bg)', border: 'var(--lt-modal-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--lt-hairline)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--lt-text)' }}>Email preview</span>
              <button type="button" style={btn} onClick={() => setEmailPreview(null)}>Close</button>
            </div>
            <iframe title="Email preview" srcDoc={emailPreview} style={{ border: 'none', width: '100%', height: '70vh', background: '#0a0a0f' }} />
          </div>
        </div>
      )}
    </div>
  )
}
