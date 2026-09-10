import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const PINK = '#FF2D78'

// Deterministic avatar tint from a name, so each contact keeps a stable colour.
const AVATAR_COLORS = [
  ['#1DB954', '#04120a'], ['#FF2D78', '#2a0512'], ['#4A9EFF', '#04121f'],
  ['#f59e0b', '#241701'], ['#a855f7', '#160421'], ['#14b8a6', '#03130f'],
  ['#ef4444', '#210505'], ['#8b5cf6', '#120421'],
]
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
function colorFor(name) {
  const s = String(name || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function normUrl(u) {
  const s = String(u || '').trim()
  if (!s) return ''
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}
function instaHandle(v) {
  const s = String(v || '').trim().replace(/^@/, '')
  return s
}

function Avatar({ name, url, size = 44 }) {
  const [bg, fg] = colorFor(name)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: url ? 'transparent' : bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.36, fontFamily: 'inherit',
    }}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(name)}
    </div>
  )
}

function StyleBlock() {
  return (
    <style>{`
      .ltc-wrap { max-width: 760px; margin: 0 auto; padding: 6px 4px 60px; }
      .ltc-top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
      .ltc-search { flex: 1 1 220px; position: relative; }
      .ltc-search input {
        width: 100%; box-sizing: border-box; font-family: inherit; font-size: 14px; color: var(--lt-text);
        background: var(--lt-surface-2); border: 1px solid var(--lt-border); border-radius: 10px; padding: 10px 12px 10px 36px; outline: none;
        transition: border-color .15s ease, box-shadow .15s ease;
      }
      .ltc-search input:focus { border-color: ${GREEN}; box-shadow: 0 0 0 3px rgba(29,185,84,0.16); }
      .ltc-search svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--lt-faint); }
      .ltc-add { display: inline-flex; align-items: center; gap: 7px; background: ${GREEN}; color: ${GREEN_DARK}; border: none; border-radius: 10px; padding: 10px 16px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; white-space: nowrap; transition: filter .15s ease; }
      .ltc-add:hover { filter: brightness(1.06); }
      .ltc-sec { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: var(--lt-faint); padding: 14px 6px 6px; }
      .ltc-row { display: flex; align-items: center; gap: 13px; padding: 9px 10px; border-radius: 12px; cursor: pointer; transition: background .12s ease; }
      .ltc-row:hover { background: var(--lt-surface-2); }
      .ltc-name { font-size: 15px; font-weight: 600; color: var(--lt-text); line-height: 1.25; }
      .ltc-sub { font-size: 12.5px; color: var(--lt-muted); margin-top: 1px; }
      .ltc-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px; }
      .ltc-modal { width: 100%; max-width: 460px; max-height: 90vh; overflow-y: auto; background: var(--lt-surface); border: 1px solid var(--lt-border); border-radius: 18px; box-shadow: 0 24px 60px -18px rgba(0,0,0,0.5); }
      .ltc-label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--lt-faint); margin: 0 0 5px; }
      .ltc-input { width: 100%; box-sizing: border-box; font-family: inherit; font-size: 14px; color: var(--lt-text); background: var(--lt-surface-2); border: 1px solid var(--lt-border); border-radius: 10px; padding: 10px 12px; outline: none; transition: border-color .15s ease, box-shadow .15s ease; }
      .ltc-input:focus { border-color: ${GREEN}; box-shadow: 0 0 0 3px rgba(29,185,84,0.16); }
      textarea.ltc-input { resize: vertical; min-height: 74px; line-height: 1.5; }
      .ltc-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 10px; padding: 10px 18px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; border: none; transition: filter .15s ease, background .15s ease; }
      .ltc-btn-primary { background: ${GREEN}; color: ${GREEN_DARK}; }
      .ltc-btn-primary:hover { filter: brightness(1.06); }
      .ltc-btn-ghost { background: transparent; color: var(--lt-muted); border: 1px solid var(--lt-border); }
      .ltc-btn-ghost:hover { background: var(--lt-surface-2); }
      .ltc-action { flex: 1 1 0; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 12px 6px; border-radius: 12px; background: var(--lt-surface-2); border: 1px solid var(--lt-border); color: ${GREEN}; text-decoration: none; font-size: 12px; font-weight: 600; cursor: pointer; transition: background .12s ease; }
      .ltc-action:hover { background: var(--lt-surface); }
      .ltc-action[aria-disabled="true"] { opacity: 0.4; pointer-events: none; }
      .ltc-detrow { padding: 12px 4px; border-top: 1px solid var(--lt-hairline); }
    `}</style>
  )
}

