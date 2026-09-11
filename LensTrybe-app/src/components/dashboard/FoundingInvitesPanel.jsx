import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { CREATIVE_TYPES } from '../../lib/creativeTypes'

// Founding Invites: add creatives, send each a personal code (FIRSTNAME-XXXX), and keep
// track of the 100 founding places. Backed by the founding-invites Edge Function.
// Rendered inside AdminPage (admin-gated). Uses the theme-aware --lt-* tokens.

const GREEN = '#1DB954'
const PINK = '#FF2D78'
const AMBER = '#f59e0b'
const INVITE_BASE = 'https://lenstrybe.com/join/creative?code='
const REGIONS = ['Sunshine Coast', 'Moreton Bay', 'Brisbane', 'Ipswich', 'Logan', 'Redland Bay', 'Gold Coast']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const field = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, fontSize: 14,
  fontFamily: 'inherit', color: 'var(--lt-text)', background: 'var(--lt-input-bg)', border: '1px solid var(--lt-input-border)', outline: 'none',
}
const label = { fontSize: 12, fontWeight: 600, color: 'var(--lt-muted)', marginBottom: 5, display: 'block' }
const btn = {
  padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  border: '1px solid var(--lt-border)', background: 'transparent', color: 'var(--lt-text)', whiteSpace: 'nowrap',
}
const btnPrimary = { ...btn, background: GREEN, color: '#04120a', border: `1px solid ${GREEN}` }
const btnDanger = { ...btn, color: PINK, borderColor: 'rgba(255,45,120,0.4)' }
const card = { background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', borderRadius: 14, padding: '16px 18px' }

async function callInvites(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('founding-invites', { body: { action, ...payload } })
  if (!error) return { ok: true, ...(data || {}) }
  let body = null
  try { body = await error?.context?.json?.() } catch { /* not JSON */ }
  return { ok: false, error: body?.error || data?.error || error?.message || 'Something went wrong. Please try again.', ...(body || {}) }
}

function fmtDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}

function daysLeft(iso) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

// Display state for one invite.
export function inviteState(inv) {
  if (inv.status === 'redeemed') return { key: 'signed_up', label: 'Signed up', color: GREEN }
  if (inv.status === 'cancelled') return { key: 'cancelled', label: 'Cancelled', color: 'var(--lt-faint)' }
  const left = daysLeft(inv.expires_at)
  if (inv.status === 'expired' || (left !== null && left <= 0)) return { key: 'expired', label: 'Expired', color: PINK }
  if (!inv.sent_at) return { key: 'draft', label: 'Draft', color: 'var(--lt-muted)' }
  const dl = `${left} day${left === 1 ? '' : 's'} left`
  if (inv.reminded_at) return { key: 'reminded', label: `Reminded · ${dl}`, color: AMBER }
  return { key: 'sent', label: `Sent · ${dl}`, color: GREEN }
}

// "Name, email, type, region" per line. Comma or tab separated, any column order for email.
export function parseBulk(text) {
  const rows = []
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  lines.forEach((line, i) => {
    const cols = (line.includes('\t') ? line.split('\t') : line.split(',')).map((c) => c.trim()).filter((c) => c !== '')
    const emailIdx = cols.findIndex((c) => c.includes('@'))
    if (i === 0 && emailIdx === -1 && /email/i.test(line)) return // header row
    const email = emailIdx >= 0 ? cols[emailIdx].toLowerCase() : ''
    const rest = cols.filter((_, idx) => idx !== emailIdx)
    const row = { name: rest[0] || '', email, skill_type: rest[1] || '', region: rest[2] || '', line: i + 1 }
    row.problem = !row.name ? 'Name missing' : !EMAIL_RE.test(email) ? 'Email missing or not valid' : ''
    rows.push(row)
  })
  const seen = new Set()
  rows.forEach((r) => {
    if (!r.problem && seen.has(r.email)) r.problem = 'Listed twice'
    seen.add(r.email)
  })
  return rows
}

function Chip({ state }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: state.color, border: '1px solid var(--lt-border)', background: 'var(--lt-surface-2)', whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: state.color }} />
      {state.label}
    </span>
  )
}

