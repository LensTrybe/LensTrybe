import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { tierHas, getFeatures, TIER_ORDER, UNLIMITED } from '../../lib/tierFeatures'
import { useAuth } from '../../context/AuthContext'

// Global Lumi launcher: a floating circle on every dashboard page (stacked above
// the notification bell / Notes circle) that opens a slide-in glass chat drawer.
// The drawer stays over whatever page the creative is on, so Lumi can work in
// context (e.g. help while they are on Invoicing). Theme-aware via --lt-* tokens.

const LUMI_GRAD = 'linear-gradient(135deg, #1DB954 0%, #FF2D78 100%)'
const GREEN = '#1DB954'
const PINK = '#FF2D78'

// Lumi's allowance per plan comes from tierFeatures like every other limit, so the
// pricing card and the quota can't drift apart. null monthly means unlimited.
const TIER_CONFIG = Object.fromEntries(TIER_ORDER.map((t) => {
  const f = getFeatures(t)
  return [t, { monthly: f.lumiPerMonth === UNLIMITED ? null : f.lumiPerMonth, daily: f.lumiPerDay }]
}))

const QUICK_PROMPTS = [
  'Help me price a project',
  'Write a client proposal',
  'How do I follow up on overdue invoices?',
  'Tips to attract more clients',
]

function LumiMark({ size = 16 }) {
  // Simple sparkle glyph for the Lumi avatar/launcher.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: 'block' }}>
      <path d="M12 2.5l1.9 5.2a4 4 0 0 0 2.4 2.4L21.5 12l-5.2 1.9a4 4 0 0 0-2.4 2.4L12 21.5l-1.9-5.2a4 4 0 0 0-2.4-2.4L2.5 12l5.2-1.9a4 4 0 0 0 2.4-2.4L12 2.5z" fill="#ffffff" />
    </svg>
  )
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