const EMPTY = { name: '', phone: '', email: '', company: '', instagram: '', website: '', notes: '' }

export default function ContactsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)   // contact being viewed
  const [editing, setEditing] = useState(null)     // form object when adding/editing
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('contacts')
      .select('id, name, phone, email, company, notes, instagram, website, avatar_url, created_at')
      .order('name', { ascending: true })
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => [r.name, r.company, r.email, r.phone, r.instagram].some((v) => String(v || '').toLowerCase().includes(s)))
  }, [rows, q])

  const groups = useMemo(() => {
    const m = {}
    for (const r of filtered) {
      const c = (String(r.name || '').trim()[0] || '#').toUpperCase()
      const key = /[A-Z]/.test(c) ? c : '#'
      ;(m[key] = m[key] || []).push(r)
    }
    return Object.keys(m).sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b))).map((k) => [k, m[k]])
  }, [filtered])

  function openAdd() { setForm(EMPTY); setEditing({ mode: 'add' }); setError('') }
  function openEdit(c) { setForm({ name: c.name || '', phone: c.phone || '', email: c.email || '', company: c.company || '', instagram: c.instagram || '', website: c.website || '', notes: c.notes || '' }); setEditing({ mode: 'edit', id: c.id }); setError('') }

  async function save(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('A name is required.'); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      company: form.company.trim() || null,
      instagram: instaHandle(form.instagram) || null,
      website: form.website.trim() || null,
      notes: form.notes.trim() || null,
    }
    try {
      if (editing.mode === 'add') {
        const { data, error: e1 } = await supabase.from('contacts').insert({ ...payload, creative_id: user.id }).select().single()
        if (e1) throw e1
        setRows((prev) => [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))))
      } else {
        const { data, error: e2 } = await supabase.from('contacts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id).select().single()
        if (e2) throw e2
        setRows((prev) => prev.map((r) => (r.id === data.id ? data : r)).sort((a, b) => String(a.name).localeCompare(String(b.name))))
        if (selected?.id === data.id) setSelected(data)
      }
      setEditing(null)
    } catch {
      setError('Could not save this contact. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    try {
      await supabase.from('contacts').delete().eq('id', id)
      setRows((prev) => prev.filter((r) => r.id !== id))
      setSelected(null); setConfirmDelete(false)
    } catch { /* ignore */ }
  }

  return (
    <div className="ltc-wrap">
      <StyleBlock />

      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>Contacts</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--lt-muted)' }}>Your personal address book. Keep clients, collaborators and suppliers in one place.</p>
      </div>

      <div className="ltc-top">
        <label className="ltc-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts" />
        </label>
        <button type="button" className="ltc-add" onClick={openAdd}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add contact
        </button>
      </div>

      {loading && <div style={{ padding: '30px 6px', color: 'var(--lt-muted)', fontSize: 14 }}>Loading…</div>}

      {!loading && rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed var(--lt-border)', borderRadius: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)', marginBottom: 6 }}>No contacts yet</div>
          <div style={{ fontSize: 13.5, color: 'var(--lt-muted)', marginBottom: 18 }}>Add your first contact and it will be here whenever you need it.</div>
          <button type="button" className="ltc-add" onClick={openAdd} style={{ margin: '0 auto' }}>Add your first contact</button>
        </div>
      )}

      {!loading && rows.length > 0 && filtered.length === 0 && (
        <div style={{ padding: '30px 6px', color: 'var(--lt-muted)', fontSize: 14 }}>No contacts match “{q}”.</div>
      )}

      {!loading && groups.map(([letter, items]) => (
        <div key={letter}>
          <div className="ltc-sec">{letter}</div>
          {items.map((c) => (
            <div key={c.id} className="ltc-row" onClick={() => { setSelected(c); setConfirmDelete(false) }}>
              <Avatar name={c.name} url={c.avatar_url} />
              <div style={{ minWidth: 0 }}>
                <div className="ltc-name">{c.name}</div>
                {(c.company || c.phone || c.email) && <div className="ltc-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company || c.phone || c.email}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Detail card */}
      {selected && !editing && (
        <div className="ltc-overlay" onClick={() => setSelected(null)}>
          <div className="ltc-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '26px 24px 18px', textAlign: 'center' }}>
              <div style={{ display: 'inline-block', marginBottom: 12 }}><Avatar name={selected.name} url={selected.avatar_url} size={78} /></div>
              <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--lt-text)' }}>{selected.name}</div>
              {selected.company && <div style={{ fontSize: 14, color: 'var(--lt-muted)', marginTop: 2 }}>{selected.company}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <a className="ltc-action" href={selected.phone ? `tel:${selected.phone}` : undefined} aria-disabled={!selected.phone}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.27a2 2 0 0 1 2.11-.45c.74.34 1.53.57 2.34.7A2 2 0 0 1 22 16.92z" /></svg>
                  Call
                </a>
                <a className="ltc-action" href={selected.phone ? `sms:${selected.phone}` : undefined} aria-disabled={!selected.phone}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  Message
                </a>
                <a className="ltc-action" href={selected.email ? `mailto:${selected.email}` : undefined} aria-disabled={!selected.email}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></svg>
                  Email
                </a>
              </div>
            </div>

            <div style={{ padding: '0 24px' }}>
              {selected.phone && <DetailRow label="Phone" value={selected.phone} href={`tel:${selected.phone}`} />}
              {selected.email && <DetailRow label="Email" value={selected.email} href={`mailto:${selected.email}`} />}
              {selected.instagram && <DetailRow label="Instagram" value={`@${instaHandle(selected.instagram)}`} href={`https://instagram.com/${instaHandle(selected.instagram)}`} external />}
              {selected.website && <DetailRow label="Website" value={selected.website} href={normUrl(selected.website)} external />}
              {selected.notes && (
                <div className="ltc-detrow">
                  <div className="ltc-label">Notes</div>
                  <div style={{ fontSize: 14, color: 'var(--lt-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.notes}</div>
                </div>
              )}
            </div>

            <div style={{ padding: '18px 24px 22px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="ltc-btn ltc-btn-primary" onClick={() => openEdit(selected)}>Edit</button>
              <button type="button" className="ltc-btn ltc-btn-ghost" onClick={() => setSelected(null)}>Close</button>
              {!confirmDelete ? (
                <button type="button" className="ltc-btn ltc-btn-ghost" style={{ marginLeft: 'auto', color: PINK, borderColor: 'rgba(255,45,120,0.4)' }} onClick={() => setConfirmDelete(true)}>Delete</button>
              ) : (
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--lt-muted)' }}>Sure?</span>
                  <button type="button" className="ltc-btn ltc-btn-ghost" style={{ color: PINK, borderColor: 'rgba(255,45,120,0.4)', padding: '8px 14px' }} onClick={() => remove(selected.id)}>Delete</button>
                  <button type="button" className="ltc-btn ltc-btn-ghost" style={{ padding: '8px 14px' }} onClick={() => setConfirmDelete(false)}>Cancel</button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / edit form */}
      {editing && (
        <div className="ltc-overlay" onClick={() => setEditing(null)}>
          <div className="ltc-modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={save} style={{ padding: '22px 24px 24px' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--lt-text)', marginBottom: 16 }}>{editing.mode === 'add' ? 'New contact' : 'Edit contact'}</div>

              <div style={{ marginBottom: 12 }}>
                <label className="ltc-label" htmlFor="ltc-name">Name</label>
                <input id="ltc-name" className="ltc-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="ltc-label" htmlFor="ltc-phone">Phone</label>
                  <input id="ltc-phone" className="ltc-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" inputMode="tel" />
                </div>
                <div>
                  <label className="ltc-label" htmlFor="ltc-email">Email</label>
                  <input id="ltc-email" className="ltc-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="ltc-label" htmlFor="ltc-company">Company</label>
                <input id="ltc-company" className="ltc-input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company or business" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="ltc-label" htmlFor="ltc-insta">Instagram</label>
                  <input id="ltc-insta" className="ltc-input" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@handle" />
                </div>
                <div>
                  <label className="ltc-label" htmlFor="ltc-web">Website</label>
                  <input id="ltc-web" className="ltc-input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="website.com" />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="ltc-label" htmlFor="ltc-notes">Notes</label>
                <textarea id="ltc-notes" className="ltc-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything worth remembering" />
              </div>

              {error && <div style={{ marginBottom: 14, padding: '10px 13px', borderRadius: 10, background: 'rgba(255,45,120,0.12)', border: `1px solid ${PINK}`, color: PINK, fontSize: 13 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="ltc-btn ltc-btn-primary" disabled={saving}>{saving ? 'Saving…' : editing.mode === 'add' ? 'Add contact' : 'Save changes'}</button>
                <button type="button" className="ltc-btn ltc-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, href, external }) {
  return (
    <div className="ltc-detrow">
      <div className="ltc-label">{label}</div>
      {href
        ? <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} style={{ fontSize: 14.5, color: GREEN, textDecoration: 'none', wordBreak: 'break-word' }}>{value}</a>
        : <div style={{ fontSize: 14.5, color: 'var(--lt-text)', wordBreak: 'break-word' }}>{value}</div>}
    </div>
  )
}