function PlacesMeter({ places, counts }) {
  const cap = places?.cap || 100
  const used = places?.used || 0
  const seg = (n, color) => (n > 0 ? <div style={{ width: `${(n / cap) * 100}%`, background: color, height: '100%' }} /> : null)
  const legend = (color, text) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--lt-muted)' }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />{text}
    </span>
  )
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lt-text)' }}>
          {used} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--lt-muted)' }}>of {cap} places taken</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: places?.available ? GREEN : PINK }}>{places?.available ?? 0} available</div>
      </div>
      <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--lt-track)' }}>
        {seg(counts.founders, GREEN)}
        {seg(counts.live, AMBER)}
        {seg(counts.drafts, 'var(--lt-faint)')}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
        {legend(GREEN, `${counts.founders} founding creative${counts.founders === 1 ? '' : 's'}`)}
        {legend(AMBER, `${counts.live} invite${counts.live === 1 ? '' : 's'} waiting`)}
        {legend('var(--lt-faint)', `${counts.drafts} draft${counts.drafts === 1 ? '' : 's'}`)}
      </div>
      <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 10, lineHeight: 1.5 }}>
        Drafts and sent codes hold a place. Cancelled and expired codes free theirs straight away, and so does a founding creative whose deal ends.
      </div>
    </div>
  )
}

function EmailPreviewModal({ preview, onClose }) {
  if (!preview) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--lt-modal-bg)', border: '1px solid var(--lt-modal-border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--lt-modal-shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--lt-hairline)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lt-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subject</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lt-text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview.subject}</div>
          </div>
          <button type="button" style={btn} onClick={onClose}>Close</button>
        </div>
        <iframe title="Email preview" srcDoc={preview.html} style={{ border: 'none', width: '100%', height: '70vh', background: '#0a0a0f' }} />
      </div>
    </div>
  )
}