export default function LumiWidget() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [tier, setTier] = useState(null)
  const [profile, setProfile] = useState(null)
  const [conversations, setConversations] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [activeConvoId, setActiveConvoId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [usage, setUsage] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Let other parts of the app (e.g. the sidebar Lumi item) open the drawer.
  useEffect(() => {
    function onOpen() { setOpen(true) }
    window.addEventListener('lt:open-lumi', onOpen)
    return () => window.removeEventListener('lt:open-lumi', onOpen)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('subscription_tier, business_name').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        setProfile(data || null)
        setTier((data?.subscription_tier || 'basic').toLowerCase())
      })
  }, [user?.id])

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
    try {
      const data = await callEdge({ action: 'load_conversations' })
      setConversations(data.conversations || [])
    } catch { /* ignore */ }
  }, [callEdge])

  // Load history the first time the drawer opens for a paid user.
  useEffect(() => {
    if (open && user?.id && tier && tierHas(tier, 'lumiPerMonth')) loadConversations()
  }, [open, user?.id, tier, loadConversations])

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, sending])

  useEffect(() => {
    if (open && tier && tierHas(tier, 'lumiPerMonth')) setTimeout(() => inputRef.current?.focus(), 120)
  }, [open, tier])

  function openConversation(convo) {
    setActiveConvoId(convo.id)
    setMessages(convo.messages || [])
    setShowHistory(false)
  }

  function startNewConversation() {
    setActiveConvoId(null)
    setMessages([])
    setShowHistory(false)
    setTimeout(() => inputRef.current?.focus(), 60)
  }

  async function sendMessage(text) {
    const msg = (text || input).trim()
    if (!msg || sending || !tierHas(tier, 'lumiPerMonth')) return
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
          : data.error === 'tier_locked'
          ? 'Lumi is available on Pro and above.'
          : 'Something went wrong. Please try again.'
        setMessages(prev => [...prev, { role: 'error', content: errMsg }])
        return
      }
      if (data.reply) setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      if (data.usage) setUsage(data.usage)
      const newId = data.conversationId
      if (newId && newId !== activeConvoId) {
        setActiveConvoId(newId)
        setConversations(prev => [{
          id: newId,
          title: data.title || msg.slice(0, 60),
          updated_at: new Date().toISOString(),
          pinned: false,
          messages: [optimisticUser, { role: 'assistant', content: data.reply }],
        }, ...prev])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'error', content: 'Connection error. Please try again.' }])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  if (!user) return null

  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.basic
  // Lumi is an Expert and Elite feature. Reading it from tierFeatures keeps this in
  // step with the pricing pages and the sidebar rather than hardcoding the plan.
  const isLocked = !tierHas(tier, 'lumiPerMonth')
  const monthlyLimit = tierConfig.monthly
  const usedMonthly = usage?.monthly || 0
  const hasMessages = messages.length > 0
  const firstName = profile?.business_name ? profile.business_name.split(' ')[0] : ''

  const drawerWidth = isMobile ? 'calc(100vw - 0px)' : 420

  return (
    <>
      <style>{`
        @keyframes lumiPulse { 0%,80%,100% { opacity: .3; transform: scale(.8) } 40% { opacity: 1; transform: scale(1) } }
        @keyframes lumiSlideIn { from { transform: translateX(24px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        .lumi-launch { position: fixed; right: 24px; bottom: 148px; z-index: 952; width: 52px; height: 52px; border-radius: 50%; border: none; cursor: pointer; background: ${LUMI_GRAD}; box-shadow: 0 10px 26px -8px rgba(255,45,120,0.5), 0 4px 12px -4px rgba(29,185,84,0.5); display: flex; align-items: center; justify-content: center; transition: transform .14s ease; }
        .lumi-launch:hover { transform: translateY(-2px) scale(1.04); }
        .lumi-overlay { position: fixed; inset: 0; z-index: 1490; background: rgba(8,7,13,0.32); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); }
        .lumi-drawer { position: fixed; top: 0; right: 0; height: 100dvh; z-index: 1491; display: flex; flex-direction: column; background: var(--lt-modal-bg); border-left: var(--lt-modal-border); box-shadow: var(--lt-modal-shadow); backdrop-filter: var(--lt-modal-blur); -webkit-backdrop-filter: var(--lt-modal-blur); animation: lumiSlideIn .22s ease; }
        .lumi-icon-btn { background: none; border: none; color: var(--lt-muted); cursor: pointer; padding: 6px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: background .12s ease, color .12s ease; }
        .lumi-icon-btn:hover { background: var(--lt-surface); color: var(--lt-text); }
        .lumi-quick { text-align: left; padding: 12px 14px; border-radius: 12px; background: var(--lt-glass-bg); border: var(--lt-glass-border); box-shadow: var(--lt-glass-shadow); backdrop-filter: var(--lt-glass-blur); -webkit-backdrop-filter: var(--lt-glass-blur); color: var(--lt-text); font-size: 13px; font-family: inherit; cursor: pointer; line-height: 1.4; transition: transform .12s ease; }
        .lumi-quick:hover { transform: translateY(-1px); }
        .lumi-convo { padding: 10px 12px; border-radius: 10px; cursor: pointer; border: 1px solid transparent; }
        .lumi-convo:hover { background: var(--lt-surface); }
      `}</style>

      {!open && (
        <button type="button" className="lumi-launch" aria-label="Open Lumi AI" onClick={() => setOpen(true)}>
          <LumiMark size={22} />
        </button>
      )}

      {open && (
        <>
          <div className="lumi-overlay" onClick={() => setOpen(false)} />
          <div className="lumi-drawer" style={{ width: drawerWidth, maxWidth: '100vw' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--lt-hairline)', flexShrink: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: LUMI_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <LumiMark size={18} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--lt-text)', lineHeight: 1.1 }}>Lumi AI</div>
                <div style={{ fontSize: 11.5, color: 'var(--lt-muted)', marginTop: 2 }}>Your LensTrybe business assistant</div>
              </div>
              {tier && (
                <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.05em', color: isLocked ? 'var(--lt-muted)' : GREEN, background: isLocked ? 'var(--lt-surface)' : 'rgba(29,185,84,0.14)', border: `1px solid ${isLocked ? 'var(--lt-border)' : GREEN + '66'}` }}>{tier}</span>
              )}
              {!isLocked && (
                <>
                  <button type="button" className="lumi-icon-btn" aria-label="Conversation history" onClick={() => setShowHistory(h => !h)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-9 9"/><path d="M3 12H1m2 0 2.5-2.5M12 7v5l3 2"/></svg>
                  </button>
                  <button type="button" className="lumi-icon-btn" aria-label="New conversation" onClick={startNewConversation}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                </>
              )}
              <button type="button" className="lumi-icon-btn" aria-label="Close Lumi" onClick={() => setOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* History dropdown */}
            {showHistory && !isLocked && (
              <div style={{ borderBottom: '1px solid var(--lt-hairline)', maxHeight: 220, overflowY: 'auto', padding: 8, flexShrink: 0 }}>
                {conversations.length === 0 ? (
                  <div style={{ padding: '14px 10px', textAlign: 'center', color: 'var(--lt-faint)', fontSize: 12.5 }}>No conversations yet</div>
                ) : conversations.map(c => (
                  <div key={c.id} className="lumi-convo" onClick={() => openConversation(c)} style={{ background: activeConvoId === c.id ? 'var(--lt-surface)' : 'transparent' }}>
                    <div style={{ fontSize: 13, color: 'var(--lt-text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title || 'Conversation'}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Body */}
            {isLocked ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ textAlign: 'center', maxWidth: 320 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: LUMI_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><LumiMark size={26} /></div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--lt-text)', marginBottom: 8 }}>Meet Lumi</div>
                  <div style={{ fontSize: 13.5, color: 'var(--lt-muted)', lineHeight: 1.6, marginBottom: 22 }}>
                    Your AI business assistant for pricing, proposals, contracts and growing your creative business. Available on Pro and above.
                  </div>
                  <button type="button" onClick={() => { setOpen(false); navigate('/dashboard/settings/subscription') }} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: GREEN, color: '#04120a', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Upgrade to unlock Lumi
                  </button>
                </div>
              </div>
            ) : tier === null ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lt-faint)', fontSize: 13 }}>Loading…</div>
            ) : (
              <>
                <div style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {!hasMessages && (
                    <div style={{ paddingTop: 8 }}>
                      <div style={{ textAlign: 'center', marginBottom: 22 }}>
                        <div style={{ width: 52, height: 52, borderRadius: '50%', background: LUMI_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><LumiMark size={24} /></div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--lt-text)', marginBottom: 6 }}>Hi{firstName ? `, ${firstName}` : ''}. I am Lumi.</div>
                        <div style={{ fontSize: 13.5, color: 'var(--lt-muted)', lineHeight: 1.6 }}>Ask me anything about running your creative business.</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {QUICK_PROMPTS.map(p => (
                          <button key={p} type="button" className="lumi-quick" onClick={() => sendMessage(p)}>{p}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((msg, i) => {
                    const isUser = msg.role === 'user'
                    const isError = msg.role === 'error'
                    return (
                      <div key={i} style={{ display: 'flex', gap: 9, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start', maxWidth: '88%', alignSelf: isUser ? 'flex-end' : 'flex-start' }}>
                        {!isUser && (
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: isError ? 'rgba(255,45,120,0.15)' : LUMI_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                            {isError ? <span style={{ color: PINK, fontWeight: 800, fontSize: 15 }}>!</span> : <LumiMark size={14} />}
                          </div>
                        )}
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          fontSize: 13.5, lineHeight: 1.6,
                          color: isError ? PINK : (isUser ? '#04120a' : 'var(--lt-text)'),
                          background: isUser ? GREEN : (isError ? 'rgba(255,45,120,0.10)' : 'var(--lt-surface)'),
                          border: isUser ? 'none' : `1px solid ${isError ? PINK + '55' : 'var(--lt-border)'}`,
                        }}>
                          {isUser ? msg.content : <MarkdownText text={msg.content} />}
                        </div>
                      </div>
                    )
                  })}

                  {sending && (
                    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', alignSelf: 'flex-start' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: LUMI_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><LumiMark size={14} /></div>
                      <div style={{ padding: '13px 16px', background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', borderRadius: '14px 14px 14px 4px', display: 'flex', gap: 5 }}>
                        {[0, 1, 2].map(j => (<div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lt-muted)', animation: `lumiPulse 1.2s ease-in-out ${j * 0.2}s infinite` }} />))}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Composer */}
                <div style={{ padding: '12px 14px', borderTop: '1px solid var(--lt-hairline)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--lt-input-bg)', border: '1px solid var(--lt-input-border)', borderRadius: 12, padding: '8px 10px' }}>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={onKeyDown}
                      placeholder="Ask Lumi anything about your business…"
                      rows={1}
                      style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--lt-text)', fontSize: 13.5, resize: 'none', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', fontFamily: 'inherit' }}
                    />
                    <button
                      type="button"
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || sending}
                      aria-label="Send"
                      style={{ width: 34, height: 34, borderRadius: 9, border: 'none', flexShrink: 0, cursor: input.trim() && !sending ? 'pointer' : 'not-allowed', background: input.trim() && !sending ? GREEN : 'var(--lt-surface-2)', color: input.trim() && !sending ? '#04120a' : 'var(--lt-faint)', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >↑</button>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 7, fontSize: 11, color: 'var(--lt-faint)' }}>
                    {tier === 'elite' ? 'Unlimited messages, Elite tier.' : monthlyLimit != null ? `${Math.max(0, monthlyLimit - usedMonthly)} of ${monthlyLimit} messages left this month` : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
