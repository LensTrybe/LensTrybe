import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

const ROLES = ['Photographer', 'Videographer', 'Editor', 'Assistant', 'Second Shooter', 'Studio Manager', 'Social Media', 'Other']

const MODAL_ROLE_OPTIONS = ['Member', 'Admin', ...ROLES.filter((r) => r !== 'Member' && r !== 'Admin')]

const PAGE = {
  bg: '#0a0a0f',
  text: 'rgb(242, 242, 242)',
  card: '#13131a',
  border: '#1e1e1e',
  inner: '#1a1a24',
  innerBorder: '#202027',
  muted: '#888',
  dim: '#555',
  green: '#39ff14',
  red: '#f87171',
  ownerTint: '#1e2a1e',
  yellow: '#facc15',
}

const font = { fontFamily: 'Inter, sans-serif' }

const MAX_TEAM = 4

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0]?.[0] || '?').toUpperCase()
}

function isOwnerRole(role) {
  const r = String(role || '').toLowerCase()
  return r === 'owner'
}

function isAdminLikeRole(role) {
  const r = String(role || '').toLowerCase()
  return r === 'admin' || r === 'owner'
}

function buildInviteUrl(inviteToken) {
  return `${window.location.origin}/team/accept/${inviteToken}`
}

export default function TeamPage() {
  const [user, setUser] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [inviting, setInviting] = useState({})
  const [form, setForm] = useState({ name: '', email: '', role: 'Member', status: 'active' })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  async function fetchMembers() {
    setLoading(true)
    const { data } = await supabase.from('team_members').select('*').eq('creative_id', user.id).order('created_at', { ascending: false })
    setMembers(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    fetchMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch when user changes; fetchMembers closes over latest user
  }, [user])

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', email: '', role: 'Member', status: 'active' })
    setShowModal(true)
  }

  const openEdit = (m) => {
    setEditing(m)
    setForm({ name: m.name || '', email: m.email || '', role: m.role || 'Member', status: m.status || 'active' })
    setShowModal(true)
  }

  const saveMember = async () => {
    if (!form.name.trim()) return
    const payload = { ...form, creative_id: user.id }
    if (editing) {
      const { data } = await supabase.from('team_members').update(payload).eq('id', editing.id).select().single()
      setMembers((prev) => prev.map((m) => (m.id === editing.id ? data : m)))
    } else {
      const { data } = await supabase.from('team_members').insert(payload).select().single()
      setMembers((prev) => [data, ...prev])
    }
    setShowModal(false)
  }

  const deleteMember = async (id) => {
    await supabase.from('team_members').delete().eq('id', id)
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }

  const toggleStatus = async (m) => {
    const newStatus = m.status === 'active' ? 'inactive' : 'active'
    await supabase.from('team_members').update({ status: newStatus }).eq('id', m.id)
    setMembers((prev) => prev.map((mem) => (mem.id === m.id ? { ...mem, status: newStatus } : mem)))
  }

  const sendInvite = async (m) => {
    if (!m.email) return alert('This team member has no email address. Edit them to add one first.')
    setInviting((p) => ({ ...p, [m.id]: true }))
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const res = await fetch('https://lqafxisymvrazipaozfk.supabase.co/functions/v1/invite-team-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: m.name,
          email: m.email,
          role: m.role,
          creative_id: user.id,
          team_member_id: m.id,
        }),
      })
      const result = await res.json()
      if (result.success) {
        const inviteToken = result.inviteToken || result.invite_token || null
        setMembers((prev) =>
          prev.map((mem) =>
            mem.id === m.id
              ? { ...mem, invite_status: 'sent', invite_sent_at: new Date().toISOString(), invite_token: inviteToken ?? mem.invite_token }
              : mem,
          ),
        )
      } else {
        alert('Invite failed: ' + (result.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Invite failed: ' + err.message)
    }
    setInviting((p) => ({ ...p, [m.id]: false }))
  }

  const pendingInvites = members.filter((m) => m.invite_status === 'sent')
  const rosterMembers = members.filter((m) => m.invite_status !== 'sent')
  const activeRosterCount = rosterMembers.filter((m) => m.status === 'active').length

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    color: PAGE.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 600,
    marginBottom: 8,
  }

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    background: PAGE.inner,
    border: `1px solid ${PAGE.innerBorder}`,
    borderRadius: 8,
    padding: '10px 14px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    ...font,
  }

  const InviteBadge = ({ m }) => {
    if (!m.email) return null
    if (m.invite_status === 'sent') {
      const sentAt = m.invite_sent_at ? new Date(m.invite_sent_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''
      return (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 6,
            padding: '3px 8px',
            border: '1px solid #1e3a6a',
            color: '#93c5fd',
            background: '#0f172a',
          }}
        >
          Invited{sentAt ? ` ${sentAt}` : ''}
        </span>
      )
    }
    return (
      <button
        type="button"
        onClick={() => sendInvite(m)}
        disabled={inviting[m.id]}
        style={{
          background: '#0f172a',
          border: '1px solid #1e3a6a',
          borderRadius: 6,
          color: '#93c5fd',
          fontSize: 11,
          fontWeight: 700,
          padding: '5px 10px',
          cursor: inviting[m.id] ? 'not-allowed' : 'pointer',
          opacity: inviting[m.id] ? 0.6 : 1,
          ...font,
        }}
      >
        {inviting[m.id] ? 'Sending...' : 'Send Invite'}
      </button>
    )
  }

  const roleBadgeForMember = (m) => {
    if (isOwnerRole(m.role)) {
      return {
        label: 'Owner',
        style: {
          color: PAGE.green,
          border: `1px solid ${PAGE.green}`,
          background: PAGE.ownerTint,
        },
      }
    }
    if (isAdminLikeRole(m.role)) {
      return {
        label: m.role || 'Admin',
        style: {
          color: PAGE.green,
          border: `1px solid ${PAGE.green}`,
          background: PAGE.ownerTint,
        },
      }
    }
    return {
      label: m.role || 'Member',
      style: {
        color: '#aaa',
        border: `1px solid ${PAGE.innerBorder}`,
        background: PAGE.inner,
      },
    }
  }

  const renderMemberRow = (m, { dimAvatar = false } = {}) => {
    const rb = roleBadgeForMember(m)
    const showRemove = !isOwnerRole(m.role)

    return (
      <div
        key={m.id}
        style={{
          background: PAGE.inner,
          border: `1px solid ${PAGE.innerBorder}`,
          borderRadius: 10,
          padding: 16,
          marginBottom: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: dimAvatar ? '#2a2a2a' : PAGE.green,
              color: dimAvatar ? '#666' : '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 16,
              flexShrink: 0,
              ...font,
            }}
          >
            {initials(m.name)}
          </div>
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: 15, marginBottom: 2 }}>{m.name}</div>
            <div style={{ color: PAGE.muted, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.email || '—'}
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              padding: '3px 10px',
              flexShrink: 0,
              ...rb.style,
              ...font,
            }}
          >
            {rb.label}
          </span>
          {m.status === 'inactive' ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                padding: '3px 10px',
                color: PAGE.dim,
                border: `1px solid ${PAGE.innerBorder}`,
                background: PAGE.card,
                flexShrink: 0,
              }}
            >
              Inactive
            </span>
          ) : null}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => openEdit(m)}
              style={{
                background: 'none',
                border: `1px solid ${PAGE.innerBorder}`,
                color: '#aaa',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
                ...font,
              }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => toggleStatus(m)}
              style={{
                background: 'none',
                border: 'none',
                color: PAGE.dim,
                fontSize: 11,
                cursor: 'pointer',
                textDecoration: 'underline',
                ...font,
              }}
            >
              {m.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
            {showRemove ? (
              <button
                type="button"
                onClick={() => deleteMember(m.id)}
                style={{
                  background: 'none',
                  border: `1px solid ${PAGE.red}`,
                  color: PAGE.red,
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                  ...font,
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 2, borderTop: `1px solid ${PAGE.innerBorder}` }}>
          {m.email ? (
            <>
              <InviteBadge m={m} />
              {m.invite_status === 'sent' ? (
                <button
                  type="button"
                  onClick={() => sendInvite(m)}
                  disabled={inviting[m.id]}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: PAGE.dim,
                    fontSize: 11,
                    cursor: inviting[m.id] ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    ...font,
                  }}
                >
                  Resend
                </button>
              ) : null}
              {m.invite_status === 'sent' && m.invite_token ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(buildInviteUrl(m.invite_token))
                    } catch {
                      /* ignore */
                    }
                  }}
                  style={{
                    background: 'none',
                    border: `1px solid ${PAGE.innerBorder}`,
                    color: PAGE.muted,
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 11,
                    cursor: 'pointer',
                    ...font,
                  }}
                >
                  Copy invite link
                </button>
              ) : null}
            </>
          ) : (
            <span style={{ fontSize: 11, color: PAGE.dim, fontStyle: 'italic' }}>Add email to send invite</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <section
      style={{
        background: PAGE.bg,
        minHeight: '100vh',
        padding: 32,
        color: PAGE.text,
        ...font,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Link
          to="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 12,
            fontSize: 13,
            color: PAGE.green,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          ← Back
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 24,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff' }}>Team</h1>
          <button
            type="button"
            onClick={openNew}
            style={{
              background: PAGE.green,
              color: '#000',
              fontWeight: 700,
              borderRadius: 8,
              padding: '8px 18px',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              ...font,
            }}
          >
            + Invite Member
          </button>
        </div>

        {/* Team Members card */}
        <div
          style={{
            background: PAGE.card,
            border: `1px solid ${PAGE.border}`,
            borderRadius: 12,
            padding: 24,
            marginBottom: pendingInvites.length > 0 ? 24 : 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: '#fff',
                borderLeft: `3px solid ${PAGE.green}`,
                paddingLeft: 10,
                lineHeight: 1.2,
              }}
            >
              Team Members
            </h2>
            <span
              style={{
                background: PAGE.inner,
                border: `1px solid ${PAGE.innerBorder}`,
                borderRadius: 6,
                padding: '4px 10px',
                color: PAGE.muted,
                fontSize: 12,
              }}
            >
              ({activeRosterCount}/{MAX_TEAM})
            </span>
          </div>

          {loading ? (
            <p style={{ color: PAGE.muted, fontSize: 14, margin: 0, textAlign: 'center', padding: 40 }}>Loading...</p>
          ) : rosterMembers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>👥</div>
              <div style={{ color: '#fff', fontSize: 14 }}>No team members yet</div>
            </div>
          ) : (
            <>
              {rosterMembers.filter((m) => m.status === 'active').map((m) => renderMemberRow(m))}
              {rosterMembers.filter((m) => m.status === 'inactive').map((m) => renderMemberRow(m, { dimAvatar: true }))}
            </>
          )}
        </div>

        {/* Pending Invitations */}
        {pendingInvites.length > 0 ? (
          <div
            style={{
              background: PAGE.card,
              border: `1px solid ${PAGE.border}`,
              borderRadius: 12,
              padding: 24,
            }}
          >
            <h2
              style={{
                margin: '0 0 16px',
                fontSize: 16,
                fontWeight: 700,
                color: '#fff',
                borderLeft: `3px solid ${PAGE.green}`,
                paddingLeft: 10,
                lineHeight: 1.2,
              }}
            >
              Pending Invitations
            </h2>
            {pendingInvites.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  background: PAGE.inner,
                  border: `1px solid ${PAGE.innerBorder}`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 10,
                }}
              >
                <span style={{ color: '#aaa', fontSize: 14, wordBreak: 'break-all' }}>{m.email || m.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 6,
                      padding: '3px 10px',
                      color: PAGE.yellow,
                      border: '1px solid rgba(250, 204, 21, 0.35)',
                      background: 'rgba(250, 204, 21, 0.08)',
                    }}
                  >
                    Pending
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteMember(m.id)}
                    style={{
                      background: 'none',
                      border: `1px solid ${PAGE.red}`,
                      color: PAGE.red,
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                      ...font,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {showModal ? (
        <div
          role="presentation"
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
          }}
          onClick={() => setShowModal(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-modal-title"
            style={{
              background: PAGE.card,
              border: `1px solid ${PAGE.border}`,
              borderRadius: 14,
              padding: 28,
              width: 440,
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="invite-modal-title" style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#fff' }}>
              {editing ? 'Edit Team Member' : 'Invite Team Member'}
            </h2>

            <label style={labelStyle}>Full name</label>
            <input
              style={{ ...inputStyle, marginBottom: 16 }}
              placeholder="Alex Johnson"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />

            <label style={labelStyle}>Email Address</label>
            <input
              style={{ ...inputStyle, marginBottom: 16 }}
              type="email"
              placeholder="teammate@example.com"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />

            <label style={labelStyle}>Role</label>
            <select
              style={{ ...inputStyle, marginBottom: editing ? 16 : 20, cursor: 'pointer' }}
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
            >
              {[...new Set([form.role, ...MODAL_ROLE_OPTIONS].filter(Boolean))].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {editing ? (
              <>
                <label style={labelStyle}>Status</label>
                <select
                  style={{ ...inputStyle, marginBottom: 20, cursor: 'pointer' }}
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: `1px solid ${PAGE.innerBorder}`,
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
                onClick={saveMember}
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
                {editing ? 'Save' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
