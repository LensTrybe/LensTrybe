import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { normalizeSubscriptionTier } from '../../lib/tierFeatures'
import { moderateText, MODERATION_BLOCKED_USER_MESSAGE } from '../../lib/moderateContent'

// Theme-aware Collaborate hub (light + dark) built on the --lt-* tokens. Adds a
// Saved creatives tab: creatives can be bookmarked from the Browse posters and the
// Invite results, and managed here (message, invite, remove).

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'
const PINK = '#FF2D78'
const FONT = { fontFamily: 'Inter, sans-serif' }

// Glass + field recipes on the theme tokens.
const glassCard = {
  background: 'var(--lt-glass-bg)',
  border: 'var(--lt-glass-border)',
  boxShadow: 'var(--lt-glass-shadow)',
  backdropFilter: 'var(--lt-glass-blur)',
  WebkitBackdropFilter: 'var(--lt-glass-blur)',
}
const field = {
  background: 'var(--lt-input-bg)',
  border: '1px solid var(--lt-input-border)',
  color: 'var(--lt-text)',
  fontFamily: 'inherit',
  outline: 'none',
}

const SPECIALTIES = [
  'Photographer', 'Videographer', 'Drone Pilot', 'Video Editor',
  'Photo Editor', 'Social Media Manager', 'Hair & Makeup Artist', 'UGC Creator',
]

const TIER_BADGE = {
  basic: { bg: 'rgba(136,136,170,0.14)', color: 'var(--lt-muted)' },
  pro: { bg: 'rgba(74,158,255,0.14)', color: '#4A9EFF' },
  expert: { bg: 'rgba(245,166,35,0.16)', color: '#F5A623' },
  elite: { bg: 'rgba(29,185,84,0.16)', color: GREEN },
}

function TierBadge({ tier }) {
  const t = (tier || 'basic').toLowerCase()
  const cfg = TIER_BADGE[t] || TIER_BADGE.basic
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {t}
    </span>
  )
}

