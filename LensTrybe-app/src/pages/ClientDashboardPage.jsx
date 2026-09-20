import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { formatClientAccountDisplayName } from '../lib/clientDisplayName'
import {
  MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE,
  messageBodyContainsContactDetails,
  threadOwnerTierContactSharingRestricted,
} from '../lib/messagingContactPolicy'
import { useAuth } from '../context/AuthContext'
import { moderateText, MODERATION_BLOCKED_USER_MESSAGE } from '../lib/moderateContent'
import { acceptJobApplication, declineJobApplication, isApplicationPending } from '../lib/posterJobApplicationActions'
import DeleteAccountModal from '../components/account/DeleteAccountModal'
import useIsMobile from '../hooks/useIsMobile'
import DashSurface from '../components/layout/DashSurface.jsx'
import { useDashTheme } from '../components/layout/useDashTheme'
import DownloadDataCard from '../components/account/DownloadDataCard'
import NewsletterPreferenceCard from '../components/account/NewsletterPreferenceCard'
import ClientBookingsView from '../components/bookings/ClientBookingsView'
import ClientDocumentsView from '../components/documents/ClientDocumentsView.jsx'
import NotificationBell from '../components/layout/NotificationBell'
import BroadcastHost from '../components/broadcasts/BroadcastHost'
import { imageUrl } from '../lib/imageUrl'

/* An empty screen should say what this is for and offer the one thing worth
 * doing next. A single grey line in the middle of a large panel does neither,
 * and it is the first thing a new client sees. */
