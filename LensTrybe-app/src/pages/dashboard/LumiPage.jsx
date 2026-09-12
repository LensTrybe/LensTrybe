import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { getFeatures, TIER_ORDER, UNLIMITED } from '../../lib/tierFeatures'

// Full-page Lumi. Rebuilt on the theme-aware --lt-* tokens so it works in light
// and dark (the old build was light-only: white sidebar + invisible heading in
// dark). Matches the global Lumi drawer's look. Same features: conversation
// history (pin/rename/delete), quick prompts, usage, tier gating.

const LUMI_GRAD = 'linear-gradient(135deg, #1DB954 0%, #FF2D78 100%)'
const GREEN = '#1DB954'
const PINK = '#FF2D78'

const QUICK_PROMPTS = [
  'Help me price a project',
  'Write a client proposal',
  'How do I follow up on overdue invoices?',
  'Tips to attract more clients',
]

// Lumi's allowance per plan comes from tierFeatures like every other limit, so the
// pricing card and the quota can't drift apart. null monthly means unlimited.
const TIER_CONFIG = Object.fromEntries(TIER_ORDER.map((t) => {
  const f = getFeatures(t)
  return [t, { monthly: f.lumiPerMonth === UNLIMITED ? null : f.lumiPerMonth, daily: f.lumiPerDay }]
}))

function LumiMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: 'block' }}>
      <path d="M12 2.5l1.9 5.2a4 4 0 0 0 2.4 2.4L21.5 12l-5.2 1.9a4 4 0 0 0-2.4 2.4L12 21.5l-1.9-5.2a4 4 0 0 0-2.4-2.4L2.5 12l5.2-1.9a4 4 0 0 0 2.4-2.4L12 2.5z" fill="#ffffff" />
    </svg>
  )
}

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function MarkdownText({ text }) {
  const parsed = String(text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:var(--lt-surface-2);padding:1px 5px;border-radius:4px;font-size:0.9em">$1</code>')
    .replace(/\n/g, '<br/>')
  return <span style={{ lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: parsed }} />
}

function ConvoMenu({ convo, onRename, onPin, onDelete, onClose }) {
  const menuRef = useRef(null)
  useEffect(() => {
    function handleClick(e) { if (menuRef.current && !menuRef.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])
  const items = [
    { label: convo.pinned ? 'Unpin' : 'Pin', onClick: () => { onPin(convo); onClose() } },
    { label: 'Rename', onClick: () => { onRename(convo); onClose() } },
    { label: 'Delete', onClick: () => { onDelete(convo.id); onClose() }, danger: true },
  ]
  return (
    <div ref={menuRef} style={{ position: 'absolute', top: 28, right: 0, background: 'var(--lt-modal-bg)', border: 'var(--lt-modal-border)', backdropFilter: 'var(--lt-modal-blur)', WebkitBackdropFilter: 'var(--lt-modal-blur)', borderRadius: 10, padding: 4, zIndex: 100, minWidth: 150, boxShadow: 'var(--lt-modal-shadow)' }}>
      {items.map((item) => (
        <button key={item.label} type="button" onClick={item.onClick}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderRadius: 7, color: item.danger ? PINK : 'var(--lt-text)', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

export default function LumiPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tier, setTier] = useState(null)
  const [conversations, setConversations] = useState([])
  const [activeConvoId, setActiveConvoId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [usage, setUsage] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const renameInputRef = useRef(null)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/login'); return }
      setUser(session.user)
    })
  }, [navigate])

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('subscription_tier, business_name').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) { setProfile(data); setTier((data.subscription_tier || 'basic').toLowerCase()) }
        else setTier('basic')
      })
  }, [user])

  const callEdge = useCallback(async (body) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${supabaseUrl}/functions/v1/lumi-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    })
    return res.json()
  }, [supabaseUrl])

  const loadConversations = useCallback(async () => {
    if (!user) return
    setLoadingConvos(true)
    try {
      const data = await callEdge({ action: 'load_conversations' })
      setConversations(data.conversations || [])
    } catch (e) { console.error('Failed to load conversations', e) }
    finally { setLoadingConvos(false) }
  }, [user, callEdge])

  useEffect(() => { if (user) loadConversations() }, [user, loadConversations])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])
  useEffect(() => { if (renamingId && renameInputRef.current) { renameInputRef.current.focus(); renameInputRef.current.select() } }, [renamingId])
  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function openConversation(convo) {
    if (renamingId) return
    setActiveConvoId(convo.id)
    setMessages(convo.messages || [])
    if (isMobile) setSidebarOpen(false)
  }

  function startNewConversation() {
    setActiveConvoId(null)
    setMessages([])
    inputRef.current?.focus()
    if (isMobile) setSidebarOpen(false)
  }

  async function handleDelete(convoId) {
    setConversations(prev => prev.filter(c => c.id !== convoId))
    if (activeConvoId === convoId) { setActiveConvoId(null); setMessages([]) }
    try { await callEdge({ action: 'delete_conversation', conversationId: convoId }) } catch (e) { console.error(e) }
  }

  function startRename(convo) { setRenamingId(convo.id); setRenameValue(convo.title || '') }

  async function commitRename(convoId) {
    const newTitle = renameValue.trim() || 'Untitled'
    setConversations(prev => prev.map(c => c.id === convoId ? { ...c, title: newTitle } : c))
    setRenamingId(null)
    try { await callEdge({ action: 'rename_conversation', conversationId: convoId, title: newTitle }) } catch (e) { console.error(e) }
  }

  function handleRenameKeyDown(e, convoId) {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(convoId) }
    if (e.key === 'Escape') setRenamingId(null)
  }

  async function handlePin(convo) {
    const newPinned = !convo.pinned
    setConversations(prev => {
      const updated = prev.map(c => c.id === convo.id ? { ...c, pinned: newPinned } : c)
      return [...updated.filter(c => c.pinned), ...updated.filter(c => !c.pinned)]
    })
    try { await callEdge({ action: 'pin_conversation', conversationId: convo.id, pinned: newPinned }) } catch (e) { console.error(e) }
  }

  async function sendMessage(text) {
    const msg = (text || input).trim()
    if (!msg || sending || tier === 'basic') return
    setInput('')
    setSending(true)
    const optimisticUser = { role: 'user', content: msg }
    setMessages(prev => [...prev, optimisticUser])
    try {
      const data = await callEdge({ message: msg, conversationId: activeConvoId, page: window.location.pathname })
      if (data.error) {
        const errMsg = data.error === 'monthly_limit_reached'
          ? `You have reached your monthly limit of ${data.limit} messages. It resets next month.`
          : data.error === 'daily_limit_reached'
          ? `You have reached your daily limit of ${data.limit} messages. Come back tomorrow.`
          : 'Something went wrong. Please try again.'
        setMessages(prev => [...prev, { role: 'error', content: errMsg }])
        setSending(false)
        return
      }
      if (data.reply) setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      if (data.usage) setUsage(data.usage)
      const newId = data.conversationId
      if (newId && newId !== activeConvoId) {
        setActiveConvoId(newId)
        setConversations(prev => [{ id: newId, title: data.title || msg.slice(0, 60), updated_at: new Date().toISOString(), pinned: false, messages: [optimisticUser, { role: 'assistant', content: data.reply }] }, ...prev])
      } else if (newId) {
        setConversations(prev => prev.map(c => c.id === newId ? { ...c, updated_at: new Date().toISOString(), messages: [...(c.messages || []), optimisticUser, { role: 'assistant', content: data.reply }] } : c))
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'error', content: 'Connection error. Please try again.' }])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.basic
  const isLocked = tier !== null && tier === 'basic'
  const usedMonthly = usage?.monthly || 0
  const monthlyLimit = tierConfig.monthly
  const usagePercent = monthlyLimit ? Math.min(100, (usedMonthly / monthlyLimit) * 100) : 0
  const hasMessages = messages.length > 0
  const firstName = profile?.business_name ? profile.business_name.split(' ')[0] : ''
  const pinnedConvos = conversations.filter(c => c.pinned)
  const unpinnedConvos = conversations.filter(c => !c.pinned)

  function renderConvoItem(convo) {
    const isActive = activeConvoId === convo.id
    const isRenaming = renamingId === convo.id
    const isMenuOpen = openMenuId === convo.id
    return (
      <div key={convo.id} onClick={() => openConversation(convo)} className="ltl-convo"
        style={{ padding: '9px 10px', borderRadius: 10, cursor: 'pointer', background: isActive ? 'rgba(29,185,84,0.12)' : 'transparent', border: `1px solid ${isActive ? GREEN + '66' : 'transparent'}`, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {isRenaming ? (
            <input ref={renameInputRef} value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => handleRenameKeyDown(e, convo.id)} onBlur={() => commitRename(convo.id)} onClick={e => e.stopPropagation()}
              style={{ width: '100%', background: 'var(--lt-input-bg)', border: `1px solid ${GREEN}`, borderRadius: 6, padding: '3px 7px', color: 'var(--lt-text)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          ) : (
            <div style={{ fontSize: 12.5, fontWeight: 600, color: isActive ? GREEN : 'var(--lt-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {convo.pinned ? '★ ' : ''}{convo.title || 'Conversation'}
            </div>
          )}
          {!isRenaming && <div style={{ fontSize: 11, color: 'var(--lt-faint)', marginTop: 2 }}>{formatRelativeTime(convo.updated_at)}</div>}
        </div>
        <button type="button" onClick={e => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : convo.id) }} aria-label="Conversation options" className="ltl-convo-menu"
          style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', cursor: 'pointer', fontSize: 16, padding: '1px 5px', borderRadius: 4, flexShrink: 0, lineHeight: 1, opacity: isActive || isMenuOpen ? 1 : 0, fontFamily: 'inherit' }}>
          &#183;&#183;&#183;
        </button>
        {isMenuOpen && <ConvoMenu convo={convo} onRename={startRename} onPin={handlePin} onDelete={handleDelete} onClose={() => setOpenMenuId(null)} />}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100dvh - 64px)', minHeight: 420, position: 'relative', overflow: 'hidden', background: 'transparent', borderRadius: 18, border: 'var(--lt-glass-border)', boxShadow: 'var(--lt-glass-shadow)', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @keyframes lumiPulse { 0%,80%,100% { opacity:.3; transform:scale(.8) } 40% { opacity:1; transform:scale(1) } }
        .ltl-convo:hover .ltl-convo-menu { opacity: 1 !important; }
        .ltl-convo:hover { background: var(--lt-surface) !important; }
        .ltl-quick:hover { transform: translateY(-1px); }
      `}</style>

      {/* Sidebar */}
      <div style={{
        width: isMobile ? '100%' : (sidebarOpen ? 260 : 0),
        minWidth: isMobile ? 'unset' : (sidebarOpen ? 260 : 0),
        maxWidth: isMobile ? 300 : 'unset',
        position: isMobile ? 'absolute' : 'relative', top: 0, left: 0, height: '100%',
        zIndex: isMobile ? 200 : 1,
        transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        transition: isMobile ? 'transform .25s ease' : 'width .2s ease, min-width .2s ease',
        overflow: 'hidden',
        background: 'var(--lt-glass-bg)', backdropFilter: 'var(--lt-glass-blur)', WebkitBackdropFilter: 'var(--lt-glass-blur)',
        borderRight: '1px solid var(--lt-hairline)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 14px 12px', borderBottom: '1px solid var(--lt-hairline)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--lt-text)' }}>Conversations</span>
          </div>
          <button type="button" onClick={startNewConversation}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: GREEN, color: '#04120a', border: 'none', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> New conversation
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {loadingConvos ? (
            <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--lt-faint)', fontSize: 12 }}>Loading…</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--lt-faint)', fontSize: 12 }}>No conversations yet</div>
          ) : (
            <>
              {pinnedConvos.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--lt-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 10px 6px' }}>Pinned</div>
                  {pinnedConvos.map(renderConvoItem)}
                  {unpinnedConvos.length > 0 && <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--lt-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 10px 6px' }}>Recent</div>}
                </>
              )}
              {unpinnedConvos.map(renderConvoItem)}
            </>
          )}
        </div>
        {!isLocked && monthlyLimit !== null && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--lt-hairline)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--lt-muted)' }}>Monthly messages</span>
              <span style={{ fontSize: 11, color: 'var(--lt-muted)' }}>{usedMonthly} / {monthlyLimit}</span>
            </div>
            <div style={{ height: 4, background: 'var(--lt-track)', borderRadius: 2 }}>
              <div style={{ height: '100%', borderRadius: 2, background: usagePercent > 85 ? PINK : GREEN, width: `${usagePercent}%`, transition: 'width .3s ease' }} />
            </div>
          </div>
        )}
      </div>

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'absolute', inset: 0, zIndex: 199, background: 'rgba(8,7,13,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--lt-glass-bg)', backdropFilter: 'var(--lt-glass-blur)', WebkitBackdropFilter: 'var(--lt-glass-blur)' }}>
        {/* Top bar */}
        <div style={{ padding: isMobile ? '12px 14px' : '14px 20px', borderBottom: '1px solid var(--lt-hairline)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button type="button" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle conversations"
            style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', cursor: 'pointer', padding: '2px 4px', borderRadius: 6, display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: LUMI_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><LumiMark size={16} /></div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--lt-text)' }}>Lumi AI</div>
            <div style={{ fontSize: 11, color: 'var(--lt-muted)' }}>Your LensTrybe business assistant</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.05em', color: isLocked ? 'var(--lt-muted)' : GREEN, background: isLocked ? 'var(--lt-surface)' : 'rgba(29,185,84,0.14)', border: `1px solid ${isLocked ? 'var(--lt-border)' : GREEN + '66'}` }}>{tier || '…'}</span>
          </div>
        </div>

        {isLocked ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ maxWidth: 420, textAlign: 'center', padding: 40, background: 'var(--lt-glass-bg)', border: 'var(--lt-glass-border)', boxShadow: 'var(--lt-glass-shadow)', backdropFilter: 'var(--lt-glass-blur)', WebkitBackdropFilter: 'var(--lt-glass-blur)', borderRadius: 18 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: LUMI_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><LumiMark size={28} /></div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--lt-text)', marginBottom: 8 }}>Meet Lumi</div>
              <div style={{ fontSize: 14, color: 'var(--lt-muted)', lineHeight: 1.6, marginBottom: 24 }}>
                Lumi is your AI business assistant. Get help with pricing, client proposals, contracts, and growing your creative business. Available on Pro and above.
              </div>
              <button type="button" onClick={() => navigate('/dashboard/settings/subscription')}
                style={{ padding: '12px 28px', borderRadius: 10, background: GREEN, color: '#04120a', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                Upgrade to unlock Lumi
              </button>
            </div>
          </div>
        ) : tier === null ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lt-faint)', fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!hasMessages && (
                <div style={{ maxWidth: 560, margin: '0 auto', width: '100%', paddingTop: 20 }}>
                  <div style={{ textAlign: 'center', marginBottom: 26 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: LUMI_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><LumiMark size={26} /></div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--lt-text)', marginBottom: 6 }}>Hi{firstName ? `, ${firstName}` : ''}. I am Lumi.</div>
                    <div style={{ fontSize: 14, color: 'var(--lt-muted)', lineHeight: 1.6 }}>Your AI business assistant. Ask me anything about running your creative business.</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {QUICK_PROMPTS.map(p => (
                      <button key={p} type="button" onClick={() => sendMessage(p)} className="ltl-quick"
                        style={{ padding: '12px 14px', background: 'var(--lt-glass-bg)', border: 'var(--lt-glass-border)', boxShadow: 'var(--lt-glass-shadow)', backdropFilter: 'var(--lt-glass-blur)', WebkitBackdropFilter: 'var(--lt-glass-blur)', borderRadius: 12, color: 'var(--lt-text)', fontSize: 13, cursor: 'pointer', textAlign: 'left', lineHeight: 1.4, fontFamily: 'inherit', transition: 'transform .12s ease' }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => {
                const isUser = msg.role === 'user'
                const isError = msg.role === 'error'
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start', maxWidth: '80%', alignSelf: isUser ? 'flex-end' : 'flex-start' }}>
                    {!isUser && (
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: isError ? 'rgba(255,45,120,0.15)' : LUMI_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        {isError ? <span style={{ color: PINK, fontWeight: 800 }}>!</span> : <LumiMark size={15} />}
                      </div>
                    )}
                    <div style={{ padding: '11px 15px', borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px', fontSize: 14, lineHeight: 1.6, color: isError ? PINK : (isUser ? '#04120a' : 'var(--lt-text)'), background: isUser ? GREEN : (isError ? 'rgba(255,45,120,0.10)' : 'var(--lt-surface)'), border: isUser ? 'none' : `1px solid ${isError ? PINK + '55' : 'var(--lt-border)'}`, maxWidth: '100%' }}>
                      {isUser ? msg.content : <MarkdownText text={msg.content} />}
                    </div>
                  </div>
                )
              })}

              {sending && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', alignSelf: 'flex-start' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: LUMI_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><LumiMark size={15} /></div>
                  <div style={{ padding: '14px 18px', background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', borderRadius: '14px 14px 14px 4px', display: 'flex', gap: 5, alignItems: 'center' }}>
                    {[0, 1, 2].map(j => (<div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lt-muted)', animation: `lumiPulse 1.2s ease-in-out ${j * 0.2}s infinite` }} />))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: isMobile ? '10px 12px' : '14px 20px', borderTop: '1px solid var(--lt-hairline)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: 'var(--lt-input-bg)', border: '1px solid var(--lt-input-border)', borderRadius: 12, padding: '8px 12px' }}>
                <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask Lumi anything about your business…" rows={1}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--lt-text)', fontSize: 14, resize: 'none', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', fontFamily: 'inherit' }} />
                <button type="button" onClick={() => sendMessage()} disabled={!input.trim() || sending} aria-label="Send message"
                  style={{ width: 36, height: 36, borderRadius: 9, border: 'none', flexShrink: 0, cursor: input.trim() && !sending ? 'pointer' : 'not-allowed', background: input.trim() && !sending ? GREEN : 'var(--lt-surface-2)', color: input.trim() && !sending ? '#04120a' : 'var(--lt-faint)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ↑
                </button>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: 'var(--lt-faint)' }}>
                {tier === 'elite' ? 'Unlimited messages. Elite tier.' : monthlyLimit !== null ? `${Math.max(0, monthlyLimit - usedMonthly)} messages remaining this month` : null}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
