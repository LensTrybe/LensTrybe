import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

const PAGE = {
  bg: '#0a0a0f',
  text: 'rgb(242, 242, 242)',
  card: '#13131a',
  border: '#1e1e1e',
  border2: '#202027',
  inputBg: '#1a1a24',
  muted: '#888',
  sub: '#aaa',
  dim: '#555',
  green: '#39ff14',
  red: '#f87171',
  viewBg: '#1e2a1e',
}

const font = { fontFamily: 'Inter, sans-serif' }

function projectLabel(p) {
  return p.project_name ?? p.title ?? p.project_title ?? p.name ?? '—'
}

function statusBadgeStyle(status) {
  const s = String(status || 'draft').toLowerCase()
  const isActive = s === 'active' || s === 'published' || s === 'live'
  return {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '4px 10px',
    borderRadius: 6,
    border: `1px solid ${isActive ? PAGE.green : '#3f3f46'}`,
    background: isActive ? 'rgba(57, 255, 20, 0.1)' : '#1a1a1a',
    color: isActive ? PAGE.green : PAGE.dim,
    whiteSpace: 'nowrap',
    ...font,
  }
}

export default function ClientPortalsPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [portals, setPortals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    project_name: '',
    description: '',
    booking_id: '',
  })
  const [modalClientId, setModalClientId] = useState('')
  const [crmContacts, setCrmContacts] = useState([])
  const [bookings, setBookings] = useState([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  useEffect(() => {
    if (!user) return
    fetchPortals()
  }, [user])

  useEffect(() => {
    if (!user || !showModal) return
    const loadModalData = async () => {
      const [crm, book] = await Promise.all([
        supabase.from('crm_contacts').select('id, name, email').eq('creative_id', user.id).order('name'),
        supabase.from('bookings').select('id, client_name, status, created_at').eq('creative_id', user.id).order('created_at', { ascending: false }),
      ])
      setCrmContacts(crm.data || [])
      setBookings(book.data || [])
    }
    loadModalData()
  }, [user, showModal])

  const fetchPortals = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('client_portals')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
    setPortals(data || [])
    setLoading(false)
  }

  const createPortal = async () => {
    if (!form.client_name.trim()) return
    const insertRow = { ...form, creative_id: user.id }
    Object.keys(insertRow).forEach((k) => {
      if (insertRow[k] === '' || insertRow[k] === undefined) delete insertRow[k]
    })
    const { data, error } = await supabase.from('client_portals').insert(insertRow).select().single()
    if (!error && data) {
      setPortals((prev) => [data, ...prev])
      setShowModal(false)
      setModalClientId('')
      setForm({
        client_name: '',
        client_email: '',
        project_name: '',
        description: '',
        booking_id: '',
      })
    }
  }

  const deletePortal = async (id) => {
    await supabase.from('client_portals').delete().eq('id', id)
    setPortals((prev) => prev.filter((p) => p.id !== id))
  }

  const viewProfileHref = user?.id ? `/portfolio/${user.id}` : '/dashboard'

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
    padding: '14px 16px',
    borderBottom: `1px solid ${PAGE.border}`,
    verticalAlign: 'middle',
    ...font,
  }

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    color: PAGE.muted,
    marginBottom: 8,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    ...font,
  }

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    background: PAGE.inputBg,
    border: `1px solid ${PAGE.border2}`,
    borderRadius: 8,
    padding: '10px 14px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    ...font,
  }

  return (
    <>
      <div
        style={{
          background: PAGE.bg,
          color: PAGE.text,
          padding: 32,
          boxSizing: 'border-box',
          minHeight: '100%',
          ...font,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: PAGE.green,
                fontSize: 14,
                fontWeight: 600,
                ...font,
              }}
            >
              <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
                ←
              </span>
              Back
            </button>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', ...font }}>
              Client Portals
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link
              to={viewProfileHref}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: PAGE.muted,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                ...font,
              }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinejoin="round"
                />
                <circle cx={12} cy={12} r={2.5} stroke="currentColor" strokeWidth={1.75} />
              </svg>
              View Profile
            </Link>
            <button
              type="button"
              onClick={() => setShowModal(true)}
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
              + New Portal
            </button>
          </div>
        </header>

        <div
          style={{
            background: PAGE.card,
            border: `1px solid ${PAGE.border}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '16px 20px',
              borderBottom: `1px solid ${PAGE.border}`,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', ...font }}>
              Project Portals ({portals.length})
            </span>
            <button
              type="button"
              onClick={() => setShowModal(true)}
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
              + New Portal
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640, ...font }}>
              <thead>
                <tr>
                  <th style={thStyle}>Project</th>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: PAGE.muted, padding: 32 }}>
                      Loading…
                    </td>
                  </tr>
                ) : portals.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: 40, borderBottom: 'none' }}>
                      <div style={{ fontSize: 32, marginBottom: 14, lineHeight: 1 }} aria-hidden>
                        🔗
                      </div>
                      <div style={{ color: '#fff', fontSize: 14, fontWeight: 500, maxWidth: 400, margin: '0 auto', lineHeight: 1.5, ...font }}>
                        No portals yet. Create one to share project details with clients.
                      </div>
                    </td>
                  </tr>
                ) : (
                  portals.map((portal) => {
                    const url = `${window.location.origin}/portal/${portal.portal_token}`
                    return (
                      <tr key={portal.id}>
                        <td style={{ ...tdStyle, color: '#fff', fontWeight: 700, fontSize: 14 }}>{projectLabel(portal)}</td>
                        <td style={{ ...tdStyle, color: PAGE.sub, fontSize: 14 }}>{portal.client_name || '—'}</td>
                        <td style={tdStyle}>
                          <span style={statusBadgeStyle(portal.status)}>{portal.status || 'draft'}</span>
                        </td>
                        <td style={{ ...tdStyle, color: PAGE.muted, fontSize: 13 }}>
                          {portal.created_at
                            ? new Date(portal.created_at).toLocaleDateString([], {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-block',
                                background: PAGE.viewBg,
                                border: `1px solid ${PAGE.green}`,
                                color: PAGE.green,
                                borderRadius: 6,
                                padding: '4px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                textDecoration: 'none',
                                ...font,
                              }}
                            >
                              View
                            </a>
                            <button
                              type="button"
                              onClick={() => deletePortal(portal.id)}
                              style={{
                                background: 'none',
                                border: `1px solid ${PAGE.red}`,
                                color: PAGE.red,
                                borderRadius: 6,
                                padding: '4px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                ...font,
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
            padding: 16,
            boxSizing: 'border-box',
            ...font,
          }}
          onClick={() => setShowModal(false)}
          role="presentation"
        >
          <div
            style={{
              background: PAGE.card,
              border: `1px solid ${PAGE.border}`,
              borderRadius: 14,
              padding: 28,
              width: 480,
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#fff', ...font }}>
              Create Project Portal
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. Smith Wedding"
                  value={form.project_name}
                  onChange={(e) => setForm((p) => ({ ...p, project_name: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Project Description</label>
                <textarea
                  placeholder="Brief summary for your reference…"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                />
              </div>
              <div>
                <label style={labelStyle}>Select Client</label>
                <select
                  value={modalClientId}
                  onChange={(e) => {
                    const id = e.target.value
                    setModalClientId(id)
                    const c = crmContacts.find((x) => String(x.id) === id)
                    setForm((p) => ({
                      ...p,
                      client_name: c?.name || '',
                      client_email: c?.email || '',
                    }))
                  }}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="">Choose client…</option>
                  {crmContacts.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name || 'Unnamed'}
                      {c.email ? ` — ${c.email}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Link to Booking Optional</label>
                <select
                  value={form.booking_id}
                  onChange={(e) => setForm((p) => ({ ...p, booking_id: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="">Choose booking…</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {(b.client_name || 'Booking') + (b.created_at ? ` · ${new Date(b.created_at).toLocaleDateString()}` : '')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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
                  fontSize: 14,
                  ...font,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createPortal}
                style={{
                  background: PAGE.green,
                  border: 'none',
                  color: '#000',
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: '9px 20px',
                  cursor: 'pointer',
                  fontSize: 14,
                  ...font,
                }}
              >
                Create Portal
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
