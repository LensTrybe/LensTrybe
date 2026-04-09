import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

const PAGE = {
  bg: '#0a0a0f',
  text: 'rgb(242, 242, 242)',
  card: '#13131a',
  border: '#1e1e1e',
  border2: '#202027',
  inputBg: '#1a1a24',
  muted: '#888',
  dim: '#555',
  green: '#39ff14',
  tabActiveBg: '#1e2a1e',
}

const font = { fontFamily: 'Inter, sans-serif' }

const STATUS_COLORS = {
  lead: { bg: '#2a2a1a', border: '#4a4a1a', text: '#facc15' },
  active: { bg: '#1a2a1a', border: '#2a4a2a', text: '#39ff14' },
  past: { bg: '#1a1a2a', border: '#2a2a4a', text: '#818cf8' },
  vip: { bg: '#2a1a2a', border: '#4a1a4a', text: '#e879f9' },
  archived: { bg: '#1a1a1a', border: '#333', text: '#888' },
}

const STATUSES = ['lead', 'active', 'past', 'vip']

const KANBAN_COLUMNS = [
  { status: 'lead', label: 'Lead' },
  { status: 'active', label: 'In Discussion' },
  { status: 'vip', label: 'Booked' },
  { status: 'past', label: 'Completed' },
  { status: 'archived', label: 'Archived' },
]

function initials(name) {
  if (!name) return '?'
  const p = name.trim().split(/\s+/)
  if (p.length >= 2) return `${p[0][0]}${p[1][0]}`.toUpperCase()
  return name[0].toUpperCase()
}

function formatMoney(n) {
  const v = n == null || n === '' ? 0 : Number(n)
  if (Number.isNaN(v)) return '$0'
  return `$${v}`
}

function formatLastContact(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
}

function statusLabel(s) {
  const x = String(s || '').toLowerCase()
  if (x === 'active') return 'In Discussion'
  if (x === 'vip') return 'Booked'
  if (x === 'past') return 'Completed'
  if (x === 'archived') return 'Archived'
  return x.charAt(0).toUpperCase() + x.slice(1)
}

function matchesLastContactFilter(c, filterLastContact) {
  if (filterLastContact === 'all') return true
  const t = c.last_contacted_at
  if (filterLastContact === 'never') return !t
  if (!t) return false
  const days = (Date.now() - new Date(t).getTime()) / 86400000
  if (filterLastContact === '7d') return days <= 7
  if (filterLastContact === '30d') return days <= 30
  return true
}

const selectStyle = {
  background: PAGE.inputBg,
  border: `1px solid ${PAGE.border2}`,
  borderRadius: 8,
  padding: '0 12px',
  height: 40,
  color: PAGE.text,
  fontSize: 13,
  outline: 'none',
  cursor: 'pointer',
  ...font,
}

const smallActionBtn = {
  background: PAGE.inputBg,
  border: `1px solid ${PAGE.border2}`,
  color: PAGE.muted,
  borderRadius: 6,
  padding: '4px 12px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  ...font,
}

