import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { GLASS_CARD, GLASS_CARD_GREEN, GLASS_MODAL_PANEL, GLASS_MODAL_OVERLAY_BASE, GLASS_NATIVE_FIELD, DIVIDER_GRADIENT_STYLE, TYPO, glassCardAccentBorder } from '../../lib/glassTokens'
import Button from '../../components/ui/Button'

const STAGES = ['Lead', 'In Discussion', 'Booked', 'Completed', 'Archived']

export default function CRMPage() {
  const { user } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [contacts, setContacts] = useState([])
  const [view, setView] = useState('list')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [showBookingDate, setShowBookingDate] = useState(false)
  const [bookingDateContact, setBookingDateContact] = useState(null)
  const [bookingDate, setBookingDate] = useState('')
  const [bookingService, setBookingService] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', status: 'Lead', notes: '' })

  useEffect(() => { if (user) loadContacts() }, [user])
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function loadContacts() {
    const { data } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
    setContacts(data ?? [])
  }

  async function createContact() {
    setSaving(true)
    const payload = {
      creative_id: user.id,
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      company: form.company || null,
      status: form.status,
      notes: form.notes || null,
    }
    console.log('Inserting:', payload)
    const { data, error } = await supabase.from('crm_contacts').insert(payload).select()
    console.log('Insert result:', data, error)
    if (!error) {
      await loadContacts()
      setShowCreate(false)
      setForm({ name: '', email: '', phone: '', company: '', status: 'Lead', notes: '' })
      showToast('Client added')
    } else {
      showToast(error.message, 'error')
    }
    setSaving(false)
  }

  async function updateContact(id, updates) {
    const { error } = await supabase.from('crm_contacts').update(updates).eq('id', id)
    if (!error) {
      if (updates.status === 'Booked') {
        let contact = contacts.find(c => c.id === id) ?? selected
        if (!contact) {
          const { data } = await supabase.from('crm_contacts').select('*').eq('id', id).single()
          contact = data
        }
        if (contact) {
          setBookingDateContact({ ...contact, ...updates })
          setBookingDate('')
          setBookingService('')
          setShowBookingDate(true)
        }
      }
      await loadContacts()
      if (selected?.id === id) setSelected(prev => ({ ...prev, ...updates }))
      showToast('Saved')
    } else {
      showToast(error.message, 'error')
    }
  }

  async function confirmBooking() {
    if (!bookingDateContact) return
    const { data, error } = await supabase.from('bookings').insert({
      creative_id: user.id,
      client_name: bookingDateContact.name,
      client_email: bookingDateContact.email ?? null,
      status: 'confirmed',
      booking_date: bookingDate || null,
      service: bookingService || null,
      notes: `Created from CRM${bookingDateContact.company ? ' — ' + bookingDateContact.company : ''}`,
    }).select()
    if (error) {
      showToast('Failed to create booking: ' + error.message, 'error')
    } else {
      setShowBookingDate(false)
      setBookingDateContact(null)
      showToast('Booking created')
    }
  }

  async function deleteContact(id) {
    if (!window.confirm('Delete this client?')) return
    await supabase.from('crm_contacts').delete().eq('id', id)
    setContacts(prev => prev.filter(c => c.id !== id))
    if (selected?.id === id) setSelected(null)
    showToast('Client deleted')
  }

  const filtered = contacts.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase())
  )

  const s = {
    page: { background: 'transparent', padding: isMobile ? '16px' : '32px 40px', fontFamily: 'var(--font-ui)', overflowX: 'hidden' },
    header: { display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '24px', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : '0' },
    title: { ...TYPO.heading, fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 400 },
    row: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexDirection: isMobile ? 'column' : 'row' },
    search: { ...GLASS_NATIVE_FIELD, flex: 1, padding: '9px 14px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', outline: 'none' },
    viewBtn: (active) => ({ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-default)', background: active ? 'var(--bg-elevated)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }),
    addBtn: { padding: '9px 18px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? '720px' : '100%' },
    th: { ...TYPO.label, textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.08)' },
    td: { ...TYPO.body, padding: '14px 16px', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' },
    badge: (status) => {
      const colors = { Lead: '#6b7280', 'In Discussion': '#3b82f6', Booked: '#1DB954', Completed: '#a855f7', Archived: '#374151' }
      const c = colors[status] ?? '#6b7280'
      return { padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: c + '22', color: c }
    },
    pipeline: { display: 'flex', gap: '16px', overflowX: isMobile ? 'hidden' : 'auto', paddingBottom: '16px', flexDirection: isMobile ? 'column' : 'row' },
    col: { minWidth: isMobile ? '100%' : '220px', flex: 1 },
    colHeader: { ...TYPO.label, fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px', padding: '0 4px' },
    card: { ...GLASS_CARD, borderRadius: '10px', padding: '14px', marginBottom: '10px', cursor: 'pointer', transition: 'border-color 0.15s' },
    modal: { position: 'fixed', inset: 0, ...GLASS_MODAL_OVERLAY_BASE, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '0' : '24px' },
    modalBox: { ...GLASS_MODAL_PANEL, borderRadius: isMobile ? '0' : '16px', width: '100%', maxWidth: isMobile ? '100vw' : '520px', minHeight: isMobile ? '100vh' : 'auto', padding: isMobile ? '16px' : '28px' },
    label: { ...TYPO.label, fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' },
    input: { ...GLASS_NATIVE_FIELD, width: '100%', padding: '9px 12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box', outline: 'none' },
    grid2: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' },
    actions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' },
    cancelBtn: { padding: '9px 18px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)' },
    mobileCardList: { display: 'flex', flexDirection: 'column', gap: '12px' },
    mobileCard: { ...GLASS_CARD, borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' },
    mobileCardRow: { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' },
  }

  return (
    <div style={s.page} className="crm-page">
      <style>{`
        @media (max-width: 767px) {
          .crm-page button { min-height: 44px; }
          .crm-page input, .crm-page textarea, .crm-page select { width: 100% !important; font-size: 14px !important; }
          .crm-page table { display: block; overflow-x: auto; }
        }
      `}</style>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: toast.type === 'success' ? '#1DB954' : '#ef4444', color: toast.type === 'success' ? '#000' : '#fff', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      <div style={s.header}>
        <div style={s.title}>CRM</div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>+ Add Client</Button>
      </div>

      <div style={s.row}>
        <input style={s.search} placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} />
        <button style={s.viewBtn(view === 'list')} onClick={() => setView('list')}>List</button>
        <button style={s.viewBtn(view === 'pipeline')} onClick={() => setView('pipeline')}>Pipeline</button>
      </div>

      {view === 'list' && (
        filtered.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            No clients yet. Click Add Client to get started.
          </div>
        ) : isMobile ? (
          <div style={s.mobileCardList}>
            {filtered.map((c) => (
              <div key={c.id} style={s.mobileCard} onClick={() => setSelected(c)}>
                <div style={s.mobileCardRow}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                  <span style={s.badge(c.status)}>{c.status}</span>
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{c.email ?? '—'}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Company: {c.company ?? '—'}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Phone: {c.phone ?? '—'}</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => deleteContact(c.id)} style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Name</th>
                <th style={s.th}>Email</th>
                <th style={s.th}>Company</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Phone</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={() => setSelected(c)}>
                  <td style={s.td}>{c.name}</td>
                  <td style={s.td}>{c.email ?? '—'}</td>
                  <td style={s.td}>{c.company ?? '—'}</td>
                  <td style={s.td}><span style={s.badge(c.status)}>{c.status}</span></td>
                  <td style={s.td}>{c.phone ?? '—'}</td>
                  <td style={s.td} onClick={e => e.stopPropagation()}>
                    <button onClick={() => deleteContact(c.id)} style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {view === 'pipeline' && (
        <div style={s.pipeline}>
          {STAGES.map(stage => (
            <div key={stage} style={s.col}>
              <div style={s.colHeader}>{stage} ({filtered.filter(c => c.status === stage).length})</div>
              {filtered.filter(c => c.status === stage).map(c => (
                <div
                  key={c.id}
                  style={s.card}
                  onClick={() => setSelected(c)}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#1DB954'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{c.name}</div>
                  {c.company && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.company}</div>}
                  {c.email && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.email}</div>}
                  <div style={{ marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>Stage</label>
                    <select
                      value={c.status}
                      onChange={e => {
                        e.stopPropagation()
                        void updateContact(c.id, { status: e.target.value })
                      }}
                      style={{ ...s.input, padding: '6px 8px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      {STAGES.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Add Client</div>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Name *</label>
                <input style={s.input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" />
              </div>
              <div>
                <label style={s.label}>Email</label>
                <input style={s.input} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" />
              </div>
            </div>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Phone</label>
                <input style={s.input} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="0400 000 000" />
              </div>
              <div>
                <label style={s.label}>Company</label>
                <input style={s.input} value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Smith Co." />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={s.label}>Status</label>
              <select style={{ ...s.input }} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {STAGES.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={s.label}>Notes</label>
              <textarea style={{ ...s.input, minHeight: '80px', resize: 'vertical' }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any notes…" />
            </div>
            <div style={s.actions}>
              <button style={s.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button style={{ ...s.addBtn, opacity: !form.name ? 0.5 : 1 }} disabled={saving || !form.name} onClick={createContact}>
                {saving ? 'Saving…' : 'Add Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View/Edit Modal */}
      {selected && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{selected.name}</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Name</label>
                <input style={s.input} defaultValue={selected.name} onBlur={e => updateContact(selected.id, { name: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Email</label>
                <input style={s.input} defaultValue={selected.email ?? ''} onBlur={e => updateContact(selected.id, { email: e.target.value || null })} />
              </div>
            </div>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Phone</label>
                <input style={s.input} defaultValue={selected.phone ?? ''} onBlur={e => updateContact(selected.id, { phone: e.target.value || null })} />
              </div>
              <div>
                <label style={s.label}>Company</label>
                <input style={s.input} defaultValue={selected.company ?? ''} onBlur={e => updateContact(selected.id, { company: e.target.value || null })} />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={s.label}>Status</label>
              <select style={{ ...s.input }} defaultValue={selected.status} onChange={e => updateContact(selected.id, { status: e.target.value })}>
                {STAGES.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={s.label}>Notes</label>
              <textarea style={{ ...s.input, minHeight: '80px', resize: 'vertical' }} defaultValue={selected.notes ?? ''} onBlur={e => updateContact(selected.id, { notes: e.target.value || null })} />
            </div>
            <div style={s.actions}>
              <button onClick={() => deleteContact(selected.id)} style={{ padding: '9px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Delete</button>
              <button style={s.cancelBtn} onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showBookingDate && bookingDateContact && (
        <div style={{ position: 'fixed', inset: 0, ...GLASS_MODAL_OVERLAY_BASE, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ ...GLASS_MODAL_PANEL, borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '28px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Create Booking</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>{bookingDateContact.name} has been moved to Booked.</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Job Date</label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={e => setBookingDate(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Service / Job Type</label>
                <input
                  value={bookingService}
                  onChange={e => setBookingService(e.target.value)}
                  placeholder="e.g. Wedding Photography, Brand Shoot..."
                  style={{ width: '100%', padding: '9px 12px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => { setShowBookingDate(false); setBookingDateContact(null); setBookingDate(''); setBookingService('') }}
                style={{ padding: '9px 18px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => void confirmBooking()}
                style={{ padding: '9px 18px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
              >
                Create Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