function EmptyState({ icon, title, body, actionLabel, onAction }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div style={{ maxWidth: 360, textAlign: 'center' }}>
        <div
          aria-hidden
          style={{
            width: 58,
            height: 58,
            margin: '0 auto 18px',
            borderRadius: 999,
            background: 'rgba(29,185,84,0.14)',
            border: '1px solid rgba(29,185,84,0.32)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0E7C3A',
          }}
        >
          {icon}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>{title}</div>
        <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--lt-muted)', marginTop: 8 }}>{body}</div>
        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            style={{
              marginTop: 18,
              minHeight: 44,
              padding: '0 20px',
              borderRadius: 10,
              border: 'none',
              background: '#1DB954',
              color: '#04120a',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

const IconChat = (
  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
  </svg>
)

export default function ClientDashboardPage() {
  const { user, clientAccount, profile } = useAuth()
  const { theme, dark, toggleTheme } = useDashTheme()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [threads, setThreads] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [jobs, setJobs] = useState([])
  const [expandedJob, setExpandedJob] = useState(null)
  const [toast, setToast] = useState(null)
  const [creatives, setCreatives] = useState([])
  // ?view=bookings&booking=<id> (from booking emails and notifications)
  const [view, setView] = useState(() => {
    try { const v = new URLSearchParams(window.location.search).get('view'); return ['messages', 'bookings', 'documents', 'creatives', 'jobs', 'account'].includes(v) ? v : 'messages' } catch { return 'messages' }
  })
  const [highlightBooking, setHighlightBooking] = useState(() => { try { return new URLSearchParams(window.location.search).get('booking') || null } catch { return null } })
  const location = useLocation()
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const v = q.get('view')
    if (v && ['messages', 'bookings', 'documents', 'creatives', 'jobs', 'account'].includes(v)) setView(v)
    if (q.get('booking')) setHighlightBooking(q.get('booking'))
  }, [location.search])
  const [editingNickname, setEditingNickname] = useState(false)
  const [replyModerationError, setReplyModerationError] = useState('')
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    if (window.location.pathname.startsWith('/portal/')) return
    if (window.location.pathname.startsWith('/deliver/')) return
  }, [])

  useEffect(() => {
    if (!user) return
    if (profile) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, profile, navigate])

  useEffect(() => { if (user) { loadThreads(); loadJobs() } }, [user, clientAccount])
  useEffect(() => { if (selected) loadMessages(selected.id) }, [selected])

  function getCreativeName(thread) {
    const creative = creatives.find(c => c.id === thread.creative_id)
    return creative?.business_name ?? thread.subject ?? 'Creative'
  }

  async function loadThreads() {
    if (!user) return

    // Link enquiry threads sent from this person's confirmed email to their account
    // (done server-side: threads are only readable by their participants).
    try { await supabase.rpc('link_my_client_threads') } catch { /* best effort */ }

    // Threads where this client is a participant
    const { data: byId } = await supabase
      .from('message_threads')
      .select('*')
      .eq('client_user_id', user.id)
      .order('created_at', { ascending: false })

    // Also get any threads matching email with null client_user_id (use account email when set, may differ from auth email)
    const byEmail = []

    const all = [...(byId ?? []), ...byEmail]
    const unique = all.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)

    setThreads(unique)
    if (unique.length > 0) setSelected(unique[0])

    const creativeIds = [...new Set(unique.map(t => t.creative_id).filter(Boolean))]
    if (creativeIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, business_name, business_email, avatar_url, city, state, skill_types, bio, subscription_tier')
        .in('id', creativeIds)
        .eq('is_admin', false)
      setCreatives(profiles ?? [])
    }
  }

  async function loadMessages(threadId) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
  }

  async function loadJobs() {
    if (!user) return
    const { data } = await supabase
      .from('job_listings')
      .select('*, job_applications(*)')
      .eq('posted_by', user.id)
      .order('created_at', { ascending: false })
    setJobs(data ?? [])
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function acceptApplication(app, job) {
    await acceptJobApplication({
      app,
      job,
      user,
      profile,
      clientAccount,
      showToast,
      reloadPostedJobs: loadJobs,
      reloadThreads: loadThreads,
    })
  }

  async function declineApplication(app) {
    await declineJobApplication({ app, showToast, reloadPostedJobs: loadJobs })
  }

  async function sendReply() {
    if (!reply.trim() || !selected) return
    const bodyText = reply.trim()
    setReplyModerationError('')
    const mod = await moderateText(bodyText)
    if (mod?.blocked) {
      setReplyModerationError(MODERATION_BLOCKED_USER_MESSAGE)
      return
    }
    if (mod?.flagged) console.warn('[moderation] Flagged client reply', mod.reason)
    let ownerTier = creatives.find((c) => c.id === selected.creative_id)?.subscription_tier
    if (ownerTier == null && selected?.creative_id) {
      const { data: tierRow } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', selected.creative_id)
        .eq('is_admin', false)
        .maybeSingle()
      ownerTier = tierRow?.subscription_tier
    }
    if (threadOwnerTierContactSharingRestricted(ownerTier) && messageBodyContainsContactDetails(bodyText)) {
      showToast(MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE, 'error')
      return
    }
    setSending(true)
    try {
      const clientSenderName = formatClientAccountDisplayName(clientAccount) || user.email
      const { data: sentMsg, error: sendErr } = await supabase.from('messages').insert({
        thread_id: selected.id,
        sender_type: 'client',
        sender_name: clientSenderName,
        body: bodyText,
      }).select('id').single()
      if (sendErr) throw sendErr
      // The notification function loads the recipient and message text from the database.
      if (sentMsg?.id) {
        await supabase.functions.invoke('send-message-notification', {
          body: { message_id: sentMsg.id },
        })
      }
      setReply('')
      await loadMessages(selected.id)
    } catch (e) {
      showToast(e?.message || 'Could not send message', 'error')
    } finally {
      setSending(false)
    }
  }

  async function deleteThread(t, e) {
    e.stopPropagation()
    if (!window.confirm('Delete this conversation?')) return
    await supabase.from('messages').delete().eq('thread_id', t.id)
    await supabase.from('message_threads').delete().eq('id', t.id)
    setThreads(prev => prev.filter(x => x.id !== t.id))
    if (selected?.id === t.id) setSelected(null)
  }

  async function saveNickname(nickname) {
    await supabase.from('message_threads').update({ nickname }).eq('id', selected.id)
    setThreads(prev => prev.map(t => t.id === selected.id ? { ...t, nickname } : t))
    setSelected(prev => ({ ...prev, nickname }))
    setEditingNickname(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  const displayName = clientAccount
    ? `${clientAccount.first_name ?? ''} ${clientAccount.last_name ?? ''}`.trim()
    : user?.email ?? ''

  const GLASS = {
    background: 'var(--lt-glass-bg)',
    border: 'var(--lt-glass-border)',
    boxShadow: 'var(--lt-glass-shadow)',
    backdropFilter: 'var(--lt-glass-blur)',
    WebkitBackdropFilter: 'var(--lt-glass-blur)',
  }

  const s = {
    page: { minHeight: '100dvh', background: 'transparent', color: 'var(--lt-text)', fontFamily: 'var(--font-ui)', position: 'relative', zIndex: 1 },
    nav: { height: '64px', ...GLASS, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', position: 'sticky', top: 0, zIndex: 100 },
    navInner: { height: '100%', maxWidth: 1400, margin: '0 auto', padding: '0 18px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    logo: { fontSize: '18px', fontFamily: 'var(--font-display)', color: 'var(--lt-text)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 },
    navRight: { display: 'flex', alignItems: 'center', gap: '10px' },
    userName: { fontSize: '13px', color: 'var(--lt-muted)' },
    signOutBtn: { minHeight: 44, fontSize: '13px', fontWeight: 600, color: 'var(--lt-text)', background: 'var(--lt-input-bg)', border: '1px solid var(--lt-border)', borderRadius: 10, cursor: 'pointer', padding: '0 14px', fontFamily: 'inherit' },
    themeBtn: { width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lt-text)', background: 'var(--lt-input-bg)', border: '1px solid var(--lt-border)', borderRadius: 10, cursor: 'pointer', padding: 0 },
    body: { display: 'flex', gap: 18, height: 'calc(100dvh - 64px)', padding: 18, boxSizing: 'border-box', maxWidth: 1400, margin: '0 auto' },
    sidebar: { width: '228px', flexShrink: 0, ...GLASS, borderRadius: 18, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '8px 0' },
    sidebarHeader: { padding: '12px 18px 6px', fontSize: '11px', fontWeight: 700, color: 'var(--lt-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' },
    navItem: (active) => ({
      display: 'block', width: 'calc(100% - 16px)', margin: '2px 8px', textAlign: 'left',
      minHeight: 44, padding: '0 14px', fontSize: '14px', fontWeight: active ? 700 : 500, cursor: 'pointer',
      fontFamily: 'inherit', borderRadius: 10,
      color: active ? '#0E7C3A' : 'var(--lt-muted)',
      background: active ? 'rgba(29,185,84,0.14)' : 'transparent',
      border: active ? '1px solid rgba(29,185,84,0.45)' : '1px solid transparent',
      transition: 'background .15s ease, color .15s ease',
    }),
    threadList: { flex: 1, overflowY: 'auto', padding: '0 8px 8px' },
    thread: (active) => ({ width: '100%', textAlign: 'left', fontFamily: 'inherit', padding: '10px 12px', cursor: 'pointer', borderRadius: 10, background: active ? 'rgba(29,185,84,0.12)' : 'transparent', border: active ? '1px solid rgba(29,185,84,0.35)' : '1px solid transparent', position: 'relative', marginBottom: 2 }),
    threadName: { fontSize: '13px', fontWeight: 600, color: 'var(--lt-text)', marginBottom: '2px' },
    threadPreview: { fontSize: '12px', color: 'var(--lt-muted)' },
    delBtn: { position: 'absolute', top: '6px', right: '6px', opacity: 0, background: 'none', border: 'none', color: '#c11f5a', cursor: 'pointer', fontSize: '14px', padding: '2px 6px', transition: 'opacity 0.2s' },
    main: { flex: 1, minWidth: 0, ...GLASS, borderRadius: 18, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    chatHeader: { padding: '16px 22px', borderBottom: '1px solid var(--lt-hairline)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--lt-text)' },
    messageList: { flex: 1, overflowY: 'auto', padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' },
    messageRow: (isClient) => ({ display: 'flex', justifyContent: isClient ? 'flex-end' : 'flex-start', width: '100%' }),
    bubble: (isClient) => ({ padding: '11px 15px', borderRadius: '18px', maxWidth: '62%', background: isClient ? '#1DB954' : 'var(--lt-surface-2)', color: isClient ? '#04120a' : 'var(--lt-text)', border: isClient ? 'none' : '1px solid var(--lt-border)', fontSize: '14px', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }),
    replyBar: { padding: '14px 22px', borderTop: '1px solid var(--lt-hairline)', display: 'flex', gap: '10px', alignItems: 'flex-end' },
    replyInput: { flex: 1, background: 'var(--lt-input-bg)', border: '1px solid var(--lt-input-border)', borderRadius: '24px', padding: '11px 16px', color: 'var(--lt-text)', fontSize: '14px', fontFamily: 'var(--font-ui)', outline: 'none' },
    sendBtn: { background: '#1DB954', color: '#04120a', border: 'none', borderRadius: '24px', minHeight: 44, padding: '0 20px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' },
    empty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lt-muted)', fontSize: '14px' },
    content: { flex: 1, overflowY: 'auto', padding: '22px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' },
    creativeCard: { background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', borderRadius: '14px', padding: '16px', cursor: 'pointer', transition: 'border-color 0.15s', width: '100%', textAlign: 'left', fontFamily: 'inherit', color: 'var(--lt-text)' },
    avatar: { width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(29,185,84,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: '#0E7C3A', marginBottom: '10px', overflow: 'hidden' },
    creativeName: { fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--lt-text)' },
    creativeType: { fontSize: '12px', color: 'var(--lt-muted)', marginBottom: '8px' },
    messageBtn: { width: '100%', minHeight: 40, background: 'rgba(29,185,84,0.12)', border: '1px solid rgba(29,185,84,0.35)', borderRadius: '9px', color: '#0E7C3A', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
    jobCard: { background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', borderRadius: '14px', padding: '16px', marginBottom: '12px' },
    jobTitle: { fontSize: '15px', fontWeight: 600, marginBottom: '6px', color: 'var(--lt-text)' },
    jobMeta: { fontSize: '12px', color: 'var(--lt-muted)' },
    postBtn: { minHeight: 44, padding: '0 20px', background: '#1DB954', color: '#04120a', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', marginBottom: '20px', fontFamily: 'inherit' },
    editInput: { background: 'var(--lt-input-bg)', border: '1px solid #1DB954', borderRadius: '8px', padding: '6px 10px', color: 'var(--lt-text)', fontSize: '14px', fontFamily: 'var(--font-ui)' },
    editIcon: { background: 'none', border: 'none', color: 'var(--lt-muted)', cursor: 'pointer', fontSize: '12px', padding: '2px' },
  }

  function goToCreativeThread(creativeId) {
    const thread = threads.find(t => t.creative_id === creativeId)
    if (thread) { setSelected(thread); setView('messages') }
  }

  return (
    <>
      {/* A sibling, not a child. The background wrapper is position: fixed, and
          nesting it inside an element that makes a stacking context (position
          relative plus a z-index) paints it inside that context instead of
          behind the page. DashboardLayout has always mounted it this way. */}
      <DashSurface dark={dark} isMobile={isMobile} />
      <div style={{ ...s.page, colorScheme: dark ? 'dark' : 'light' }} className="lt-dash cd-root" data-theme={theme}>
      <style>{`

        /* Phones: the sidebar becomes a scrolling row of chips above the content, so the
           content gets the full width instead of about 140 pixels of it. */
        @media (max-width: 820px) {
          .cd-body { flex-direction: column; height: auto; min-height: calc(100dvh - 64px); }
          .cd-side {
            width: 100% !important; border-right: none !important;
            border-bottom: 1px solid var(--lt-hairline);
            flex-direction: row !important; align-items: center;
            overflow-x: auto; overflow-y: hidden; gap: 4px;
            padding: 6px 10px; scrollbar-width: none;
          }
          .cd-side::-webkit-scrollbar { display: none; }
          .cd-side > div { flex: 0 0 auto; }
          .cd-nav {
            border-left: none !important; border-radius: 999px;
            padding: 8px 14px !important; white-space: nowrap; font-size: 13.5px !important;
          }
          .cd-side > .cd-sidehead, .cd-convhead, .cd-threads { display: none; }
        }
        @media (max-width: 560px) {
          nav { padding: 0 16px !important; }
        }
      `}</style>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: toast.type === 'success' ? '#1DB954' : '#FF2D78', color: toast.type === 'success' ? '#04120a' : '#ffffff', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}>
          {toast.msg}
        </div>
      )}
      <nav style={s.nav}>
        <div style={s.navInner}>
        <button type="button" style={s.logo} onClick={() => navigate('/')}>LensTrybe</button>
        <div style={s.navRight}>
          <span style={s.userName}>{displayName}</span>
          <button
            type="button"
            style={s.themeBtn}
            onClick={toggleTheme}
            aria-label={dark ? 'Switch to light' : 'Switch to dark'}
            title={dark ? 'Switch to light' : 'Switch to dark'}
          >
            {dark ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>
          <button type="button" style={s.signOutBtn} onClick={signOut}>Sign Out</button>
        </div>
        </div>
      </nav>

      <BroadcastHost bannerWrapStyle={{ padding: '14px 24px 0', maxWidth: 1280, margin: '0 auto', boxSizing: 'border-box' }} />

      <div style={s.body} className="cd-body">
        <div style={s.sidebar} className="cd-side">
          <div className="cd-sidehead" style={s.sidebarHeader}>Menu</div>
          <button type="button" className="cd-nav" style={s.navItem(view === 'messages')} onClick={() => setView('messages')}>Messages {threads.length > 0 && `(${threads.length})`}</button>
          <button type="button" className="cd-nav" style={s.navItem(view === 'bookings')} onClick={() => setView('bookings')}>My Bookings</button>
          <button type="button" className="cd-nav" style={s.navItem(view === 'documents')} onClick={() => setView('documents')}>Documents</button>
          <button type="button" className="cd-nav" style={s.navItem(view === 'creatives')} onClick={() => setView('creatives')}>My Creatives {creatives.length > 0 && `(${creatives.length})`}</button>
          <button type="button" className="cd-nav" style={s.navItem(view === 'jobs')} onClick={() => setView('jobs')}>My Jobs {jobs.length > 0 && `(${jobs.length})`}</button>
          <button type="button" className="cd-nav" style={s.navItem(false)} onClick={() => navigate('/creatives')}>Find a Creative</button>
          <button type="button" className="cd-nav" style={s.navItem(false)} onClick={() => navigate('/jobs')}>Job Board</button>
          <button type="button" className="cd-nav" style={s.navItem(view === 'account')} onClick={() => setView('account')}>Account &amp; Data</button>

          {view === 'messages' && threads.length > 0 && (
            <>
              <div className="cd-convhead" style={s.sidebarHeader}>Conversations</div>
              <div className="cd-threads" style={s.threadList}>
                {threads.map(t => (
                  <div
                    key={t.id}
                    style={s.thread(selected?.id === t.id)}
                    onClick={() => setSelected(t)}
                    onMouseEnter={e => e.currentTarget.querySelector('.del').style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.querySelector('.del').style.opacity = '0'}
                  >
                    <div style={s.threadName}>{t.nickname ?? getCreativeName(t)}</div>
                    <div style={s.threadPreview}>{t.subject ?? 'Enquiry'}</div>
                    <button className="del" style={s.delBtn} onClick={(e) => deleteThread(t, e)}>✕</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={s.main}>
          {view === 'messages' && (
            selected ? (
              <>
                <div style={s.chatHeader}>
                  {editingNickname ? (
                    <input
                      autoFocus
                      defaultValue={selected.nickname ?? selected.subject ?? ''}
                      style={s.editInput}
                      onBlur={e => saveNickname(e.target.value.trim())}
                      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                    />
                  ) : (
                    <>
                      <span style={{ fontSize: '15px', fontWeight: 600 }}>{selected.nickname ?? getCreativeName(selected) ?? selected.subject ?? 'Conversation'}</span>
                      <button style={s.editIcon} onClick={() => setEditingNickname(true)}></button>
                    </>
                  )}
                </div>
                <div style={s.messageList}>
                  {messages.length === 0
                    ? <div style={{ color: 'var(--lt-muted)', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>No messages yet. Say hello below.</div>
                    : messages.map(m => (
                      <div key={m.id} style={s.messageRow(m.sender_type === 'client')}>
                        <div style={s.bubble(m.sender_type === 'client')}>{m.body}</div>
                      </div>
                    ))
                  }
                </div>
                <div style={s.replyBar}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                    <input
                      style={{ ...s.replyInput, width: '100%', flex: 'none', boxSizing: 'border-box' }}
                      placeholder="Type your reply..."
                      value={reply}
                      onChange={e => { setReplyModerationError(''); setReply(e.target.value) }}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && void sendReply()}
                      aria-invalid={replyModerationError ? true : undefined}
                    />
                    {replyModerationError ? (
                      <div style={{ fontSize: '12px', color: '#f87171', fontFamily: 'var(--font-ui)' }}>{replyModerationError}</div>
                    ) : null}
                  </div>
                  <button style={s.sendBtn} onClick={() => void sendReply()} disabled={sending}>{sending ? '...' : 'Send'}</button>
                </div>
              </>
            ) : (
              <EmptyState
                icon={IconChat}
                title="No conversations yet"
                body="When you message a creative about a job, the thread shows up here and stays in one place."
                actionLabel="Find a creative"
                onAction={() => navigate('/creatives')}
              />
            )
          )}

          {view === 'creatives' && (
            <div style={s.content}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>My Creatives</h2>
              {creatives.length === 0 ? (
                <div style={{ color: 'var(--lt-muted)', fontSize: '14px' }}>
                  You haven't contacted any creatives yet. <span style={{ color: '#1DB954', cursor: 'pointer' }} onClick={() => navigate('/creatives')}>Find one now →</span>
                </div>
              ) : (
                <div style={s.grid}>
                  {creatives.map(c => (
                    <div key={c.id} style={s.creativeCard}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#1DB954'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--lt-border)'}
                    >
                      <div style={s.avatar}>
                        {c.avatar_url
                          ? <img loading="lazy" decoding="async" src={imageUrl(c.avatar_url, 48)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (c.business_name?.[0] ?? '?').toUpperCase()
                        }
                      </div>
                      <div style={s.creativeName}>{c.business_name}</div>
                      <div style={s.creativeType}>
                        {(c.skill_types ?? []).map(t => t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ')}
                      </div>
                      {c.city && <div style={{ fontSize: '12px', color: 'var(--lt-muted)', marginBottom: '12px' }}>{c.city}{c.state ? `, ${c.state}` : ''}</div>}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button style={s.messageBtn} onClick={() => goToCreativeThread(c.id)}>Message</button>
                        <button style={{ ...s.messageBtn, background: 'transparent', color: 'var(--lt-muted)' }} onClick={() => navigate(`/creatives/${c.id}`)}>View Profile</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'account' && (
            <div style={s.content}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Account &amp; Data</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
                <DownloadDataCard kind="client" />
                <NewsletterPreferenceCard />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '24px', borderRadius: '18px', background: 'var(--lt-surface)', border: '1px solid rgba(255,45,120,0.35)' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#c11f5a' }}>Delete account</div>
                  <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--lt-muted)' }}>Close your LensTrybe account. Your account, messages and saved creatives are permanently deleted after 30 days, and you can reactivate any time before then by signing in. We'll email you a code to confirm it's you.</div>
                  <div><button type="button" onClick={() => setShowDelete(true)} style={{ padding: '10px 16px', borderRadius: '12px', border: 'none', background: '#FF2D78', color: '#fff', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Delete account</button></div>
                </div>
              </div>
            </div>
          )}

          {view === 'bookings' && <ClientBookingsView userId={user?.id} highlightId={highlightBooking} />}
          {view === 'documents' && <ClientDocumentsView onFindCreative={() => navigate('/creatives')} />}

          {view === 'jobs' && (
            <div style={s.content}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>My Jobs</h2>
              <button style={s.postBtn} onClick={() => navigate('/jobs')}>+ Post a Job</button>
              {jobs.length === 0 ? (
                <div style={{ color: 'var(--lt-muted)', fontSize: '14px' }}>You haven&apos;t posted any jobs yet.</div>
              ) : jobs.map(job => (
                <div key={job.id} style={{ background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden' }}>
                  <div
                    style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                  >
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--lt-text)' }}>{job.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--lt-muted)', marginTop: '4px' }}>{job.location} · {job.budget_range}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ padding: '4px 12px', background: 'rgba(29,185,84,0.1)', border: '1px solid rgba(29,185,84,0.2)', borderRadius: '999px', fontSize: '12px', fontWeight: 700, color: '#1DB954' }}>
                        {job.job_applications?.length ?? 0} application{job.job_applications?.length !== 1 ? 's' : ''}
                      </span>
                      <span style={{ color: 'var(--lt-muted)', fontSize: '16px' }}>{expandedJob === job.id ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expandedJob === job.id && (
                    <div style={{ borderTop: '1px solid var(--lt-hairline)', padding: '16px 20px' }}>
                      {!job.job_applications?.length ? (
                        <div style={{ fontSize: '13px', color: 'var(--lt-muted)', padding: '16px 0' }}>No applications yet.</div>
                      ) : (
                        job.job_applications.map(app => (
                          <div key={app.id} style={{ padding: '16px', background: 'var(--lt-surface-2)', borderRadius: '10px', marginBottom: '10px', border: '1px solid var(--lt-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--lt-text)' }}>{app.creative_name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--lt-muted)', marginTop: '2px' }}>Applied {new Date(app.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                              </div>
                              <div style={{ fontSize: '18px', fontWeight: 800, color: '#1DB954' }}>AUD {Number(app.price ?? 0).toFixed(2)}</div>
                            </div>
                            {app.includes && (
                              <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--lt-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>What&apos;s included</div>
                                <div style={{ fontSize: '13px', color: 'var(--lt-muted)', lineHeight: 1.5 }}>{app.includes}</div>
                              </div>
                            )}
                            {app.description && (
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--lt-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Cover message</div>
                                <div style={{ fontSize: '13px', color: 'var(--lt-muted)', lineHeight: 1.5 }}>{app.description}</div>
                              </div>
                            )}
                            {isApplicationPending(app) && (
                              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--lt-hairline)' }}>
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); void acceptApplication(app, job) }}
                                  style={{ padding: '8px 20px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                                >
                                  ✓ Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); void declineApplication(app) }}
                                  style={{ padding: '8px 20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#c11f5a', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                            {app.status === 'accepted' && (
                              <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(29,185,84,0.1)', border: '1px solid rgba(29,185,84,0.2)', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#1DB954' }}>
                                ✓ Accepted, message thread created
                              </div>
                            )}
                            {app.status === 'declined' && (
                              <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#c11f5a' }}>
                                Declined
                              </div>
                            )}
                            {app.status === 'closed' && (
                              <div style={{ marginTop: '12px', padding: '8px 12px', background: 'var(--lt-surface-2)', border: '1px solid var(--lt-border)', borderRadius: '8px', fontSize: '12px', color: 'var(--lt-muted)' }}>
                                Position filled
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <NotificationBell />
      <DeleteAccountModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        kind="client"
        onDeleted={async () => { setShowDelete(false); try { await supabase.auth.signOut() } catch { /* already signed out */ } navigate('/', { replace: true }) }}
      />
      </div>
    </>
  )
}