export default function CRMPage() {
  const [user, setUser] = useState(null)
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterLastContact, setFilterLastContact] = useState('all')
  const [mainTab, setMainTab] = useState('list')
  const [showModal, setShowModal] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    notes: '',
    status: 'lead',
    instagram: '',
    website: '',
    tags: '',
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  async function fetchContacts() {
    setLoading(true)
    const { data } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
    setContacts(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    fetchContacts()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchContacts closes over latest user
  }, [user])

  const openNew = () => {
    setEditingContact(null)
    setForm({
      name: '',
      email: '',
      phone: '',
      company: '',
      notes: '',
      status: 'lead',
      instagram: '',
      website: '',
      tags: '',
    })
    setShowModal(true)
  }

  const openEdit = (contact) => {
    setEditingContact(contact)
    setForm({
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      notes: contact.notes || '',
      status: contact.status || 'lead',
      instagram: contact.instagram || '',
      website: contact.website || '',
      tags: (contact.tags || []).join(', '),
    })
    setShowModal(true)
  }

  const saveContact = async () => {
    if (!form.name.trim()) return
    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      creative_id: user.id,
    }
    if (editingContact) {
      const { data } = await supabase.from('crm_contacts').update(payload).eq('id', editingContact.id).select().single()
      setContacts((prev) => prev.map((c) => (c.id === editingContact.id ? data : c)))
    } else {
      const { data } = await supabase.from('crm_contacts').insert(payload).select().single()
      setContacts((prev) => [data, ...prev])
    }
    setShowModal(false)
  }

  const deleteContact = async (id) => {
    await supabase.from('crm_contacts').delete().eq('id', id)
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }

  const updateStatus = async (id, status) => {
    await supabase.from('crm_contacts').update({ status }).eq('id', id)
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
  }

  const filtered = contacts.filter((c) => {
    const matchSearch =
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.company?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    const matchLc = matchesLastContactFilter(c, filterLastContact)
    return matchSearch && matchStatus && matchLc
  })

  const shellStyle = {
    background: PAGE.bg,
    color: PAGE.text,
    padding: 32,
    boxSizing: 'border-box',
    minHeight: '100%',
    ...font,
  }

  const inputBase = {
    background: PAGE.inputBg,
    border: `1px solid ${PAGE.border2}`,
    borderRadius: 8,
    padding: '0 12px',
    height: 40,
    color: '#fff',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    ...font,
  }

  const thStyle = {
    textAlign: 'left',
    color: PAGE.muted,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '12px 16px',
    borderBottom: `1px solid ${PAGE.border}`,
    whiteSpace: 'nowrap',
    ...font,
  }

  const tdStyle = {
    padding: '12px 16px',
    borderBottom: `1px solid ${PAGE.border}`,
    verticalAlign: 'middle',
    ...font,
  }

  return (
    <>
      <div style={shellStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff', ...font }}>CRM</h1>
          <button
            type="button"
            onClick={openNew}
            style={{
              background: PAGE.green,
              color: '#000',
              fontWeight: 700,
              border: 'none',
              borderRadius: 8,
              padding: '8px 18px',
              fontSize: 13,
              cursor: 'pointer',
              ...font,
            }}
          >
            + Add Client
          </button>
        </div>

        <div
          style={{
            display: 'inline-flex',
            background: PAGE.card,
            border: `1px solid ${PAGE.border}`,
            borderRadius: 10,
            padding: 4,
            gap: 4,
            marginBottom: 20,
            ...font,
          }}
        >
          <button
            type="button"
            onClick={() => setMainTab('list')}
            style={{
              border: mainTab === 'list' ? `1px solid ${PAGE.green}` : '1px solid transparent',
              background: mainTab === 'list' ? PAGE.tabActiveBg : 'transparent',
              color: mainTab === 'list' ? PAGE.green : PAGE.muted,
              borderRadius: 8,
              padding: '6px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              ...font,
            }}
          >
            Client List
          </button>
          <button
            type="button"
            onClick={() => setMainTab('pipeline')}
            style={{
              border: mainTab === 'pipeline' ? `1px solid ${PAGE.green}` : '1px solid transparent',
              background: mainTab === 'pipeline' ? PAGE.tabActiveBg : 'transparent',
              color: mainTab === 'pipeline' ? PAGE.green : PAGE.muted,
              borderRadius: 8,
              padding: '6px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              ...font,
            }}
          >
            Pipeline
          </button>
        </div>

        {mainTab === 'list' ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 20,
              }}
            >
              <div style={{ flex: '1 1 240px', minWidth: 200, position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 14,
                    opacity: 0.5,
                    pointerEvents: 'none',
                  }}
                  aria-hidden
                >
                  🔍
                </span>
                <input
                  placeholder="Search by name, email, company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ ...inputBase, width: '100%', paddingLeft: 36 }}
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ ...selectStyle, minWidth: 160 }}
                aria-label="Filter by stage"
              >
                <option value="all">All Stages</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
              <select
                value={filterLastContact}
                onChange={(e) => setFilterLastContact(e.target.value)}
                style={{ ...selectStyle, minWidth: 160 }}
                aria-label="Filter by last contact"
              >
                <option value="all">Last Contact</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="never">Never contacted</option>
              </select>
            </div>

            <div
              style={{
                background: PAGE.card,
                border: `1px solid ${PAGE.border}`,
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, ...font }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Stage</th>
                      <th style={thStyle}>Total Spend</th>
                      <th style={thStyle}>Last Contact</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: PAGE.muted, padding: 32 }}>
                          Loading…
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', padding: 40, borderBottom: 'none' }}>
                          <div style={{ fontSize: 32, marginBottom: 12, lineHeight: 1 }} aria-hidden>
                            👥
                          </div>
                          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, ...font }}>No clients found</div>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((c) => {
                        const sc = STATUS_COLORS[c.status] || STATUS_COLORS.lead
                        return (
                          <tr key={c.id}>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: PAGE.green,
                                    color: '#000',
                                    fontWeight: 700,
                                    fontSize: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    ...font,
                                  }}
                                >
                                  {initials(c.name)}
                                </div>
                                <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, ...font }}>{c.name}</span>
                              </div>
                            </td>
                            <td style={{ ...tdStyle, color: PAGE.muted, fontSize: 13 }}>{c.email || '—'}</td>
                            <td style={tdStyle}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  fontSize: 10,
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.06em',
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  border: `1px solid ${sc.border}`,
                                  background: sc.bg,
                                  color: sc.text,
                                  whiteSpace: 'nowrap',
                                  ...font,
                                }}
                              >
                                {statusLabel(c.status)}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, color: '#fff', fontWeight: 600, fontSize: 14 }}>
                              {formatMoney(c.total_spent)}
                            </td>
                            <td style={{ ...tdStyle, color: PAGE.muted, fontSize: 13 }}>
                              {formatLastContact(c.last_contacted_at)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <button type="button" style={smallActionBtn} onClick={() => openEdit(c)}>
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  style={{ ...smallActionBtn, borderColor: '#3f3f46' }}
                                  onClick={() => {
                                    if (window.confirm('Delete this client?')) deleteContact(c.id)
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 16,
              overflowX: 'auto',
              paddingBottom: 8,
              ...font,
            }}
          >
            {loading ? (
              <div style={{ color: PAGE.muted, padding: 24 }}>Loading…</div>
            ) : (
              KANBAN_COLUMNS.map((col) => {
                const colContacts = contacts.filter((c) => c.status === col.status)
                return (
                  <div
                    key={col.status}
                    style={{
                      flex: '0 0 auto',
                      minWidth: 200,
                      background: PAGE.card,
                      border: `1px solid ${PAGE.border}`,
                      borderRadius: 12,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      maxHeight: 'calc(100dvh - 280px)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        marginBottom: 14,
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, ...font }}>{col.label}</span>
                      <span
                        style={{
                          background: PAGE.green,
                          color: '#000',
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 999,
                          ...font,
                        }}
                      >
                        {colContacts.length}
                      </span>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                      {colContacts.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            background: PAGE.inputBg,
                            border: `1px solid ${PAGE.border2}`,
                            borderRadius: 8,
                            padding: 12,
                            marginBottom: 8,
                            ...font,
                          }}
                        >
                          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 4, ...font }}>
                            {c.name}
                          </div>
                          <div style={{ color: PAGE.muted, fontSize: 12, marginBottom: 8, ...font }}>
                            {c.email || '—'}
                          </div>
                          <select
                            value={c.status}
                            onChange={(e) => updateStatus(c.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              background: PAGE.bg,
                              border: `1px solid ${PAGE.border2}`,
                              borderRadius: 6,
                              padding: '4px 6px',
                              color: PAGE.muted,
                              fontSize: 11,
                              cursor: 'pointer',
                              ...font,
                            }}
                            aria-label={`Move ${c.name} to stage`}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {statusLabel(s)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {showModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            ...font,
          }}
          onClick={() => setShowModal(false)}
          role="presentation"
        >
          <div
            style={{
              background: PAGE.inputBg,
              border: `1px solid ${PAGE.border2}`,
              borderRadius: 16,
              padding: 28,
              width: 480,
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 20px', ...font }}>
              {editingContact ? 'Edit Client' : 'New Client'}
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: PAGE.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Name *
                </label>
                <input
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  style={{
                    background: PAGE.bg,
                    border: `1px solid ${PAGE.border2}`,
                    borderRadius: 8,
                    padding: '9px 12px',
                    color: PAGE.text,
                    fontSize: 13,
                    outline: 'none',
                    ...font,
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: PAGE.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Company
                </label>
                <input
                  placeholder="Acme Co."
                  value={form.company}
                  onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                  style={{
                    background: PAGE.bg,
                    border: `1px solid ${PAGE.border2}`,
                    borderRadius: 8,
                    padding: '9px 12px',
                    color: PAGE.text,
                    fontSize: 13,
                    outline: 'none',
                    ...font,
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: PAGE.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Email
                </label>
                <input
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  style={{
                    background: PAGE.bg,
                    border: `1px solid ${PAGE.border2}`,
                    borderRadius: 8,
                    padding: '9px 12px',
                    color: PAGE.text,
                    fontSize: 13,
                    outline: 'none',
                    ...font,
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: PAGE.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Phone
                </label>
                <input
                  placeholder="+61 400 000 000"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  style={{
                    background: PAGE.bg,
                    border: `1px solid ${PAGE.border2}`,
                    borderRadius: 8,
                    padding: '9px 12px',
                    color: PAGE.text,
                    fontSize: 13,
                    outline: 'none',
                    ...font,
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: PAGE.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Instagram
                </label>
                <input
                  placeholder="@username"
                  value={form.instagram}
                  onChange={(e) => setForm((p) => ({ ...p, instagram: e.target.value }))}
                  style={{
                    background: PAGE.bg,
                    border: `1px solid ${PAGE.border2}`,
                    borderRadius: 8,
                    padding: '9px 12px',
                    color: PAGE.text,
                    fontSize: 13,
                    outline: 'none',
                    ...font,
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: PAGE.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Website
                </label>
                <input
                  placeholder="https://..."
                  value={form.website}
                  onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                  style={{
                    background: PAGE.bg,
                    border: `1px solid ${PAGE.border2}`,
                    borderRadius: 8,
                    padding: '9px 12px',
                    color: PAGE.text,
                    fontSize: 13,
                    outline: 'none',
                    ...font,
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: PAGE.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  style={{
                    background: PAGE.bg,
                    border: `1px solid ${PAGE.border2}`,
                    borderRadius: 8,
                    padding: '9px 12px',
                    color: PAGE.text,
                    fontSize: 13,
                    outline: 'none',
                    cursor: 'pointer',
                    ...font,
                  }}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: PAGE.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Tags (comma separated)
                </label>
                <input
                  placeholder="wedding, portrait"
                  value={form.tags}
                  onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                  style={{
                    background: PAGE.bg,
                    border: `1px solid ${PAGE.border2}`,
                    borderRadius: 8,
                    padding: '9px 12px',
                    color: PAGE.text,
                    fontSize: 13,
                    outline: 'none',
                    ...font,
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: PAGE.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Notes
                </label>
                <textarea
                  placeholder="Any notes about this contact..."
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  style={{
                    background: PAGE.bg,
                    border: `1px solid ${PAGE.border2}`,
                    borderRadius: 8,
                    padding: '9px 12px',
                    color: PAGE.text,
                    fontSize: 13,
                    outline: 'none',
                    minHeight: 80,
                    resize: 'vertical',
                    ...font,
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: `1px solid ${PAGE.border2}`,
                  color: PAGE.muted,
                  borderRadius: 8,
                  padding: '9px 18px',
                  cursor: 'pointer',
                  fontSize: 13,
                  ...font,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveContact}
                style={{
                  background: PAGE.green,
                  border: 'none',
                  color: '#000',
                  borderRadius: 8,
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  ...font,
                }}
              >
                {editingContact ? 'Save Changes' : 'Add Client'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
