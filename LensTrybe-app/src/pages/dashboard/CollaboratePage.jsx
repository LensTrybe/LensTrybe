import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { normalizeSubscriptionTier } from '../../lib/tierFeatures'
import { GLASS_CARD, GLASS_NATIVE_FIELD, TYPO } from '../../lib/glassTokens'
import Button from '../../components/ui/Button'

const BG = '#0a0a0f'
const GREEN = '#1DB954'
const PINK = '#FF2D78'
const WHITE = '#ffffff'
const MUTED = '#8888aa'
const DIM = '#444466'
const BORDER = '#1e1e2e'
const PANEL = '#111118'
const FONT = { fontFamily: 'Inter, sans-serif' }

const SPECIALTIES = [
  'Photographer',
  'Videographer',
  'Drone Pilot',
  'Video Editor',
  'Photo Editor',
  'Social Media Manager',
  'Hair & Makeup Artist',
  'UGC Creator',
]

const TIER_BADGE = {
  basic: { bg: 'rgba(136,136,170,0.12)', color: MUTED },
  pro: { bg: 'rgba(74,158,255,0.12)', color: '#4A9EFF' },
  expert: { bg: 'rgba(245,166,35,0.12)', color: '#F5A623' },
  elite: { bg: 'rgba(29,185,84,0.12)', color: GREEN },
}

function TierBadge({ tier }) {
  const t = (tier || 'basic').toLowerCase()
  const cfg = TIER_BADGE[t] || TIER_BADGE.basic
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 20,
        background: cfg.bg,
        color: cfg.color,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {t}
    </span>
  )
}

function initialsFromProfile(p, email) {
  const n = (p?.business_name || email || '?').trim()
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2)
  return n.slice(0, 2).toUpperCase() || '?'
}

function firstSkillLabel(skillTypes) {
  if (!skillTypes) return 'Creative'
  if (Array.isArray(skillTypes) && skillTypes.length) return String(skillTypes[0])
  if (typeof skillTypes === 'string') return skillTypes.split(',')[0]?.trim() || 'Creative'
  return 'Creative'
}

function formatAuDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function workTypeLabel(w) {
  if (w === 'remote') return 'Remote'
  if (w === 'on-location') return 'On location'
  if (w === 'both') return 'On location or remote'
  return w || ''
}

function UpgradePrompt({ onNavigateSettings }) {
  return (
    <div
      style={{
        ...GLASS_CARD,
        borderRadius: 14,
        padding: '28px 24px',
        textAlign: 'center',
        maxWidth: 480,
        margin: '32px auto',
        border: `1px solid ${BORDER}`,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: WHITE, marginBottom: 10, ...TYPO.heading }}>Upgrade to unlock</div>
      <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.55, marginBottom: 20, ...TYPO.body }}>
        Collaboration posting, invites, and full hub tools are on Pro, Expert, and Elite. Upgrade your plan to post collabs, invite creatives, and manage everything in one place.
      </p>
      <Button type="button" variant="primary" onClick={onNavigateSettings}>
        View plans and upgrade
      </Button>
    </div>
  )
}

async function findExistingCreativeThread(userId, otherId) {
  const { data: a } = await supabase
    .from('message_threads')
    .select('id')
    .eq('creative_id', userId)
    .eq('client_user_id', otherId)
    .maybeSingle()
  if (a?.id) return a.id
  const { data: b } = await supabase
    .from('message_threads')
    .select('id')
    .eq('creative_id', otherId)
    .eq('client_user_id', userId)
    .maybeSingle()
  return b?.id ?? null
}