function Btn({ variant = 'primary', size = 'md', children, style, disabled, ...props }) {
  const pad = size === 'sm' ? '7px 14px' : '10px 18px'
  const fs = size === 'sm' ? 12.5 : 13.5
  const variants = {
    primary: { background: GREEN, color: GREEN_TEXT, border: '1px solid transparent' },
    secondary: { background: 'var(--lt-surface)', color: 'var(--lt-text)', border: '1px solid var(--lt-border)' },
    ghost: { background: 'transparent', color: 'var(--lt-text)', border: '1px solid var(--lt-border)' },
  }
  return (
    <button {...props} disabled={disabled}
      style={{ padding: pad, fontSize: fs, fontWeight: 700, borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'transform .12s ease, opacity .12s ease', opacity: disabled ? 0.55 : 1, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

function BookmarkIcon({ filled, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? GREEN : 'none'} stroke={filled ? GREEN : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function SaveButton({ saved, onToggle, size = 'sm' }) {
  return (
    <button type="button" onClick={onToggle} aria-label={saved ? 'Remove from saved' : 'Save creative'} title={saved ? 'Saved' : 'Save creative'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: size === 'sm' ? '7px 12px' : '9px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: saved ? 'rgba(29,185,84,0.12)' : 'var(--lt-surface)', border: `1px solid ${saved ? GREEN + '66' : 'var(--lt-border)'}`, color: saved ? GREEN : 'var(--lt-text)' }}>
      <BookmarkIcon filled={saved} size={15} />
      {saved ? 'Saved' : 'Save'}
    </button>
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
  try { return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}

function workTypeLabel(w) {
  if (w === 'remote') return 'Remote'
  if (w === 'on-location') return 'On location'
  if (w === 'both') return 'On location or remote'
  return w || ''
}

function UpgradePrompt({ onNavigateSettings }) {
  return (
    <div style={{ ...glassCard, borderRadius: 16, padding: '28px 24px', textAlign: 'center', maxWidth: 480, margin: '32px auto' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--lt-text)', marginBottom: 10 }}>Upgrade to unlock</div>
      <p style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.55, marginBottom: 20 }}>
        Collaboration posting, invites, saved creatives, and full hub tools are on Pro, Expert, and Elite. Upgrade your plan to post collabs, invite creatives, and manage everything in one place.
      </p>
      <Btn type="button" variant="primary" onClick={onNavigateSettings}>View plans and upgrade</Btn>
    </div>
  )
}

const avatarBox = (size = 52) => ({
  width: size, height: size, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
  background: 'rgba(255,45,120,0.12)', border: '1px solid rgba(255,45,120,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: PINK, fontWeight: 800, fontSize: 16,
})

async function findExistingCreativeThread(userId, otherId) {
  const { data: a } = await supabase.from('message_threads').select('id').eq('creative_id', userId).eq('client_user_id', otherId).maybeSingle()
  if (a?.id) return a.id
  const { data: b } = await supabase.from('message_threads').select('id').eq('creative_id', otherId).eq('client_user_id', userId).maybeSingle()
  return b?.id ?? null
}

async function createCreativeThread({ ownerId, otherId, otherProfile, subject }) {
  const existing = await findExistingCreativeThread(ownerId, otherId)
  if (existing) return existing
  const name = otherProfile?.business_name || 'Creative'
  const email = otherProfile?.business_email || `${otherId.slice(0, 8)}@placeholder.lenstrybe`
  const { data, error } = await supabase.from('message_threads').insert({
    creative_id: ownerId, client_user_id: otherId, client_name: name, client_email: email, subject: subject || 'Collaboration',
  }).select('id').single()
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
  const [postBriefModerationError, setPostBriefModerationError] = useState('')
  const [inviteModerationError, setInviteModerationError] = useState('')

  // Saved creatives.
  const [savedIds, setSavedIds] = useState(() => new Set())
  const [savedProfiles, setSavedProfiles] = useState([])
  const [loadingSaved, setLoadingSaved] = useState(false)

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
      const { data: collabs, error: cErr } = await supabase.from('collaborations').select('*').eq('status', 'open').order('created_at', { ascending: false })
      if (cErr) throw cErr
      const rows = collabs ?? []
      const posterIds = [...new Set(rows.map((r) => r.posted_by).filter(Boolean))]
      let profileById = {}
      if (posterIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, business_name, avatar_url, subscription_tier, skill_types, business_email').in('id', posterIds).eq('is_admin', false)
        for (const p of profs ?? []) profileById[p.id] = p
      }
      setBrowseRows(rows.map((c) => ({ ...c, poster: profileById[c.posted_by] || null })))
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
      for (const inv of merged) if (!uniq.has(inv.id)) uniq.set(inv.id, inv)
      setMyInvites([...uniq.values()])
      setMyCollabs(own ?? [])
    } catch (e) {
      console.error(e)
      showToast(e?.message || 'Could not load your collaborations', 'error')
    } finally {
      setLoadingMy(false)
    }
  }, [user, showToast])

  // Light load of just the saved ids, so save toggles reflect state on every tab.
  const loadSavedIds = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('saved_creatives').select('creative_id').eq('user_id', user.id)
    setSavedIds(new Set((data ?? []).map((r) => r.creative_id)))
  }, [user])

  const loadSavedFull = useCallback(async () => {
    if (!user) return
    setLoadingSaved(true)
    try {
      const { data: rows } = await supabase.from('saved_creatives').select('creative_id, created_at').eq('user_id', user.id).order('created_at', { ascending: false })
      const ids = (rows ?? []).map((r) => r.creative_id)
      setSavedIds(new Set(ids))
      if (!ids.length) { setSavedProfiles([]); return }
      const { data: profs } = await supabase.from('profiles').select('id, business_name, avatar_url, subscription_tier, skill_types, business_email, city, state').in('id', ids)
      const byId = {}
      for (const p of profs ?? []) byId[p.id] = p
      setSavedProfiles(ids.map((id) => byId[id]).filter(Boolean))
    } catch (e) {
      showToast(e?.message || 'Could not load saved creatives', 'error')
    } finally {
      setLoadingSaved(false)
    }
  }, [user, showToast])

  const toggleSave = useCallback(async (creativeId) => {
    if (!user || !creativeId || creativeId === user.id) return
    const isSaved = savedIds.has(creativeId)
    // Optimistic update.
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (isSaved) next.delete(creativeId); else next.add(creativeId)
      return next
    })
    if (isSaved) setSavedProfiles((prev) => prev.filter((p) => p.id !== creativeId))
    try {
      if (isSaved) {
        const { error } = await supabase.from('saved_creatives').delete().eq('user_id', user.id).eq('creative_id', creativeId)
        if (error) throw error
        showToast('Removed from saved')
      } else {
        const { error } = await supabase.from('saved_creatives').insert({ user_id: user.id, creative_id: creativeId })
        if (error) throw error
        showToast('Saved to your creatives')
      }
    } catch (e) {
      // Roll back on failure.
      setSavedIds((prev) => {
        const next = new Set(prev)
        if (isSaved) next.add(creativeId); else next.delete(creativeId)
        return next
      })
      showToast(e?.message || 'Could not update saved creatives', 'error')
    }
  }, [user, savedIds, showToast])

  useEffect(() => { loadBrowse() }, [loadBrowse])
  useEffect(() => { if (user) loadSavedIds() }, [user, loadSavedIds])
  useEffect(() => { if (tab === 'my' && user) loadMy() }, [tab, user, loadMy])
  useEffect(() => { if (tab === 'saved' && user) loadSavedFull() }, [tab, user, loadSavedFull])

  const filteredBrowse = useMemo(() => {
    let list = [...browseRows]
    if (filterSpecialty !== 'all') list = list.filter((c) => (c.roles_needed || []).includes(filterSpecialty))
    if (filterWork !== 'all') list = list.filter((c) => c.work_type === filterWork || c.work_type === 'both')
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

  const pendingInvites = useMemo(() => myInvites.filter((i) => i.status === 'pending'), [myInvites])
  const acceptedInvites = useMemo(() => myInvites.filter((i) => i.status === 'accepted'), [myInvites])
  const completedCollabs = useMemo(() => myCollabs.filter((c) => c.status === 'completed'), [myCollabs])

  async function expressInterest(collab) {
    if (!user || collab.posted_by === user.id) return
    try {
      const { data: existing } = await supabase.from('collaboration_invites').select('id').eq('collaboration_id', collab.id).eq('from_creative_id', user.id).eq('status', 'pending').maybeSingle()
      if (existing) { showToast('You already expressed interest in this collab', 'error'); return }
      const { error } = await supabase.from('collaboration_invites').insert({ collaboration_id: collab.id, from_creative_id: user.id, to_creative_id: collab.posted_by, status: 'pending', message: null })
      if (error) throw error
      showToast('Interest sent. The poster will be notified.')
    } catch (e) {
      showToast(e?.message || 'Could not send interest', 'error')
    }
  }

  async function submitCollabPost(e) {
    e.preventDefault()
    if (!user || !canUsePaidFeatures) return
    setPostBriefModerationError('')
    if (!postRoles.length) { showToast('Choose at least one role you need', 'error'); return }
    if (postBrief.trim().length > 500) { showToast('Brief must be 500 characters or fewer', 'error'); return }
    const briefMod = await moderateText(postBrief.trim())
    if (briefMod?.blocked) { setPostBriefModerationError(MODERATION_BLOCKED_USER_MESSAGE); return }
    if (briefMod?.flagged) console.warn('[moderation] Flagged collab brief', briefMod.reason)
    setPostSubmitting(true)
    try {
      const payload = {
        posted_by: user.id, roles_needed: postRoles, work_type: postWork, arrangement: postArrangement,
        location: postWork === 'remote' ? null : postLocation.trim() || null,
        timeline: postTimeline.trim() || null, budget_type: postBudgetType,
        budget_amount: postBudgetType === 'paid' && postAmount ? Number.parseFloat(postAmount) : null,
        brief: postBrief.trim(), status: 'open',
      }
      const { error } = await supabase.from('collaborations').insert(payload)
      if (error) throw error
      showToast('Your collaboration post is live.')
      setPostRoles([]); setPostWork('on-location'); setPostArrangement('one-off'); setPostLocation(''); setPostTimeline(''); setPostBudgetType('tfp'); setPostAmount(''); setPostBrief('')
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
      loadMy(); loadBrowse()
    } catch (e) {
      showToast(e?.message || 'Update failed', 'error')
    }
  }

  async function acceptInvite(invite) {
    if (!user) return
    try {
      const { error: uErr } = await supabase.from('collaboration_invites').update({ status: 'accepted' }).eq('id', invite.id).eq('to_creative_id', user.id).eq('status', 'pending')
      if (uErr) throw uErr
      const otherId = invite.from_creative_id
      const { data: otherProf } = await supabase.from('profiles').select('id, business_name, business_email, avatar_url, subscription_tier').eq('id', otherId).maybeSingle()
      const collabEmbed = Array.isArray(invite.collaborations) ? invite.collaborations[0] : invite.collaborations
      const subject = (collabEmbed?.brief && String(collabEmbed.brief).slice(0, 60)) || (invite.collaboration_id ? 'Collaboration' : 'Creative invite')
      await createCreativeThread({ ownerId: user.id, otherId, otherProfile: otherProf, subject })
      showToast('Invite accepted. Open Messages to chat.')
      loadMy()
    } catch (e) {
      showToast(e?.message || 'Could not accept invite', 'error')
    }
  }

  async function declineInvite(inviteId) {
    try {
      const { error } = await supabase.from('collaboration_invites').update({ status: 'declined' }).eq('id', inviteId).eq('to_creative_id', user.id)
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
      const { data } = await supabase.from('profiles').select('id, business_name, avatar_url, subscription_tier, skill_types').eq('is_admin', false).neq('id', user.id).limit(120)
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
    return () => { cancelled = true }
  }, [tab, inviteSearch, user, canUsePaidFeatures])

  async function sendDirectInvite(toProfile) {
    if (!user || !inviteMessage.trim()) return
    setInviteModerationError('')
    const msgMod = await moderateText(inviteMessage.trim())
    if (msgMod?.blocked) { setInviteModerationError(MODERATION_BLOCKED_USER_MESSAGE); return }
    if (msgMod?.flagged) console.warn('[moderation] Flagged collab invite message', msgMod.reason)
    setInviteSending(true)
    try {
      const { error } = await supabase.from('collaboration_invites').insert({ collaboration_id: null, from_creative_id: user.id, to_creative_id: toProfile.id, message: inviteMessage.trim(), status: 'pending' })
      if (error) throw error
      showToast('Invite sent successfully')
      setInvitePanelId(null); setInviteMessage('')
      loadMy()
    } catch (e) {
      showToast(e?.message || 'Could not send invite', 'error')
    } finally {
      setInviteSending(false)
    }
  }

  async function messageCreative(p) {
    if (!user || !p?.id || p.id === user.id) return
    try {
      await createCreativeThread({ ownerId: user.id, otherId: p.id, otherProfile: p, subject: 'Collaboration' })
      navigate('/dashboard/clients/messages')
    } catch (e) {
      showToast(e?.message || 'Could not open a conversation', 'error')
    }
  }

  const otherUserIdForInvite = (invite) => invite.from_creative_id === user.id ? invite.to_creative_id : invite.from_creative_id

  const tabBtn = (id, label) => (
    <button key={id} type="button" onClick={() => setTab(id)}
      style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${tab === id ? GREEN : 'var(--lt-border)'}`, background: tab === id ? 'rgba(29,185,84,0.12)' : 'var(--lt-surface)', color: tab === id ? GREEN : 'var(--lt-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...FONT }}>
      {label}
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: 'var(--lt-text)', ...FONT, paddingBottom: 40 }}>
      <style>{`
        .ltc-select {
          -webkit-appearance: none; -moz-appearance: none; appearance: none;
          background-color: var(--lt-input-bg);
          color: var(--lt-text);
          border: 1px solid var(--lt-input-border);
          border-radius: 8px;
          padding: 8px 34px 8px 12px;
          font-size: 13px; font-family: inherit; cursor: pointer; outline: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239b99a8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 11px center;
        }
        [data-theme="light"] .ltc-select { color-scheme: light; }
        [data-theme="dark"] .ltc-select { color-scheme: dark; }
        .ltc-select:disabled { opacity: .55; cursor: not-allowed; }
      `}</style>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 2000, padding: '12px 18px', borderRadius: 10, background: toast.type === 'error' ? PINK : GREEN, color: toast.type === 'error' ? '#fff' : GREEN_TEXT, fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>Collaborate</h1>
        <p style={{ fontSize: 13.5, color: 'var(--lt-muted)', marginTop: 6, maxWidth: 720, lineHeight: 1.55 }}>
          Find creatives, post projects, and manage collabs in one hub. Basic members can browse open posts. Pro and up can post, invite, save creatives, and track everything here.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        {tabBtn('browse', 'Browse')}
        {tabBtn('post', 'Post a collab')}
        {tabBtn('my', 'My collabs')}
        {tabBtn('saved', 'Saved creatives')}
        {tabBtn('invite', 'Invite a creative')}
      </div>

      {tab === 'browse' && (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <select className="ltc-select" value={filterSpecialty} onChange={(e) => setFilterSpecialty(e.target.value)} style={{ minWidth: 160 }}>
              <option value="all">All specialties</option>
              {SPECIALTIES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
            <select className="ltc-select" value={filterWork} onChange={(e) => setFilterWork(e.target.value)} style={{ minWidth: 160 }}>
              <option value="all">All work types</option>
              <option value="on-location">On location</option>
              <option value="remote">Remote</option>
              <option value="both">Both</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--lt-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={paidOnly} onChange={(e) => setPaidOnly(e.target.checked)} style={{ accentColor: GREEN }} />
              Paid only (hide TFP)
            </label>
            <select className="ltc-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          {loadingBrowse ? (
            <div style={{ color: 'var(--lt-muted)', padding: 32 }}>Loading open collaborations…</div>
          ) : filteredBrowse.length === 0 ? (
            <div style={{ color: 'var(--lt-muted)', padding: 32 }}>No collaborations match your filters yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filteredBrowse.map((c) => {
                const p = c.poster
                const isElite = (p?.subscription_tier || '').toLowerCase() === 'elite'
                const briefFull = c.brief || ''
                const expanded = expandedBriefId === c.id
                const briefShown = expanded ? briefFull : briefFull.slice(0, 120) + (briefFull.length > 120 ? '…' : '')
                const own = user && c.posted_by === user.id
                const canSavePoster = p && !own && canUsePaidFeatures
                return (
                  <div key={c.id} style={{ ...glassCard, borderRadius: 16, overflow: 'hidden', border: isElite ? `1px solid ${GREEN}66` : 'var(--lt-glass-border)' }}>
                    {isElite && (
                      <div style={{ background: 'rgba(29,185,84,0.18)', color: GREEN, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', padding: '6px 14px', textTransform: 'uppercase' }}>Featured</div>
                    )}
                    <div style={{ padding: '16px 18px', display: 'flex', gap: 14 }}>
                      <div style={avatarBox(52)}>
                        {p?.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsFromProfile(p, '')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--lt-text)' }}>{p?.business_name || 'Creative'}</span>
                          <TierBadge tier={p?.subscription_tier} />
                          <span style={{ fontSize: 12, color: 'var(--lt-muted)' }}>{firstSkillLabel(p?.skill_types)}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {(c.roles_needed || []).map((role) => (
                            <span key={role} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', color: 'var(--lt-muted)' }}>{role}</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--lt-muted)', lineHeight: 1.5, marginBottom: 6 }}>
                          <strong style={{ color: 'var(--lt-text)' }}>{workTypeLabel(c.work_type)}</strong>
                          {' · '}{c.arrangement === 'ongoing' ? 'Ongoing' : 'One off'}
                          {' · '}{c.work_type === 'remote' || !c.location ? 'Remote' : c.location}
                          {' · '}{c.timeline || 'Timeline TBC'}
                          {' · '}{c.budget_type === 'paid' && c.budget_amount != null ? `AUD $${Number(c.budget_amount).toFixed(0)}` : 'TFP'}
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--lt-text)', lineHeight: 1.45, margin: '0 0 8px' }}>{briefShown}</p>
                        {briefFull.length > 120 && (
                          <button type="button" onClick={() => setExpandedBriefId(expanded ? null : c.id)} style={{ background: 'none', border: 'none', color: GREEN, fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 8 }}>
                            {expanded ? 'Show less' : 'Read full brief'}
                          </button>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--lt-faint)', marginBottom: 10 }}>Posted {formatAuDate(c.created_at)}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          {!own && canUsePaidFeatures ? (
                            <Btn type="button" variant="primary" size="sm" onClick={() => expressInterest(c)}>Express interest</Btn>
                          ) : own ? (
                            <span style={{ fontSize: 12, color: 'var(--lt-faint)' }}>This is your post</span>
                          ) : (
                            <Btn type="button" variant="secondary" size="sm" disabled>Express interest (upgrade required)</Btn>
                          )}
                          {canSavePoster && <SaveButton saved={savedIds.has(p.id)} onToggle={() => toggleSave(p.id)} />}
                        </div>
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
            <form onSubmit={submitCollabPost} style={{ ...glassCard, borderRadius: 16, padding: '22px 20px', maxWidth: 640 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: 'var(--lt-text)' }}>Roles needed</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {SPECIALTIES.map((s) => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--lt-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={postRoles.includes(s)} onChange={() => setPostRoles((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))} style={{ accentColor: GREEN }} />
                    {s}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--lt-text)' }}>Work type</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {[{ v: 'on-location', l: 'On location' }, { v: 'remote', l: 'Remote' }, { v: 'both', l: 'Both' }].map((o) => (
                  <label key={o.v} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--lt-muted)', cursor: 'pointer' }}>
                    <input type="radio" name="work" value={o.v} checked={postWork === o.v} onChange={() => setPostWork(o.v)} style={{ accentColor: GREEN }} />
                    {o.l}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--lt-text)' }}>Arrangement</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {[{ v: 'one-off', l: 'One off' }, { v: 'ongoing', l: 'Ongoing' }].map((o) => (
                  <label key={o.v} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--lt-muted)', cursor: 'pointer' }}>
                    <input type="radio" name="arr" value={o.v} checked={postArrangement === o.v} onChange={() => setPostArrangement(o.v)} style={{ accentColor: GREEN }} />
                    {o.l}
                  </label>
                ))}
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6, color: 'var(--lt-text)' }}>Location</div>
                <input value={postLocation} onChange={(e) => setPostLocation(e.target.value)} disabled={postWork === 'remote'} placeholder={postWork === 'remote' ? 'Not required for remote' : 'City or region'}
                  style={{ ...field, width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13, opacity: postWork === 'remote' ? 0.45 : 1, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6, color: 'var(--lt-text)' }}>Date or project timeline</div>
                <input value={postTimeline} onChange={(e) => setPostTimeline(e.target.value)} placeholder="e.g. March 2026, or two weekend days"
                  style={{ ...field, width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--lt-text)' }}>Budget</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, color: 'var(--lt-muted)', cursor: 'pointer' }}>
                  <input type="radio" name="bud" checked={postBudgetType === 'tfp'} onChange={() => setPostBudgetType('tfp')} style={{ accentColor: GREEN }} />
                  TFP (time for prints or portfolio)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--lt-muted)', cursor: 'pointer' }}>
                  <input type="radio" name="bud" checked={postBudgetType === 'paid'} onChange={() => setPostBudgetType('paid')} style={{ accentColor: GREEN }} />
                  Paid (AUD)
                </label>
                {postBudgetType === 'paid' && (
                  <input type="number" min={0} step={1} value={postAmount} onChange={(e) => setPostAmount(e.target.value)} placeholder="Amount in AUD"
                    style={{ ...field, marginTop: 8, width: '100%', maxWidth: 220, padding: '10px 12px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6, color: 'var(--lt-text)' }}>Brief (max 500 characters)</div>
                <textarea value={postBrief} onChange={(e) => { setPostBriefModerationError(''); setPostBrief(e.target.value.slice(0, 500)) }} rows={6}
                  style={{ ...field, width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                <div style={{ fontSize: 11, color: 'var(--lt-faint)', marginTop: 4 }}>{postBrief.length} / 500</div>
                {postBriefModerationError ? <div style={{ fontSize: 12, color: PINK, marginTop: 8, lineHeight: 1.45 }}>{postBriefModerationError}</div> : null}
              </div>
              <Btn type="submit" variant="primary" disabled={postSubmitting}>{postSubmitting ? 'Publishing…' : 'Publish collaboration'}</Btn>
            </form>
          )}
        </div>
      )}

      {tab === 'my' && (
        <div>
          {loadingMy ? (
            <div style={{ color: 'var(--lt-muted)' }}>Loading…</div>
          ) : (
            <>
              <section style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 13, fontWeight: 800, color: GREEN, marginBottom: 12, letterSpacing: '0.06em' }}>ACTIVE</h2>
                {acceptedInvites.length === 0 ? (
                  <p style={{ color: 'var(--lt-muted)', fontSize: 13 }}>No accepted collabs yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {acceptedInvites.map((inv) => (
                      <InviteRow key={inv.id} otherId={otherUserIdForInvite(inv)} onMessages={() => navigate('/dashboard/clients/messages')} />
                    ))}
                  </div>
                )}
              </section>

              <section style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--lt-muted)', marginBottom: 12, letterSpacing: '0.06em' }}>PENDING</h2>
                {pendingInvites.length === 0 ? (
                  <p style={{ color: 'var(--lt-muted)', fontSize: 13 }}>No pending invites.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pendingInvites.map((inv) => (
                      <div key={inv.id} style={{ ...glassCard, borderRadius: 12, padding: '14px 16px' }}>
                        <PendingInviteCard invite={inv} userId={user.id} onAccept={() => acceptInvite(inv)} onDecline={() => declineInvite(inv.id)} onMessages={() => navigate('/dashboard/clients/messages')} />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--lt-faint)', marginBottom: 12, letterSpacing: '0.06em' }}>COMPLETED</h2>
                {myCollabs.filter((c) => c.status === 'open').length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--lt-muted)', marginBottom: 8 }}>Your open posts</div>
                    {myCollabs.filter((c) => c.status === 'open').map((c) => (
                      <div key={c.id} style={{ ...glassCard, borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 13, color: 'var(--lt-text)' }}>{c.brief?.slice(0, 80) || 'Collaboration'}{c.brief?.length > 80 ? '…' : ''}</span>
                        <Btn type="button" variant="secondary" size="sm" onClick={() => markCollabComplete(c.id)}>Mark complete</Btn>
                      </div>
                    ))}
                  </div>
                )}
                {completedCollabs.length === 0 ? (
                  <p style={{ color: 'var(--lt-muted)', fontSize: 13 }}>No completed collaborations yet.</p>
                ) : (
                  completedCollabs.map((c) => (
                    <div key={c.id} style={{ ...glassCard, borderRadius: 12, padding: '12px 14px', marginBottom: 8, fontSize: 13, color: 'var(--lt-text)' }}>
                      {c.brief?.slice(0, 100) || 'Collaboration'}{c.brief?.length > 100 ? '…' : ''}
                      <span style={{ color: 'var(--lt-faint)', marginLeft: 8 }}>({formatAuDate(c.updated_at || c.created_at)})</span>
                    </div>
                  ))
                )}
              </section>
            </>
          )}
        </div>
      )}

      {tab === 'saved' && (
        <div>
          {!canUsePaidFeatures ? (
            <UpgradePrompt onNavigateSettings={() => navigate('/dashboard/settings/subscription')} />
          ) : loadingSaved ? (
            <div style={{ color: 'var(--lt-muted)', padding: 32 }}>Loading saved creatives…</div>
          ) : savedProfiles.length === 0 ? (
            <div style={{ ...glassCard, borderRadius: 16, padding: '28px 24px', maxWidth: 520, color: 'var(--lt-muted)', fontSize: 13.5, lineHeight: 1.6 }}>
              You have not saved any creatives yet. Tap <strong style={{ color: 'var(--lt-text)' }}>Save</strong> on a creative in Browse or Invite a creative, and they will show up here for quick access.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {savedProfiles.map((p) => (
                <div key={p.id} style={{ ...glassCard, borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={avatarBox(46)}>
                      {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsFromProfile(p, '')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--lt-text)' }}>{p.business_name || 'Creative'}</span>
                        <TierBadge tier={p.subscription_tier} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--lt-muted)', marginTop: 2 }}>
                        {firstSkillLabel(p.skill_types)}{(p.city || p.state) ? ` · ${[p.city, p.state].filter(Boolean).join(', ')}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Btn type="button" variant="secondary" size="sm" onClick={() => navigate(`/creatives/${p.id}`)}>View profile</Btn>
                      <Btn type="button" variant="secondary" size="sm" onClick={() => messageCreative(p)}>Message</Btn>
                      <Btn type="button" variant="primary" size="sm" onClick={() => { setInvitePanelId(invitePanelId === p.id ? null : p.id); setInviteMessage(''); setInviteModerationError('') }}>
                        {invitePanelId === p.id ? 'Close' : 'Invite'}
                      </Btn>
                      <SaveButton saved onToggle={() => toggleSave(p.id)} />
                    </div>
                  </div>
                  {invitePanelId === p.id && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--lt-hairline)' }}>
                      <textarea value={inviteMessage} onChange={(e) => { setInviteModerationError(''); setInviteMessage(e.target.value) }} placeholder="Add a short message with your invite…" rows={3}
                        style={{ ...field, width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} />
                      {inviteModerationError ? <div style={{ fontSize: 12, color: PINK, marginBottom: 10, lineHeight: 1.45 }}>{inviteModerationError}</div> : null}
                      <Btn type="button" variant="primary" size="sm" disabled={inviteSending || !inviteMessage.trim()} onClick={() => void sendDirectInvite(p)}>
                        {inviteSending ? 'Sending…' : 'Send invite'}
                      </Btn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'invite' && (
        <div>
          {!canUsePaidFeatures ? (
            <UpgradePrompt onNavigateSettings={() => navigate('/dashboard/settings/subscription')} />
          ) : (
            <>
              <input value={inviteSearch} onChange={(e) => setInviteSearch(e.target.value)} placeholder="Search by business name or specialty…"
                style={{ ...field, width: '100%', maxWidth: 420, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {inviteResults.map((p) => (
                  <div key={p.id} style={{ ...glassCard, borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={avatarBox(44)}>
                        {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsFromProfile(p, '')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--lt-text)' }}>{p.business_name || 'Creative'}</div>
                        <div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>{firstSkillLabel(p.skill_types)}</div>
                        <div style={{ marginTop: 4 }}><TierBadge tier={p.subscription_tier} /></div>
                      </div>
                      {p.id === user.id ? null : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <SaveButton saved={savedIds.has(p.id)} onToggle={() => toggleSave(p.id)} />
                          <Btn type="button" variant="secondary" size="sm" onClick={() => { setInvitePanelId(invitePanelId === p.id ? null : p.id); setInviteMessage(''); setInviteModerationError('') }}>
                            {invitePanelId === p.id ? 'Close' : 'Invite'}
                          </Btn>
                        </div>
                      )}
                    </div>
                    {invitePanelId === p.id && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--lt-hairline)' }}>
                        <textarea value={inviteMessage} onChange={(e) => { setInviteModerationError(''); setInviteMessage(e.target.value) }} placeholder="Add a short message with your invite…" rows={3}
                          style={{ ...field, width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} />
                        {inviteModerationError ? <div style={{ fontSize: 12, color: PINK, marginBottom: 10, lineHeight: 1.45 }}>{inviteModerationError}</div> : null}
                        <Btn type="button" variant="primary" size="sm" disabled={inviteSending || !inviteMessage.trim()} onClick={() => void sendDirectInvite(p)}>
                          {inviteSending ? 'Sending…' : 'Send invite'}
                        </Btn>
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
    supabase.from('profiles').select('business_name, subscription_tier').eq('id', otherId).maybeSingle().then(({ data }) => { if (!cancelled) setOther(data) })
    return () => { cancelled = true }
  }, [otherId])
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--lt-text)' }}>{other?.business_name || 'Creative'}</div>
      <div style={{ fontSize: 12, color: 'var(--lt-muted)', marginBottom: 8 }}>
        {invite.collaboration_id ? 'Collab interest' : 'Direct invite'} · <span style={{ textTransform: 'capitalize' }}>{invite.status}</span>
      </div>
      {invite.message && <p style={{ fontSize: 13, color: 'var(--lt-text)', marginBottom: 10 }}>{invite.message}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {incoming && (
          <>
            <Btn type="button" variant="primary" size="sm" onClick={onAccept}>Accept</Btn>
            <Btn type="button" variant="secondary" size="sm" onClick={onDecline}>Decline</Btn>
          </>
        )}
        <Btn type="button" variant="ghost" size="sm" onClick={onMessages}>Messages</Btn>
      </div>
    </div>
  )
}

function InviteRow({ otherId, onMessages }) {
  const [other, setOther] = useState(null)
  useEffect(() => {
    let cancelled = false
    supabase.from('profiles').select('business_name, subscription_tier').eq('id', otherId).maybeSingle().then(({ data }) => { if (!cancelled) setOther(data) })
    return () => { cancelled = true }
  }, [otherId])
  return (
    <div style={{ ...glassCard, borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      <div>
        <div style={{ fontWeight: 700, color: 'var(--lt-text)' }}>{other?.business_name || 'Creative'}</div>
        <div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>Accepted · chat in Messages</div>
      </div>
      <Btn type="button" variant="secondary" size="sm" onClick={onMessages}>Messages</Btn>
    </div>
  )
}
