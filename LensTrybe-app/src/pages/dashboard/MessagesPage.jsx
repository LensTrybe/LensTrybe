import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatClientAccountDisplayName } from '../../lib/clientDisplayName'
import { creativeSenderDisplayName } from '../../lib/creativeDisplayName'
import {
  MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE,
  messageBodyContainsContactDetails,
  threadOwnerTierContactSharingRestricted,
} from '../../lib/messagingContactPolicy'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import {
  DIVIDER_GRADIENT_STYLE,
  GLASS_CARD,
  GLASS_MODAL_OVERLAY_BASE,
  GLASS_MODAL_PANEL,
  GLASS_NATIVE_FIELD,
  TYPO,
} from '../../lib/glassTokens'

export default function MessagesPage() {
  const { user, profile, clientAccount } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [threads, setThreads] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [editingNickname, setEditingNickname] = useState(false)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [sendingPortal, setSendingPortal] = useState(false)
  const [newMessageEmail, setNewMessageEmail] = useState('')
  const [newMessageName, setNewMessageName] = useState('')
  const [newMessageText, setNewMessageText] = useState('')
  const [toast, setToast] = useState(null)
  const bottomRef = useRef(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function sendPortal() {
    if (!newMessageEmail.trim() || !newMessageText.trim()) return
    if (!profile?.id) { showToast('Only creatives can send new messages', 'error'); return }
    setSendingPortal(true)
    try {
      const bodyText = newMessageText.trim()
      if (
        threadOwnerTierContactSharingRestricted(profile?.subscription_tier) &&
        messageBodyContainsContactDetails(bodyText)
      ) {
        showToast(MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE, 'error')
        setSendingPortal(false)
        return
      }

      const email = newMessageEmail.trim()

      // Look up if client already has an account
      const { data: clientAccount } = await supabase
        .from('client_accounts')
        .select('id, email')
        .eq('email', email)
        .maybeSingle()

      // Create message thread
      const { data: thread, error: threadError } = await supabase
        .from('message_threads')
        .insert({
          creative_id: user.id,
          client_user_id: clientAccount?.id ?? null,
          client_name: newMessageName || email,
          client_email: email,
          subject: 'New Message',
        })
        .select()
        .single()
      if (threadError) throw threadError

      // Insert message
      const creativeLabel = creativeSenderDisplayName(profile, user)
      const { error: msgError } = await supabase.from('messages').insert({
        thread_id: thread.id,
        sender_type: 'creative',
        sender_name: creativeLabel,
        body: bodyText,
        creative_id: user.id,
      })
      if (msgError) throw msgError

      // Send email notification
      const { error: fnError } = await supabase.functions.invoke('send-message-notification', {
        body: {
          to: email,
          toName: newMessageName || email,
          fromName: creativeLabel,
          subject: `New message from ${creativeLabel} on LensTrybe`,
          messageBody: bodyText,
          threadSubject: 'New Message',
        },
      })
      if (fnError) throw fnError

      await loadThreads()
      setShowNewMessage(false)
      setNewMessageEmail('')
      setNewMessageName('')
      setNewMessageText('')
      showToast('Message sent to ' + email)
    } catch (err) {
      showToast('Failed to send: ' + (err?.message ?? 'Unknown error'), 'error')
    }
    setSendingPortal(false)
  }

  useEffect(() => { loadThreads() }, [user, profile?.id])
  useEffect(() => { if (selected) loadMessages(selected.id) }, [selected])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function loadThreads() {
    if (!user) return
    const { data: asOwner } = await supabase
      .from('message_threads')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })

    let asClient = []
    if (profile) {
      const { data: clientRows } = await supabase
        .from('message_threads')
        .select('*')
        .eq('client_user_id', user.id)
        .neq('creative_id', user.id)
        .order('created_at', { ascending: false })
      asClient = clientRows ?? []
    }

    const byId = new Map()
    for (const t of [...(asOwner ?? []), ...asClient]) {
      if (!byId.has(t.id)) byId.set(t.id, t)
    }
    const merged = Array.from(byId.values()).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    )

    const otherCreativeIds = [...new Set(merged.filter(t => t.creative_id !== user.id).map(t => t.creative_id))]
    let nameByCreativeId = {}
    let tierByCreativeId = {}
    if (otherCreativeIds.length > 0) {
      const { data: sellers } = await supabase
        .from('profiles')
        .select('id, business_name, subscription_tier')
        .in('id', otherCreativeIds)
        .eq('is_admin', false)
      for (const p of sellers ?? []) {
        nameByCreativeId[p.id] = p.business_name
        tierByCreativeId[p.id] = p.subscription_tier
      }
    }

    const clientIdsForMyThreads = [...new Set(
      merged.filter(t => t.creative_id === user.id && t.client_user_id).map(t => t.client_user_id),
    )]
    let nameByClientId = {}
    if (clientIdsForMyThreads.length > 0) {
      const { data: clientRows } = await supabase
        .from('client_accounts')
        .select('id, first_name, last_name, company_name, email')
        .in('id', clientIdsForMyThreads)
      for (const c of clientRows ?? []) {
        nameByClientId[c.id] = formatClientAccountDisplayName(c)
      }
    }

    // For each thread, check if latest message is from client and after last_read_at
    const threadsWithUnread = merged.map(t => {
      const lastRead = t.last_read_at ? new Date(t.last_read_at) : new Date(0)
      const lastMsg = t.last_message_at ? new Date(t.last_message_at) : null
      const resolvedClientName =
        t.creative_id === user.id && t.client_user_id
          ? (nameByClientId[t.client_user_id] || null)
          : null
      const peerDisplayName = t.creative_id === user.id
        ? (resolvedClientName ?? t.client_name ?? t.client_email ?? 'Client')
        : (nameByCreativeId[t.creative_id] ?? 'Creative')
      const threadOwnerTier = t.creative_id === user.id ? profile?.subscription_tier : tierByCreativeId[t.creative_id]
      const contactSharingRestricted = threadOwnerTierContactSharingRestricted(threadOwnerTier)
      return { ...t, peerDisplayName, resolvedClientName, contactSharingRestricted, isUnread: lastMsg && lastMsg > lastRead }
    })

    setThreads(threadsWithUnread)
    setSelected(prev => {
      if (threadsWithUnread.length === 0) return null
      if (!prev) return threadsWithUnread[0]
      return threadsWithUnread.find(t => t.id === prev.id) ?? threadsWithUnread[0]
    })
    setLoading(false)
  }

  async function loadMessages(threadId) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
  }

  async function sendReply() {
    if (!reply.trim() || !selected) return
    const bodyText = reply.trim()
    if (selected.contactSharingRestricted && messageBodyContainsContactDetails(bodyText)) {
      showToast(MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE, 'error')
      return
    }
    setSending(true)
    const imListingCreative = selected.creative_id === user.id

    if (imListingCreative) {
      const creativeLabel = creativeSenderDisplayName(profile, user)
      await supabase.from('messages').insert({
        thread_id: selected.id,
        sender_type: 'creative',
        sender_name: creativeLabel,
        body: bodyText,
        creative_id: user.id,
      })
      if (selected?.client_email) {
        const { data, error } = await supabase.functions.invoke('send-message-notification', {
          body: {
            to: selected.client_email,
            toName: selected.resolvedClientName ?? selected.client_name ?? selected.client_email,
            fromName: creativeLabel,
            subject: `Reply from ${creativeLabel} on LensTrybe`,
            messageBody: bodyText,
            threadSubject: selected.subject ?? 'your enquiry',
            profileUrl: 'https://lens-trybe.vercel.app',
          },
        })
        console.log('Email result:', data, error)
      }
    } else {
      const clientSenderName = formatClientAccountDisplayName(clientAccount) || user.email
      const msgPayload = {
        thread_id: selected.id,
        sender_type: 'client',
        sender_name: clientSenderName,
        body: bodyText,
        creative_id: user.id,
      }
      await supabase.from('messages').insert(msgPayload)
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('business_email, business_name')
        .eq('id', selected.creative_id)
        .eq('is_admin', false)
        .maybeSingle()
      if (sellerProfile?.business_email) {
        await supabase.functions.invoke('send-message-notification', {
          body: {
            to: sellerProfile.business_email,
            toName: sellerProfile.business_name ?? 'there',
            fromName: clientSenderName,
            subject: `Reply from ${clientSenderName} on LensTrybe`,
            messageBody: bodyText,
            threadSubject: selected.subject ?? 'your enquiry',
          },
        })
      }
    }

    await supabase.from('message_threads').update({ updated_at: new Date().toISOString() }).eq('id', selected.id)
    setReply('')
    await loadMessages(selected.id)
    await loadThreads()
    setSending(false)
  }

  const styles = {
    page: { display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: isMobile ? 'auto' : 'calc(100vh - 64px)', minHeight: isMobile ? 'calc(100vh - 140px)' : 'auto', gap: '0', ...GLASS_CARD, borderRadius: 'var(--radius-xl)', overflow: 'hidden' },
    sidebar: { width: isMobile ? '100%' : '300px', borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.12)', borderBottom: isMobile ? '1px solid rgba(255,255,255,0.08)' : 'none', display: 'flex', flexDirection: 'column', flexShrink: 0, maxHeight: isMobile ? '280px' : 'none' },
    sidebarHeader: { padding: '20px', fontSize: '15px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', ...TYPO.heading },
    threadList: { flex: 1, overflowY: 'auto' },
    thread: (active) => ({
      padding: '16px 20px',
      cursor: 'pointer',
      background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
      borderLeft: active ? '2px solid var(--green)' : '2px solid transparent',
      transition: 'all var(--transition-fast)',
    }),
    threadName: { fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', marginBottom: '4px', ...TYPO.body, fontWeight: 500 },
    threadPreview: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...TYPO.body },
    main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
    mainHeader: { padding: isMobile ? '14px 16px' : '20px 24px', display: 'flex', alignItems: 'center', gap: '12px' },
    mainName: { fontSize: '15px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', ...TYPO.heading },
    messageList: { flex: 1, overflowY: 'auto', padding: isMobile ? '16px 10px' : '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
    message: (isCreative) => ({
      display: 'flex',
      justifyContent: isCreative ? 'flex-end' : 'flex-start',
      width: '100%',
      padding: isMobile ? '2px 4px' : '2px 16px',
      boxSizing: 'border-box',
    }),
    bubble: {
      padding: '10px 14px',
      borderRadius: '18px',
      maxWidth: isMobile ? '88%' : '55%',
      minWidth: 'auto',
      display: 'block',
      wordBreak: 'break-word',
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      fontSize: '14px',
      fontFamily: 'var(--font-ui)',
      ...TYPO.body,
    },
    bubbleTime: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px', textAlign: 'right', ...TYPO.body },
    replyBar: { padding: isMobile ? '12px 12px 14px' : '16px 24px', display: 'flex', gap: '12px', alignItems: 'flex-end' },
    emptyState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px', ...TYPO.body },
  }

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)', background: 'transparent', ...TYPO.body }}>Loading messages…</div>

  return (
    <div style={{ background: 'transparent' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: toast.type === 'success' ? '#1DB954' : '#ef4444', color: toast.type === 'success' ? '#000' : '#fff', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '16px 12px 0' : '24px 24px 0', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '24px' : '22px', color: 'var(--text-primary)', ...TYPO.heading }}>Messages</div>
        {profile && (
          <Button type="button" variant="primary" style={{ minHeight: '44px' }} onClick={() => { setNewMessageEmail(''); setNewMessageName(''); setNewMessageText(''); setShowNewMessage(true) }}>
            + New Message
          </Button>
        )}
      </div>

      <div style={styles.page}>
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>Conversations ({threads.length})</div>
          <div style={DIVIDER_GRADIENT_STYLE} aria-hidden />
          <div style={styles.threadList}>
            {threads.length === 0 ? (
              <div style={{ padding: '32px 20px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', ...TYPO.body }}>
                No messages yet. When clients enquire, they'll appear here.
              </div>
            ) : threads.map((t, ti) => (
              <div key={t.id}>
              <div style={{ ...styles.thread(selected?.id === t.id), position: 'relative' }}
                onClick={async () => {
                  setSelected(t)
                  await supabase.from('message_threads').update({ last_read_at: new Date().toISOString() }).eq('id', t.id)
                  setThreads(prev => prev.map(x => x.id === t.id ? { ...x, isUnread: false } : x))
                }}
                onMouseEnter={e => e.currentTarget.querySelector('.del-btn').style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.querySelector('.del-btn').style.opacity = '0'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {t.isUnread && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1DB954', flexShrink: 0 }} />}
                  <div style={{ ...styles.threadName, color: t.isUnread ? 'var(--text-primary)' : undefined, fontWeight: t.isUnread ? 700 : undefined }}>{t.nickname ?? t.peerDisplayName}</div>
                </div>
                <div style={styles.threadPreview}>{t.subject ?? 'New enquiry'}</div>
                <button
                  className="del-btn"
                  onClick={async e => {
                    e.stopPropagation()
                    if (!window.confirm('Delete this conversation?')) return
                    await supabase.from('messages').delete().eq('thread_id', t.id)
                    await supabase.from('message_threads').delete().eq('id', t.id)
                    setThreads(prev => prev.filter(x => x.id !== t.id))
                    if (selected?.id === t.id) setSelected(null)
                  }}
                  style={{
                    position: 'absolute', top: '8px', right: '8px',
                    opacity: '0', background: 'none', border: 'none',
                    color: 'var(--error)', cursor: 'pointer', fontSize: '14px',
                    transition: 'opacity 0.2s', padding: '2px 6px',
                  }}
                >✕</button>
              </div>
              {ti < threads.length - 1 ? <div style={DIVIDER_GRADIENT_STYLE} aria-hidden /> : null}
              </div>
            ))}
          </div>
        </div>

        <div style={styles.main}>
          {!selected ? (
            <div style={styles.emptyState}>Select a conversation to view messages</div>
          ) : (
            <>
              <div style={styles.mainHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  {editingNickname ? (
                    <input
                      autoFocus
                      defaultValue={selected?.nickname ?? selected?.peerDisplayName ?? ''}
                      style={{ ...GLASS_NATIVE_FIELD, padding: '4px 8px', fontSize: '14px' }}
                      onBlur={async e => {
                        const nickname = e.target.value.trim()
                        await supabase.from('message_threads').update({ nickname }).eq('id', selected.id)
                        setThreads(prev => prev.map(t => t.id === selected.id ? { ...t, nickname } : t))
                        setSelected(prev => ({ ...prev, nickname }))
                        setEditingNickname(false)
                      }}
                      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                    />
                  ) : (
                    <>
                      <span style={styles.mainName}>{selected?.nickname ?? selected?.peerDisplayName ?? 'Client'}</span>
                      <button type="button" onClick={() => setEditingNickname(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>✎</button>
                    </>
                  )}
                </div>
              </div>
              <div style={DIVIDER_GRADIENT_STYLE} aria-hidden />

              <div style={styles.messageList}>
                {messages.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-ui)', textAlign: 'center', marginTop: '40px' }}>
                    No messages in this thread yet.
                  </div>
                ) : messages.map((msg, i) => {
                  const isCreative = msg.sender_type === 'creative'
                  return (
                    <div key={i} style={styles.message(isCreative)}>
                      <div>
                        <div style={{
                          ...styles.bubble,
                          ...(isCreative
                            ? { background: 'var(--green)', border: 'none', color: '#000' }
                            : { ...GLASS_CARD, borderRadius: '18px', color: 'var(--text-primary)' }),
                        }}>{msg.body}</div>
                        <div style={styles.bubbleTime}>
                          {new Date(msg.created_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <div style={DIVIDER_GRADIENT_STYLE} aria-hidden />
              <div style={styles.replyBar}>
                <div style={{ flex: 1 }}>
                  <Input
                    placeholder="Type your reply…"
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                  />
                </div>
                <Button variant="primary" size="md" style={{ minHeight: '44px' }} disabled={sending || !reply.trim()} onClick={sendReply}>
                  {sending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {showNewMessage && (
        <div style={{ position: 'fixed', inset: 0, ...GLASS_MODAL_OVERLAY_BASE, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ ...GLASS_MODAL_PANEL, borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px', ...TYPO.heading }}>New Message</div>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px', ...TYPO.body }}>
              {"Send a portal link to a client. Enter their email address and they'll receive a link to view their invoices, quotes, contracts and messages with you — no account needed."}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px', ...TYPO.label }}>Client Name</label>
                <input
                  value={newMessageName}
                  onChange={e => setNewMessageName(e.target.value)}
                  placeholder="Jane Smith"
                  style={{ width: '100%', padding: '9px 12px', ...GLASS_NATIVE_FIELD }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px', ...TYPO.label }}>Client Email</label>
                <input
                  type="email"
                  value={newMessageEmail}
                  onChange={e => setNewMessageEmail(e.target.value)}
                  placeholder="jane@example.com"
                  style={{ width: '100%', padding: '9px 12px', ...GLASS_NATIVE_FIELD }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px', ...TYPO.label }}>Message</label>
                <textarea
                  value={newMessageText}
                  onChange={e => setNewMessageText(e.target.value)}
                  placeholder="Write your message..."
                  style={{ width: '100%', padding: '9px 12px', minHeight: '100px', resize: 'vertical', ...GLASS_NATIVE_FIELD }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button type="button" variant="ghost" onClick={() => { setShowNewMessage(false); setNewMessageEmail(''); setNewMessageName(''); setNewMessageText('') }}>Cancel</Button>
              <Button type="button" variant="primary" disabled={sendingPortal || !newMessageEmail.trim() || !newMessageText.trim()} onClick={sendPortal}>
                {sendingPortal ? 'Sending…' : 'Send Portal Link'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