function AddInviteForm({ available, onDone, onPreview }) {
  const [f, setF] = useState({ name: '', email: '', skill_type: 'Photographer', region: '', note: '' })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setError('') }

  async function submit(send) {
    if (!f.name.trim()) { setError('Add their name.'); return }
    if (!EMAIL_RE.test(f.email.trim())) { setError('Add a valid email address.'); return }
    setBusy(send ? 'send' : 'draft'); setError('')
    const res = await callInvites('create', { send, invites: [f] })
    setBusy('')
    if (!res.ok) { setError(res.problems?.[0]?.error || res.error); return }
    const sendErr = res.sent?.find((s) => !s.ok)?.error
    onDone(res, send && !sendErr ? `Invite sent to ${f.name.trim()}.` : sendErr ? `Saved as a draft, but the email didn't send: ${sendErr}` : `Saved ${f.name.trim()} as a draft.`)
    setF({ name: '', email: '', skill_type: f.skill_type, region: f.region, note: '' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div><label style={label}>Full name</label><input style={field} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Sarah Mitchell" /></div>
        <div><label style={label}>Email</label><input style={field} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="sarah@example.com" /></div>
        <div>
          <label style={label}>Creative type</label>
          <input style={field} list="fi-types" value={f.skill_type} onChange={(e) => set('skill_type', e.target.value)} />
        </div>
        <div>
          <label style={label}>Area</label>
          <input style={field} list="fi-regions" value={f.region} onChange={(e) => set('region', e.target.value)} placeholder="e.g. Brisbane" />
        </div>
      </div>
      <div>
        <label style={label}>Personal note (optional, shows at the top of their email)</label>
        <textarea style={{ ...field, minHeight: 70, resize: 'vertical' }} maxLength={1000} value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Loved your wedding work at Kings Beach. Would be great to have you on board." />
      </div>
      {error && <div style={{ fontSize: 13, color: PINK }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button type="button" style={btn} onClick={() => onPreview(f.name, f.note)}>Preview email</button>
        <button type="button" style={btn} disabled={!!busy || available <= 0} onClick={() => submit(false)}>{busy === 'draft' ? 'Saving…' : 'Save as draft'}</button>
        <button type="button" style={{ ...btnPrimary, opacity: available <= 0 ? 0.5 : 1 }} disabled={!!busy || available <= 0} onClick={() => submit(true)}>{busy === 'send' ? 'Sending…' : 'Add and send invite'}</button>
      </div>
    </div>
  )
}

function BulkAddForm({ available, onDone }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const rows = useMemo(() => parseBulk(text), [text])
  const bad = rows.filter((r) => r.problem)
  const good = rows.filter((r) => !r.problem)

  async function submit(send) {
    if (!good.length || bad.length) return
    if (good.length > available) { setError(`Only ${available} place${available === 1 ? '' : 's'} left. You're adding ${good.length}.`); return }
    setBusy(send ? 'send' : 'draft'); setError('')
    const res = await callInvites('create', { send, invites: good.map(({ name, email, skill_type, region }) => ({ name, email, skill_type, region })) })
    setBusy('')
    if (!res.ok) {
      setError(res.problems?.length ? res.problems.map((p) => `Row ${p.row}: ${p.error}`).join(' · ') : res.error)
      return
    }
    const sentOk = (res.sent || []).filter((s) => s.ok).length
    const sentBad = (res.sent || []).filter((s) => !s.ok).length
    const parts = [`Added ${res.created?.length || 0}`]
    if (send) parts.push(`sent ${sentOk}`)
    if (sentBad) parts.push(`${sentBad} email${sentBad === 1 ? '' : 's'} failed (left as drafts)`)
    if (res.failed?.length) parts.push(`${res.failed.length} skipped`)
    onDone(res, parts.join(', ') + '.')
    setText('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.55 }}>
        Paste one creative per line: <strong style={{ color: 'var(--lt-text)' }}>Name, email, type, area</strong>. Type and area are optional. You can paste straight from a spreadsheet. Add personal notes afterwards with Edit.
      </div>
      <textarea style={{ ...field, minHeight: 130, resize: 'vertical', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }} value={text} onChange={(e) => { setText(e.target.value); setError('') }}
        placeholder={'Sarah Mitchell, sarah@example.com, Photographer, Brisbane\nJames Lee, james@example.com, Videographer, Gold Coast'} />
      {rows.length > 0 && (
        <div style={{ fontSize: 13, color: 'var(--lt-muted)' }}>
          <strong style={{ color: GREEN }}>{good.length} ready</strong>{bad.length > 0 && <> · <strong style={{ color: PINK }}>{bad.length} to fix</strong></>}
          {bad.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: PINK }}>
              {bad.slice(0, 8).map((r) => <li key={r.line}>Line {r.line}: {r.problem}</li>)}
            </ul>
          )}
        </div>
      )}
      {error && <div style={{ fontSize: 13, color: PINK }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button type="button" style={{ ...btn, opacity: !good.length || bad.length ? 0.5 : 1 }} disabled={!!busy || !good.length || bad.length > 0} onClick={() => submit(false)}>{busy === 'draft' ? 'Saving…' : `Save ${good.length || ''} as drafts`}</button>
        <button type="button" style={{ ...btnPrimary, opacity: !good.length || bad.length ? 0.5 : 1 }} disabled={!!busy || !good.length || bad.length > 0} onClick={() => submit(true)}>{busy === 'send' ? 'Sending…' : `Add and send ${good.length || ''}`}</button>
      </div>
    </div>
  )
}

function EditInviteModal({ inv, onClose, onSaved }) {
  const [f, setF] = useState({ name: inv.full_name || '', email: inv.email || '', skill_type: inv.skill_type || '', region: inv.region || '', note: inv.personal_note || '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setError('') }
  async function save() {
    setBusy(true); setError('')
    const res = await callInvites('update', { id: inv.id, ...f })
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    onSaved(res.invite)
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: 'var(--lt-modal-bg)', border: '1px solid var(--lt-modal-border)', borderRadius: 16, padding: 20, boxShadow: 'var(--lt-modal-shadow)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>Edit invite <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--lt-muted)', fontSize: 13 }}>{inv.code}</span></div>
        <div><label style={label}>Full name</label><input style={field} value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div><label style={label}>Email</label><input style={field} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div><label style={label}>Creative type</label><input style={field} list="fi-types" value={f.skill_type} onChange={(e) => set('skill_type', e.target.value)} /></div>
          <div><label style={label}>Area</label><input style={field} list="fi-regions" value={f.region} onChange={(e) => set('region', e.target.value)} /></div>
        </div>
        <div><label style={label}>Personal note</label><textarea style={{ ...field, minHeight: 80, resize: 'vertical' }} maxLength={1000} value={f.note} onChange={(e) => set('note', e.target.value)} /></div>
        {inv.sent_at && <div style={{ fontSize: 12, color: 'var(--lt-faint)' }}>Changes show in the next email you send them. The code stays the same.</div>}
        {error && <div style={{ fontSize: 13, color: PINK }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" style={btn} onClick={onClose}>Close</button>
          <button type="button" style={btnPrimary} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

function InviteRow({ inv, founderName, busy, confirming, onAction, onConfirm, onEdit }) {
  const st = inviteState(inv)
  const k = st.key
  const canSend = k === 'draft' || k === 'sent' || k === 'reminded' || k === 'expired'
  const canCancel = k === 'draft' || k === 'sent' || k === 'reminded' || k === 'expired'
  const canExtend = k === 'sent' || k === 'reminded' || (k === 'expired' && inv.sent_at)
  const canEdit = k === 'draft' || k === 'sent' || k === 'reminded' || k === 'expired'
  const canCopy = k === 'draft' || k === 'sent' || k === 'reminded'
  const sendLabel = k === 'draft' ? 'Send' : k === 'expired' ? 'Resend (new 14 days)' : 'Resend'

  const meta = []
  if (inv.skill_type) meta.push(inv.skill_type)
  if (inv.region) meta.push(inv.region)
  if (k === 'signed_up') meta.push(`Joined ${fmtDate(inv.redeemed_at)}${founderName ? ` as ${founderName}` : ''}`)
  else if (inv.sent_at) meta.push(`First sent ${fmtDate(inv.sent_at)}${inv.send_count > 1 ? `, sent ${inv.send_count} times` : ''}`)
  else meta.push(`Added ${fmtDate(inv.created_at)}`)
  if (k === 'expired' && inv.expires_at) meta.push(`Expired ${fmtDate(inv.expires_at)}`)
  if (k === 'cancelled' && inv.cancelled_at) meta.push(`Cancelled ${fmtDate(inv.cancelled_at)}`)

  const confirmBox = (text, yesLabel, action) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <span style={{ fontSize: 12.5, color: 'var(--lt-muted)' }}>{text}</span>
      <button type="button" style={btn} onClick={() => onConfirm(null)}>No</button>
      <button type="button" style={action === 'cancel' ? btnDanger : btnPrimary} disabled={busy} onClick={() => onAction(inv, action)}>{yesLabel}</button>
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid var(--lt-hairline)', opacity: k === 'cancelled' ? 0.6 : 1 }}>
      <div style={{ minWidth: 220, flex: '1 1 260px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--lt-text)' }}>{inv.full_name || 'No name'}</span>
          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: 'var(--lt-muted)', letterSpacing: '0.03em' }}>{inv.code}</span>
          <Chip state={st} />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 3 }}>{inv.email}</div>
        <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 2 }}>{meta.join(' · ')}</div>
        {inv.email_error && k !== 'signed_up' && k !== 'cancelled' && <div style={{ fontSize: 12, color: PINK, marginTop: 3 }}>Last email failed: {inv.email_error}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {confirming === 'cancel' ? confirmBox('Cancel this code? It frees the place.', 'Yes, cancel', 'cancel')
          : confirming === 'copy' ? confirmBox('Copying starts their 14 days. Copy link?', 'Copy link', 'copy')
          : confirming === 'send' ? confirmBox(`Email ${inv.first_name || 'them'} now?`, sendLabel, 'send')
          : (
            <>
              {canSend && <button type="button" style={k === 'draft' ? btnPrimary : btn} disabled={busy} onClick={() => onConfirm('send')}>{busy === 'send' ? 'Sending…' : sendLabel}</button>}
              {canCopy && <button type="button" style={btn} disabled={busy} onClick={() => (k === 'draft' ? onConfirm('copy') : onAction(inv, 'copy'))}>Copy link</button>}
              {canExtend && k !== 'expired' && <button type="button" style={btn} disabled={busy} onClick={() => onAction(inv, 'extend')}>{busy === 'extend' ? 'Extending…' : '+14 days'}</button>}
              {canEdit && <button type="button" style={btn} disabled={busy} onClick={() => onEdit(inv)}>Edit</button>}
              {k === 'draft' && <button type="button" style={btnDanger} disabled={busy} onClick={() => onAction(inv, 'delete')}>Delete</button>}
              {canCancel && k !== 'draft' && <button type="button" style={btnDanger} disabled={busy} onClick={() => onConfirm('cancel')}>Cancel code</button>}
            </>
          )}
      </div>
    </div>
  )
}

const FILTERS = [
  { key: 'waiting', label: 'Waiting', match: (k) => k === 'draft' || k === 'sent' || k === 'reminded' },
  { key: 'signed_up', label: 'Signed up', match: (k) => k === 'signed_up' },
  { key: 'expired', label: 'Expired', match: (k) => k === 'expired' },
  { key: 'cancelled', label: 'Cancelled', match: (k) => k === 'cancelled' },
  { key: 'all', label: 'All', match: () => true },
]

export default function FoundingInvitesPanel() {
  const [open, setOpen] = useState(true)
  const [invites, setInvites] = useState([])
  const [founders, setFounders] = useState([])
  const [places, setPlaces] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [mode, setMode] = useState('single')
  const [filter, setFilter] = useState('waiting')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState({})
  const [confirming, setConfirming] = useState({})
  const [editing, setEditing] = useState(null)
  const [preview, setPreview] = useState(null)
  const flashTimer = useRef(0)

  const load = useCallback(async () => {
    const res = await callInvites('list')
    if (!res.ok) { setLoadError(res.error); setLoading(false); return }
    setInvites(res.invites || [])
    setFounders(res.founders || [])
    setPlaces(res.places || null)
    setLoadError('')
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const founderById = useMemo(() => {
    const m = {}
    founders.forEach((f) => { m[f.id] = f })
    return m
  }, [founders])

  const counts = useMemo(() => {
    let drafts = 0; let live = 0
    invites.forEach((i) => {
      const k = inviteState(i).key
      if (k === 'draft') drafts++
      else if (k === 'sent' || k === 'reminded') live++
    })
    const activeFounders = founders.filter((f) => f.founding_deal_status !== 'reverted' && !f.pending_deletion && !f.is_admin).length
    return { drafts, live, founders: activeFounders }
  }, [invites, founders])

  const filterCounts = useMemo(() => {
    const c = {}
    FILTERS.forEach((f) => { c[f.key] = invites.filter((i) => f.match(inviteState(i).key)).length })
    return c
  }, [invites])

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) || FILTERS[0]
    const q = search.trim().toLowerCase()
    return invites.filter((i) => f.match(inviteState(i).key))
      .filter((i) => !q || [i.full_name, i.email, i.code, i.region, i.skill_type].some((v) => String(v || '').toLowerCase().includes(q)))
  }, [invites, filter, search])

  function flash(text, tone = 'ok') {
    setNotice({ text, tone })
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setNotice(null), 6000)
  }

  function mergeInvite(inv) {
    if (!inv) return
    setInvites((prev) => (prev.some((p) => p.id === inv.id) ? prev.map((p) => (p.id === inv.id ? inv : p)) : [inv, ...prev]))
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true } catch { return false }
  }

  async function onAction(inv, action) {
    setConfirming((c) => ({ ...c, [inv.id]: null }))
    setBusy((b) => ({ ...b, [inv.id]: action }))
    let res
    if (action === 'copy') {
      if (!inv.sent_at) {
        res = await callInvites('send', { id: inv.id, manual: true })
        if (res.ok) { mergeInvite(res.invite); if (res.places) setPlaces(res.places) }
      } else res = { ok: true }
      if (res.ok) {
        const ok = await copyText(INVITE_BASE + encodeURIComponent(inv.code))
        flash(ok ? `Link copied for ${inv.full_name}. It works for 14 days.` : `Couldn't copy automatically. The link is ${INVITE_BASE}${inv.code}`)
      }
    } else if (action === 'delete') {
      res = await callInvites('delete', { id: inv.id })
      if (res.ok) { setInvites((prev) => prev.filter((p) => p.id !== inv.id)); if (res.places) setPlaces(res.places); flash(`Deleted the draft for ${inv.full_name}.`) }
    } else {
      res = await callInvites(action, { id: inv.id })
      if (res.ok) {
        mergeInvite(res.invite)
        if (res.places) setPlaces(res.places)
        if (action === 'send') flash(`Invite emailed to ${inv.full_name}.`)
        if (action === 'cancel') flash(`Cancelled ${inv.code}. The place is free again.`)
        if (action === 'extend') flash(`${inv.full_name}'s code now expires ${fmtDate(res.invite?.expires_at)}.`)
      }
    }
    if (res && !res.ok) { flash(res.error, 'error'); if (res.places) setPlaces(res.places); void load() }
    setBusy((b) => ({ ...b, [inv.id]: null }))
  }

  async function showPreview(name, note) {
    const res = await callInvites('preview', { name, note })
    if (res.ok) setPreview({ subject: res.subject, html: res.html })
    else flash(res.error, 'error')
  }

  function onCreated(res, message) {
    ;(res.created || []).slice().reverse().forEach(mergeInvite)
    if (res.places) setPlaces(res.places)
    setFilter('waiting')
    flash(message, res.sent?.some((s) => !s.ok) || res.failed?.length ? 'error' : 'ok')
  }

  const tab = (key, text) => (
    <button type="button" onClick={() => setMode(key)} style={{ ...btn, border: 'none', borderBottom: `2px solid ${mode === key ? GREEN : 'transparent'}`, borderRadius: 0, color: mode === key ? 'var(--lt-text)' : 'var(--lt-muted)', padding: '8px 4px', marginRight: 14 }}>{text}</button>
  )

  return (
    <div style={{ marginBottom: 20 }}>
      <datalist id="fi-types">{CREATIVE_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
      <datalist id="fi-regions">{REGIONS.map((r) => <option key={r} value={r} />)}</datalist>

      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', fontFamily: 'inherit' }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>Founding invites {places ? `(${places.used} of ${places.cap})` : ''}</span>
        <span style={{ color: 'var(--lt-muted)', fontSize: 13 }}>{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loadError ? (
            <div style={{ ...card, color: PINK, fontSize: 13.5 }}>Couldn't load invites: {loadError} <button type="button" style={{ ...btn, marginLeft: 8 }} onClick={() => { setLoading(true); void load() }}>Try again</button></div>
          ) : (
            <PlacesMeter places={places} counts={counts} />
          )}

          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--lt-hairline)' }}>
              {tab('single', 'Invite one creative')}
              {tab('bulk', 'Paste a list')}
            </div>
            {mode === 'single'
              ? <AddInviteForm available={places?.available ?? 0} onDone={onCreated} onPreview={showPreview} />
              : <BulkAddForm available={places?.available ?? 0} onDone={onCreated} />}
            <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 12, lineHeight: 1.5 }}>
              Each creative gets a personal code like SARAH-7KQ2 and an email from you, with replies going to connect@lenstrybe.com. Codes work once and expire 14 days after sending. A reminder goes out automatically when 7 days are left.
              {' '}<button type="button" onClick={() => callInvites('preview', { name: 'Sarah', kind: 'reminder' }).then((r) => r.ok && setPreview({ subject: r.subject, html: r.html }))} style={{ background: 'none', border: 'none', padding: 0, color: GREEN, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Preview the reminder</button>
            </div>
          </div>

          {notice && (
            <div style={{ ...card, padding: '10px 14px', fontSize: 13.5, color: notice.tone === 'error' ? PINK : 'var(--lt-text)', borderColor: notice.tone === 'error' ? 'rgba(255,45,120,0.4)' : 'rgba(29,185,84,0.4)' }}>{notice.text}</div>
          )}

          <div style={card}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {FILTERS.map((f) => (
                  <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                    style={{ ...btn, padding: '6px 12px', fontSize: 12.5, background: filter === f.key ? 'var(--lt-surface-2)' : 'transparent', borderColor: filter === f.key ? GREEN : 'var(--lt-border)' }}>
                    {f.label} <span style={{ color: 'var(--lt-faint)', fontWeight: 600 }}>{filterCounts[f.key] || 0}</span>
                  </button>
                ))}
              </div>
              <input style={{ ...field, width: 220, padding: '8px 12px', fontSize: 13 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or code" />
            </div>
            {loading ? (
              <div style={{ fontSize: 13, color: 'var(--lt-muted)', padding: '12px 0' }}>Loading…</div>
            ) : shown.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--lt-muted)', padding: '14px 0' }}>{invites.length === 0 ? 'No invites yet. Add your first creative above.' : 'Nothing here.'}</div>
            ) : (
              shown.map((inv) => (
                <InviteRow key={inv.id} inv={inv}
                  founderName={founderById[inv.redeemed_by]?.business_name || ''}
                  busy={busy[inv.id] || null}
                  confirming={confirming[inv.id] || null}
                  onAction={onAction}
                  onConfirm={(what) => setConfirming((c) => ({ ...c, [inv.id]: what }))}
                  onEdit={setEditing} />
              ))
            )}
          </div>
        </div>
      )}

      {editing && <EditInviteModal inv={editing} onClose={() => setEditing(null)} onSaved={(inv) => { mergeInvite(inv); setEditing(null); flash('Saved.') }} />}
      <EmailPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  )
}
