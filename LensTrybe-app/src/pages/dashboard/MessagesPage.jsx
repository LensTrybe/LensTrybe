import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function MessagesPage() {
  const { user, profile } = useAuth()
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
      const { error: msgError } = await supabase.from('messages').insert({
        thread_id: thread.id,
        sender_type: 'creative',
        sender_name: profile?.business_name ?? user.email,
        body: newMessageText.trim(),
        creative_id: user.id,
      })
      if (msgError) throw msgError

      // Send email notification
      const { error: fnError } = await supabase.functions.invoke('send-message-notification', {
        body: {
          to: email,
          toName: newMessageName || email,
          fromName: profile?.business_name ?? user.email,
          subject: `New message from ${profile?.business_name ?? 'your creative'} on LensTrybe`,
          messageBody: newMessageText.trim(),
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

  useEffect(() => { loadThreads() }, [user])
  useEffect(() => { if (selected) loadMessages(selected.id) }, [selected])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadThreads() {
    if (!user) return
    const { data } = await supabase
      .from('message_threads')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })

    // For each thread, check if latest message is from client and after last_read_at
    const threadsWithUnread = (data ?? []).map(t => {
      const lastRead = t.last_read_at ? new Date(t.last_read_at) : new Date(0)
      const lastMsg = t.last_message_at ? new Date(t.last_message_at) : null
      return { ...t, isUnread: lastMsg && lastMsg > lastRead }
    })

    setThreads(threadsWithUnread)
    if (threadsWithUnread.length > 0 && !selected) setSelected(threadsWithUnread[0])
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
    setSending(true)
    await supabase.from('messages').insert({
      thread_id: selected.id,
      sender_type: 'creative',
      sender_name: 'creative',
      body: reply.trim(),
      creative_id: user.id,
    })
    // Email notification to client
    if (selected?.client_email) {
      console.log('Sending email to:', selected.client_email)
      const { data, error } = await supabase.functions.invoke('send-message-notification', {
        body: {
          to: selected.client_email,
          toName: selected.client_name ?? selected.client_email,
          fromName: profile?.business_name ?? user.email,
          subject: `Reply from ${profile?.business_name ?? 'your creative'} on LensTrybe`,
          messageBody: reply.trim(),
          threadSubject: selected.subject ?? 'your enquiry',
          profileUrl: 'https://lens-trybe.vercel.app',
        }
      })
      console.log('Email result:', data, error)
    }
    await supabase.from('message_threads').update({ updated_at: new Date().toISOString() }).eq('id', selected.id)
    setReply('')
    await loadMessages(selected.id)
    await loadThreads()
    setSending(false)
  }

  const styles = {
    page: { display: 'flex', height: 'calc(100vh - 64px)', gap: '0', background: 'var(--bg-base)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', overflow: 'hidden' },
    sidebar: { width: '300px', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', flexShrink: 0 },
    sidebarHeader: { padding: '20px', borderBottom: '1px solid var(--border-subtle)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    threadList: { flex: 1, overflowY: 'auto' },
    thread: (active) => ({
      padding: '16px 20px',
      borderBottom: '1px solid var(--border-subtle)',
      cursor: 'pointer',
      background: active ? 'var(--bg-overlay)' : 'transparent',
      borderLeft: active ? '2px solid var(--green)' : '2px solid transparent',
      transition: 'all var(--transition-fast)',
    }),
    threadName: { fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', marginBottom: '4px' },
    threadPreview: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
    mainHeader: { padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' },
    mainName: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    messageList: { flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
    message: (isCreative) => ({
      display: 'flex',
      justifyContent: isCreative ? 'flex-end' : 'flex-start',
      width: '100%',
      padding: '2px 16px',
      boxSizing: 'border-box',
    }),
    bubble: {
      padding: '10px 14px',
      borderRadius: '18px',
      maxWidth: '55%',
      minWidth: 'fit-content',
      display: 'block',
      wordBreak: 'normal',
      whiteSpace: 'nowrap',
      overflowWrap: 'normal',
      lineHeight: 1.5,
      fontSize: '14px',
      fontFamily: 'var(--font-ui)',
    },
    bubbleTime: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px', textAlign: 'right' },
    replyBar: { padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '12px', alignItems: 'flex-end' },
    emptyState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'var(--font-ui)' },
  }

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Loading messages…</div>

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: toast.type === 'success' ? '#1DB954' : '#ef4444', color: toast.type === 'success' ? '#000' : '#fff', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0', marginBottom: '16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text-primary)', fontWeight: 400 }}>Messages</div>
        {profile && (
          <button
            type="button"
            onClick={() => { setNewMessageEmail(''); setNewMessageName(''); setNewMessageText(''); setShowNewMessage(true) }}
            style={{ padding: '9px 18px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
          >
            + New Message
          </button>
        )}
      </div>

      <div style={styles.page}>
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>Conversations ({threads.length})</div>
          <div style={styles.threadList}>
            {threads.length === 0 ? (
              <div style={{ padding: '32px 20px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-ui)', textAlign: 'center' }}>
                No messages yet. When clients enquire, they'll appear here.
              </div>
            ) : threads.map(t => (
              <div key={t.id} style={{ ...styles.thread(selected?.id === t.id), position: 'relative' }}
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
                  <div style={{ ...styles.threadName, color: t.isUnread ? 'var(--text-primary)' : undefined, fontWeight: t.isUnread ? 700 : undefined }}>{t.nickname ?? t.client_name ?? t.client_email ?? 'Client'}</div>
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
                      defaultValue={selected?.nickname ?? selected?.client_name ?? ''}
                      style={{ background: 'var(--bg-base)', border: '1px solid var(--green)', borderRadius: '6px', padding: '4px 8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)' }}
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
                      <span style={styles.mainName}>{selected?.nickname ?? selected?.client_name ?? selected?.client_email ?? 'Client'}</span>
                      <button type="button" onClick={() => setEditingNickname(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>✎</button>
                    </>
                  )}
                </div>
              </div>

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
                        <div style={{ ...styles.bubble, background: isCreative ? 'var(--green)' : 'var(--bg-elevated)', border: isCreative ? 'none' : '1px solid var(--border-default)', color: isCreative ? '#000' : 'var(--text-primary)' }}>{msg.body}</div>
                        <div style={styles.bubbleTime}>
                          {new Date(msg.created_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <div style={styles.replyBar}>
                <div style={{ flex: 1 }}>
                  <Input
                    placeholder="Type your reply…"
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                  />
                </div>
                <Button variant="primary" size="md" disabled={sending || !reply.trim()} onClick={sendReply}>
                  {sending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {showNewMessage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>New Message</div>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
              {"Send a portal link to a client. Enter their email address and they'll receive a link to view their invoices, quotes, contracts and messages with you — no account needed."}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Client Name</label>
                <input
                  value={newMessageName}
                  onChange={e => setNewMessageName(e.target.value)}
                  placeholder="Jane Smith"
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Client Email</label>
                <input
                  type="email"
                  value={newMessageEmail}
                  onChange={e => setNewMessageEmail(e.target.value)}
                  placeholder="jane@example.com"
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Message</label>
                <textarea
                  value={newMessageText}
                  onChange={e => setNewMessageText(e.target.value)}
                  placeholder="Write your message..."
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box', minHeight: '100px', resize: 'vertical' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowNewMessage(false); setNewMessageEmail(''); setNewMessageName(''); setNewMessageText('') }} style={{ padding: '9px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Cancel</button>
              <button type="button" onClick={sendPortal} disabled={sendingPortal || !newMessageEmail.trim() || !newMessageText.trim()} style={{ padding: '9px 18px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)', opacity: sendingPortal || !newMessageEmail.trim() || !newMessageText.trim() ? 0.6 : 1 }}>
                {sendingPortal ? 'Sending…' : 'Send Portal Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