async function createCreativeThread({ ownerId, otherId, otherProfile, subject }) {
  const existing = await findExistingCreativeThread(ownerId, otherId)
  if (existing) return existing
  const name = otherProfile?.business_name || 'Creative'
  const email = otherProfile?.business_email || `${otherId.slice(0, 8)}@placeholder.lenstrybe`
  const { data, error } = await supabase
    .from('message_threads')
    .insert({
      creative_id: ownerId,
      client_user_id: otherId,
      client_name: name,
      client_email: email,
      subject: subject || 'Collaboration',
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export default function CollaboratePage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('browse')
  const [toast, setToast] = useState(null)
  const [loadingBrowse, setLoadingBrowse] = useState(true)
  const [browseRows, setBrowseRows] = useState([])
  const [filterSpecialty, setFilterSpecialty] = useState('all')
  const [filterWork, setFilterWork] = useState('all')
  const [paidOnly, setPaidOnly] = useState(false)
  const [sortOrder, setSortOrder] = useState('newest')
  const [expandedBriefId, setExpandedBriefId] = useState(null)

  const [postRoles, setPostRoles] = useState([])
  const [postWork, setPostWork] = useState('on-location')
  const [postArrangement, setPostArrangement] = useState('one-off')
  const [postLocation, setPostLocation] = useState('')
  const [postTimeline, setPostTimeline] = useState('')
  const [postBudgetType, setPostBudgetType] = useState('tfp')
  const [postAmount, setPostAmount] = useState('')
  const [postBrief, setPostBrief] = useState('')
  const [postSubmitting, setPostSubmitting] = useState(false)

  const [myInvites, setMyInvites] = useState([])
  const [myCollabs, setMyCollabs] = useState([])
  const [loadingMy, setLoadingMy] = useState(false)

  const [inviteSearch, setInviteSearch] = useState('')
  const [inviteResults, setInviteResults] = useState([])
  const [invitePanelId, setInvitePanelId] = useState(null)
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteSending, setInviteSending] = useState(false)

  const tierKey = normalizeSubscriptionTier(profile?.subscription_tier)
  const isBasic = tierKey === 'basic'
  const canUsePaidFeatures = !isBasic

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }, [])

  const loadBrowse = useCallback(async () => {
    if (!user) return
    setLoadingBrowse(true)
    try {
      const { data: collabs, error: cErr } = await supabase
        .from('collaborations')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
      if (cErr) throw cErr
      const rows = collabs ?? []
      const posterIds = [...new Set(rows.map((r) => r.posted_by).filter(Boolean))]
      let profileById = {}
      if (posterIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, business_name, avatar_url, subscription_tier, skill_types, business_email')
          .in('id', posterIds)
          .eq('is_admin', false)
        for (const p of profs ?? []) profileById[p.id] = p
      }
      setBrowseRows(
        rows.map((c) => ({
          ...c,
          poster: profileById[c.posted_by] || null,
        })),
      )
    } catch (e) {
      console.error(e)
      showToast(e?.message || 'Could not load collaborations', 'error')
      setBrowseRows([])
    } finally {
      setLoadingBrowse(false)
    }
  }, [user, showToast])

  const loadMy = useCallback(async () => {
    if (!user) return
    setLoadingMy(true)
    try {
      const [{ data: sent }, { data: recv }, { data: own }] = await Promise.all([
        supabase.from('collaboration_invites').select('*, collaborations(*)').eq('from_creative_id', user.id),
        supabase.from('collaboration_invites').select('*, collaborations(*)').eq('to_creative_id', user.id),
        supabase.from('collaborations').select('*').eq('posted_by', user.id),
      ])
      const merged = [...(sent ?? []), ...(recv ?? [])]
      const uniq = new Map()
      for (const inv of merged) {
        if (!uniq.has(inv.id)) uniq.set(inv.id, inv)
      }
      setMyInvites([...uniq.values()])
      setMyCollabs(own ?? [])
    } catch (e) {
      console.error(e)
      showToast(e?.message || 'Could not load your collaborations', 'error')
    } finally {
      setLoadingMy(false)
    }
  }, [user, showToast])

  useEffect(() => {
    loadBrowse()
  }, [loadBrowse])

  useEffect(() => {
    if (tab === 'my' && user) loadMy()
  }, [tab, user, loadMy])

  const filteredBrowse = useMemo(() => {
    let list = [...browseRows]
    if (filterSpecialty !== 'all') {
      list = list.filter((c) => (c.roles_needed || []).includes(filterSpecialty))
    }
    if (filterWork !== 'all') {
      list = list.filter((c) => c.work_type === filterWork || c.work_type === 'both')
    }
    if (paidOnly) list = list.filter((c) => c.budget_type === 'paid')
    const eliteFirst = (a, b) => {
      const ae = (a.poster?.subscription_tier || '').toLowerCase() === 'elite' ? 1 : 0
      const be = (b.poster?.subscription_tier || '').toLowerCase() === 'elite' ? 1 : 0
      if (be !== ae) return be - ae
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return sortOrder === 'newest' ? tb - ta : ta - tb
    }
    list.sort(eliteFirst)
    return list
  }, [browseRows, filterSpecialty, filterWork, paidOnly, sortOrder])

  const pendingInvites = useMemo(
    () => myInvites.filter((i) => i.status === 'pending'),
    [myInvites],
  )
  const acceptedInvites = useMemo(
    () => myInvites.filter((i) => i.status === 'accepted'),
    [myInvites],
  )
  const completedCollabs = useMemo(
    () => myCollabs.filter((c) => c.status === 'completed'),
    [myCollabs],
  )

  async function expressInterest(collab) {
    if (!user || collab.posted_by === user.id) return
    try {
      const { data: existing } = await supabase
        .from('collaboration_invites')
        .select('id')
        .eq('collaboration_id', collab.id)
        .eq('from_creative_id', user.id)
        .eq('status', 'pending')
        .maybeSingle()
      if (existing) {
        showToast('You already expressed interest in this collab', 'error')
        return
      }
      const { error } = await supabase.from('collaboration_invites').insert({
        collaboration_id: collab.id,
        from_creative_id: user.id,
        to_creative_id: collab.posted_by,
        status: 'pending',
        message: null,
      })
      if (error) throw error
      showToast('Interest sent. The poster will be notified.')
    } catch (e) {
      showToast(e?.message || 'Could not send interest', 'error')
    }
  }

  async function submitCollabPost(e) {
    e.preventDefault()
    if (!user || !canUsePaidFeatures) return
    if (!postRoles.length) {
      showToast('Choose at least one role you need', 'error')
      return
    }
    if (postBrief.trim().length > 500) {
      showToast('Brief must be 500 characters or fewer', 'error')
      return
    }
    setPostSubmitting(true)
    try {
      const payload = {
        posted_by: user.id,
        roles_needed: postRoles,
        work_type: postWork,
        arrangement: postArrangement,
        location: postWork === 'remote' ? null : postLocation.trim() || null,
        timeline: postTimeline.trim() || null,
        budget_type: postBudgetType,
        budget_amount:
          postBudgetType === 'paid' && postAmount ? Number.parseFloat(postAmount) : null,
        brief: postBrief.trim(),
        status: 'open',
      }
      const { error } = await supabase.from('collaborations').insert(payload)
      if (error) throw error
      showToast('Your collaboration post is live.')
      setPostRoles([])
      setPostWork('on-location')
      setPostArrangement('one-off')
      setPostLocation('')
      setPostTimeline('')
      setPostBudgetType('tfp')
      setPostAmount('')
      setPostBrief('')
      loadBrowse()
    } catch (err) {
      showToast(err?.message || 'Could not publish', 'error')
    } finally {
      setPostSubmitting(false)
    }
  }

  async function markCollabComplete(collabId) {
    try {
      const { error } = await supabase.from('collaborations').update({ status: 'completed' }).eq('id', collabId).eq('posted_by', user.id)
      if (error) throw error
      showToast('Marked as completed')
      loadMy()
      loadBrowse()
    } catch (e) {
      showToast(e?.message || 'Update failed', 'error')
    }
  }

  async function acceptInvite(invite) {
    if (!user) return
    try {
      const { error: uErr } = await supabase
        .from('collaboration_invites')
        .update({ status: 'accepted' })
        .eq('id', invite.id)
        .eq('to_creative_id', user.id)
        .eq('status', 'pending')
      if (uErr) throw uErr

      const otherId = invite.from_creative_id
      const { data: otherProf } = await supabase
        .from('profiles')
        .select('id, business_name, business_email, avatar_url, subscription_tier')
        .eq('id', otherId)
        .maybeSingle()

      const collabEmbed = Array.isArray(invite.collaborations) ? invite.collaborations[0] : invite.collaborations
      const subject =
        (collabEmbed?.brief && String(collabEmbed.brief).slice(0, 60)) ||
        (invite.collaboration_id ? 'Collaboration' : 'Creative invite')
      await createCreativeThread({
        ownerId: user.id,
        otherId,
        otherProfile: otherProf,
        subject,
      })
      showToast('Invite accepted. Open Messages to chat.')
      loadMy()
    } catch (e) {
      showToast(e?.message || 'Could not accept invite', 'error')
    }
  }

  async function declineInvite(inviteId) {
    try {
      const { error } = await supabase
        .from('collaboration_invites')
        .update({ status: 'declined' })
        .eq('id', inviteId)
        .eq('to_creative_id', user.id)
      if (error) throw error
      showToast('Invite declined')
      loadMy()
    } catch (e) {
      showToast(e?.message || 'Could not update invite', 'error')
    }
  }

  useEffect(() => {
    if (tab !== 'invite' || !canUsePaidFeatures) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, business_name, avatar_url, subscription_tier, skill_types')
        .eq('is_admin', false)
        .neq('id', user.id)
        .limit(120)
      if (cancelled) return
      const q = inviteSearch.trim().toLowerCase()
      let rows = data ?? []
      if (q) {
        rows = rows.filter((p) => {
          const name = (p.business_name || '').toLowerCase()
          const skills = JSON.stringify(p.skill_types || []).toLowerCase()
          return name.includes(q) || skills.includes(q)
        })
      }
      setInviteResults(rows.slice(0, 40))
    })()
    return () => {
      cancelled = true
    }
  }, [tab, inviteSearch, user, canUsePaidFeatures])

  async function sendDirectInvite(toProfile) {
    if (!user || !inviteMessage.trim()) return
    setInviteSending(true)
    try {
      const { error } = await supabase.from('collaboration_invites').insert({
        collaboration_id: null,
        from_creative_id: user.id,
        to_creative_id: toProfile.id,
        message: inviteMessage.trim(),
        status: 'pending',
      })
      if (error) throw error
      showToast('Invite sent successfully')
      setInvitePanelId(null)
      setInviteMessage('')
      loadMy()
    } catch (e) {
      showToast(e?.message || 'Could not send invite', 'error')
    } finally {
      setInviteSending(false)
    }
  }

  const otherUserIdForInvite = (invite) =>
    invite.from_creative_id === user.id ? invite.to_creative_id : invite.from_creative_id

  const tabBtn = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      style={{
        padding: '10px 18px',
        borderRadius: 10,
        border: tab === id ? `1px solid ${GREEN}` : `1px solid ${BORDER}`,
        background: tab === id ? 'rgba(29,185,84,0.12)' : PANEL,
        color: tab === id ? GREEN : MUTED,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        ...FONT,
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: WHITE, ...FONT, padding: '20px 24px 40px' }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 2000,
            padding: '12px 18px',
            borderRadius: 10,
            background: toast.type === 'error' ? PINK : GREEN,
            color: toast.type === 'error' ? WHITE : '#000',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, ...TYPO.heading }}>Collaborate</h1>
        <p style={{ fontSize: 13, color: MUTED, marginTop: 6, maxWidth: 720, lineHeight: 1.5, ...TYPO.body }}>
          Find creatives, post projects, and manage collabs in one hub. Basic members can browse open posts. Pro and up can post, invite, and track everything here.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        {tabBtn('browse', 'Browse')}
        {tabBtn('post', 'Post a collab')}
        {tabBtn('my', 'My collabs')}
        {tabBtn('invite', 'Invite a creative')}
      </div>

      {tab === 'browse' && (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <select
              value={filterSpecialty}
              onChange={(e) => setFilterSpecialty(e.target.value)}
              style={{ ...GLASS_NATIVE_FIELD, padding: '8px 12px', borderRadius: 8, color: WHITE, fontSize: 13, minWidth: 160 }}
            >
              <option value="all">All specialties</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={filterWork}
              onChange={(e) => setFilterWork(e.target.value)}
              style={{ ...GLASS_NATIVE_FIELD, padding: '8px 12px', borderRadius: 8, color: WHITE, fontSize: 13, minWidth: 160 }}
            >
              <option value="all">All work types</option>
              <option value="on-location">On location</option>
              <option value="remote">Remote</option>
              <option value="both">Both</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: MUTED, cursor: 'pointer' }}>
              <input type="checkbox" checked={paidOnly} onChange={(e) => setPaidOnly(e.target.checked)} />
              Paid only (hide TFP)
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{ ...GLASS_NATIVE_FIELD, padding: '8px 12px', borderRadius: 8, color: WHITE, fontSize: 13 }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          {loadingBrowse ? (
            <div style={{ color: MUTED, padding: 32 }}>Loading open collaborations…</div>
          ) : filteredBrowse.length === 0 ? (
            <div style={{ color: MUTED, padding: 32 }}>No collaborations match your filters yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filteredBrowse.map((c) => {
                const p = c.poster
                const isElite = (p?.subscription_tier || '').toLowerCase() === 'elite'
                const briefFull = c.brief || ''
                const expanded = expandedBriefId === c.id
                const briefShown = expanded ? briefFull : briefFull.slice(0, 120) + (briefFull.length > 120 ? '…' : '')
                const own = user && c.posted_by === user.id
                return (
                  <div
                    key={c.id}
                    style={{
                      ...GLASS_CARD,
                      borderRadius: 14,
                      overflow: 'hidden',
                      border: isElite ? `1px solid ${GREEN}` : `1px solid ${BORDER}`,
                    }}
                  >
                    {isElite && (
                      <div
                        style={{
                          background: 'rgba(29,185,84,0.18)',
                          color: GREEN,
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          padding: '6px 14px',
                          textTransform: 'uppercase',
                        }}
                      >
                        Featured
                      </div>
                    )}
                    <div style={{ padding: '16px 18px', display: 'flex', gap: 14 }}>
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 12,
                          overflow: 'hidden',
                          flexShrink: 0,
                          background: 'rgba(255,45,120,0.12)',
                          border: `1px solid rgba(255,45,120,0.35)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: PINK,
                          fontWeight: 800,
                          fontSize: 16,
                        }}
                      >
                        {p?.avatar_url ? (
                          <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          initialsFromProfile(p, '')
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{p?.business_name || 'Creative'}</span>
                          <TierBadge tier={p?.subscription_tier} />
                          <span style={{ fontSize: 12, color: MUTED }}>{firstSkillLabel(p?.skill_types)}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {(c.roles_needed || []).map((role) => (
                            <span
                              key={role}
                              style={{
                                fontSize: 10,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: 'rgba(255,255,255,0.06)',
                                border: `1px solid ${BORDER}`,
                                color: MUTED,
                              }}
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 6 }}>
                          <strong style={{ color: WHITE }}>{workTypeLabel(c.work_type)}</strong>
                          {' · '}
                          {c.arrangement === 'ongoing' ? 'Ongoing' : 'One off'}
                          {' · '}
                          {c.work_type === 'remote' || !c.location ? 'Remote' : c.location}
                          {' · '}
                          {c.timeline || 'Timeline TBC'}
                          {' · '}
                          {c.budget_type === 'paid' && c.budget_amount != null
                            ? `AUD $${Number(c.budget_amount).toFixed(0)}`
                            : 'TFP'}
                        </div>
                        <p style={{ fontSize: 13, color: WHITE, lineHeight: 1.45, margin: '0 0 8px' }}>{briefShown}</p>
                        {briefFull.length > 120 && (
                          <button
                            type="button"
                            onClick={() => setExpandedBriefId(expanded ? null : c.id)}
                            style={{ background: 'none', border: 'none', color: GREEN, fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 8 }}
                          >
                            {expanded ? 'Show less' : 'Read full brief'}
                          </button>
                        )}
                        <div style={{ fontSize: 11, color: DIM, marginBottom: 10 }}>Posted {formatAuDate(c.created_at)}</div>
                        {!own && canUsePaidFeatures ? (
                          <Button type="button" variant="primary" size="sm" onClick={() => expressInterest(c)}>
                            Express interest
                          </Button>
                        ) : own ? (
                          <span style={{ fontSize: 12, color: DIM }}>This is your post</span>
                        ) : (
                          <Button type="button" variant="secondary" size="sm" disabled style={{ opacity: 0.55 }}>
                            Express interest (upgrade required)
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'post' && (
        <div>
          {!canUsePaidFeatures ? (
            <UpgradePrompt onNavigateSettings={() => navigate('/dashboard/settings/subscription')} />
          ) : (
            <form onSubmit={submitCollabPost} style={{ ...GLASS_CARD, borderRadius: 14, padding: '22px 20px', maxWidth: 640, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: WHITE }}>Roles needed</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {SPECIALTIES.map((s) => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: MUTED, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={postRoles.includes(s)}
                      onChange={() => {
                        setPostRoles((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
                      }}
                    />
                    {s}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Work type</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {[
                  { v: 'on-location', l: 'On location' },
                  { v: 'remote', l: 'Remote' },
                  { v: 'both', l: 'Both' },
                ].map((o) => (
                  <label key={o.v} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: MUTED, cursor: 'pointer' }}>
                    <input type="radio" name="work" value={o.v} checked={postWork === o.v} onChange={() => setPostWork(o.v)} />
                    {o.l}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Arrangement</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {[
                  { v: 'one-off', l: 'One off' },
                  { v: 'ongoing', l: 'Ongoing' },
                ].map((o) => (
                  <label key={o.v} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: MUTED, cursor: 'pointer' }}>
                    <input type="radio" name="arr" value={o.v} checked={postArrangement === o.v} onChange={() => setPostArrangement(o.v)} />
                    {o.l}
                  </label>
                ))}
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Location</div>
                <input
                  value={postLocation}
                  onChange={(e) => setPostLocation(e.target.value)}
                  disabled={postWork === 'remote'}
                  placeholder={postWork === 'remote' ? 'Not required for remote' : 'City or region'}
                  style={{
                    ...GLASS_NATIVE_FIELD,
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    color: WHITE,
                    fontSize: 13,
                    opacity: postWork === 'remote' ? 0.45 : 1,
                  }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Date or project timeline</div>
                <input
                  value={postTimeline}
                  onChange={(e) => setPostTimeline(e.target.value)}
                  placeholder="e.g. March 2026, or two weekend days"
                  style={{ ...GLASS_NATIVE_FIELD, width: '100%', padding: '10px 12px', borderRadius: 8, color: WHITE, fontSize: 13 }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Budget</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, color: MUTED, cursor: 'pointer' }}>
                  <input type="radio" name="bud" checked={postBudgetType === 'tfp'} onChange={() => setPostBudgetType('tfp')} />
                  TFP (time for prints or portfolio)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: MUTED, cursor: 'pointer' }}>
                  <input type="radio" name="bud" checked={postBudgetType === 'paid'} onChange={() => setPostBudgetType('paid')} />
                  Paid (AUD)
                </label>
                {postBudgetType === 'paid' && (
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={postAmount}
                    onChange={(e) => setPostAmount(e.target.value)}
                    placeholder="Amount in AUD"
                    style={{ ...GLASS_NATIVE_FIELD, marginTop: 8, width: '100%', maxWidth: 220, padding: '10px 12px', borderRadius: 8, color: WHITE, fontSize: 13 }}
                  />
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Brief (max 500 characters)</div>
                <textarea
                  value={postBrief}
                  onChange={(e) => setPostBrief(e.target.value.slice(0, 500))}
                  rows={6}
                  style={{ ...GLASS_NATIVE_FIELD, width: '100%', padding: '10px 12px', borderRadius: 8, color: WHITE, fontSize: 13, resize: 'vertical' }}
                />
                <div style={{ fontSize: 11, color: DIM, marginTop: 4 }}>{postBrief.length} / 500</div>
              </div>
              <Button type="submit" variant="primary" disabled={postSubmitting}>
                {postSubmitting ? 'Publishing…' : 'Publish collaboration'}
              </Button>
            </form>
          )}
        </div>
      )}

      {tab === 'my' && (
        <div>
          {loadingMy ? (
            <div style={{ color: MUTED }}>Loading…</div>
          ) : (
            <>
              <section style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: GREEN, marginBottom: 12, letterSpacing: '0.06em' }}>ACTIVE</h2>
                {acceptedInvites.length === 0 ? (
                  <p style={{ color: MUTED, fontSize: 13 }}>No accepted collabs yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {acceptedInvites.map((inv) => (
                      <InviteRow
                        key={inv.id}
                        otherId={otherUserIdForInvite(inv)}
                        onMessages={() => navigate('/dashboard/clients/messages')}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: MUTED, marginBottom: 12, letterSpacing: '0.06em' }}>PENDING</h2>
                {pendingInvites.length === 0 ? (
                  <p style={{ color: MUTED, fontSize: 13 }}>No pending invites.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pendingInvites.map((inv) => (
                      <div key={inv.id} style={{ ...GLASS_CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
                        <PendingInviteCard
                          invite={inv}
                          userId={user.id}
                          onAccept={() => acceptInvite(inv)}
                          onDecline={() => declineInvite(inv.id)}
                          onMessages={() => navigate('/dashboard/clients/messages')}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: DIM, marginBottom: 12, letterSpacing: '0.06em' }}>COMPLETED</h2>
                {myCollabs.filter((c) => c.status === 'open').length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>Your open posts</div>
                    {myCollabs
                      .filter((c) => c.status === 'open')
                      .map((c) => (
                        <div
                          key={c.id}
                          style={{
                            ...GLASS_CARD,
                            borderRadius: 10,
                            padding: '12px 14px',
                            marginBottom: 8,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            border: `1px solid ${BORDER}`,
                          }}
                        >
                          <span style={{ fontSize: 13, color: WHITE }}>{c.brief?.slice(0, 80) || 'Collaboration'}{c.brief?.length > 80 ? '…' : ''}</span>
                          <Button type="button" variant="secondary" size="sm" onClick={() => markCollabComplete(c.id)}>
                            Mark complete
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
                {completedCollabs.length === 0 ? (
                  <p style={{ color: MUTED, fontSize: 13 }}>No completed collaborations yet.</p>
                ) : (
                  completedCollabs.map((c) => (
                    <div key={c.id} style={{ ...GLASS_CARD, borderRadius: 10, padding: '12px 14px', marginBottom: 8, fontSize: 13, border: `1px solid ${BORDER}` }}>
                      {c.brief?.slice(0, 100) || 'Collaboration'}
                      {c.brief?.length > 100 ? '…' : ''}
                      <span style={{ color: DIM, marginLeft: 8 }}>({formatAuDate(c.updated_at || c.created_at)})</span>
                    </div>
                  ))
                )}
              </section>
            </>
          )}
        </div>
      )}

      {tab === 'invite' && (
        <div>
          {!canUsePaidFeatures ? (
            <UpgradePrompt onNavigateSettings={() => navigate('/dashboard/settings/subscription')} />
          ) : (
            <>
              <input
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                placeholder="Search by business name or specialty…"
                style={{ ...GLASS_NATIVE_FIELD, width: '100%', maxWidth: 420, padding: '10px 14px', borderRadius: 8, color: WHITE, fontSize: 13, marginBottom: 16 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {inviteResults.map((p) => (
                  <div key={p.id} style={{ ...GLASS_CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          overflow: 'hidden',
                          background: 'rgba(255,45,120,0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: PINK,
                          fontWeight: 700,
                        }}
                      >
                        {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsFromProfile(p, '')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>{p.business_name || 'Creative'}</div>
                        <div style={{ fontSize: 12, color: MUTED }}>{firstSkillLabel(p.skill_types)}</div>
                        <TierBadge tier={p.subscription_tier} />
                      </div>
                      {p.id === user.id ? null : (
                        <Button type="button" variant="secondary" size="sm" onClick={() => { setInvitePanelId(invitePanelId === p.id ? null : p.id); setInviteMessage('') }}>
                          {invitePanelId === p.id ? 'Close' : 'Invite'}
                        </Button>
                      )}
                    </div>
                    {invitePanelId === p.id && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
                        <textarea
                          value={inviteMessage}
                          onChange={(e) => setInviteMessage(e.target.value)}
                          placeholder="Add a short message with your invite…"
                          rows={3}
                          style={{ ...GLASS_NATIVE_FIELD, width: '100%', padding: '10px 12px', borderRadius: 8, color: WHITE, fontSize: 13, marginBottom: 10 }}
                        />
                        <Button type="button" variant="primary" size="sm" disabled={inviteSending || !inviteMessage.trim()} onClick={() => sendDirectInvite(p)}>
                          {inviteSending ? 'Sending…' : 'Send invite'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function PendingInviteCard({ invite, userId, onAccept, onDecline, onMessages }) {
  const incoming = invite.to_creative_id === userId
  const otherId = invite.from_creative_id === userId ? invite.to_creative_id : invite.from_creative_id
  const [other, setOther] = useState(null)
  useEffect(() => {
    let cancelled = false
    supabase
      .from('profiles')
      .select('business_name, subscription_tier')
      .eq('id', otherId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOther(data)
      })
    return () => {
      cancelled = true
    }
  }, [otherId])
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{other?.business_name || 'Creative'}</div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
        {invite.collaboration_id ? 'Collab interest' : 'Direct invite'} ·{' '}
        <span style={{ textTransform: 'capitalize' }}>{invite.status}</span>
      </div>
      {invite.message && <p style={{ fontSize: 13, color: WHITE, marginBottom: 10 }}>{invite.message}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {incoming && (
          <>
            <Button type="button" variant="primary" size="sm" onClick={onAccept}>
              Accept
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onDecline}>
              Decline
            </Button>
          </>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onMessages}>
          Messages
        </Button>
      </div>
    </div>
  )
}

function InviteRow({ otherId, onMessages }) {
  const [other, setOther] = useState(null)
  useEffect(() => {
    let cancelled = false
    supabase
      .from('profiles')
      .select('business_name, subscription_tier')
      .eq('id', otherId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOther(data)
      })
    return () => {
      cancelled = true
    }
  }, [otherId])
  return (
    <div style={{ ...GLASS_CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      <div>
        <div style={{ fontWeight: 700 }}>{other?.business_name || 'Creative'}</div>
        <div style={{ fontSize: 12, color: MUTED }}>Accepted · chat in Messages</div>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={onMessages}>
        Messages
      </Button>
    </div>
  )
}
