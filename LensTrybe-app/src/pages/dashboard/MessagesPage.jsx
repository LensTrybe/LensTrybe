import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

const PAGE = {
  bg: '#0a0a0f',
  panel: '#13131a',
  inputBg: '#1a1a24',
  border: '#1e1e1e',
  border2: '#202027',
  text: 'rgb(242, 242, 242)',
  muted: '#888',
  dim: '#555',
  green: '#39ff14',
  activeRow: '#1e2a1e',
}

const font = { fontFamily: 'Inter, sans-serif' }

const formatTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function threadPreview(thread) {
  return (
    thread.last_message ??
    thread.last_message_body ??
    thread.last_message_preview ??
    thread.preview ??
    thread.subject ??
    ''
  )
}

function AttachmentPreview({ attachment }) {
  const isImage = attachment.type?.startsWith('image/')
  const isPDF = attachment.type === 'application/pdf'
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: PAGE.inputBg,
        border: `1px solid ${PAGE.border2}`,
        borderRadius: 8,
        padding: '5px 10px',
        fontSize: 12,
        color: PAGE.muted,
        textDecoration: 'none',
        ...font,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 10 }}>{isImage ? 'IMG' : isPDF ? 'PDF' : 'FILE'}</span>
      <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {attachment.name}
      </span>
    </a>
  )
}

function LinkedDocBadge({ type }) {
  const icons = { invoice: 'Invoice', quote: 'Quote', contract: 'Contract' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: '#1e1e3a',
        border: '1px solid #3a3a6a',
        borderRadius: 8,
        padding: '5px 10px',
        fontSize: 12,
        color: '#a78bfa',
        marginTop: 4,
        ...font,
      }}
    >
      {icons[type]} attached
    </span>
  )
}

export default function Messages() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [threads, setThreads] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showNewThread, setShowNewThread] = useState(false)
  const [newThreadForm, setNewThreadForm] = useState({ client_name: '', client_email: '', subject: '' })
  const [invoices, setInvoices] = useState([])
  const [quotes, setQuotes] = useState([])
  const [contracts, setContracts] = useState([])
  const [showLinkDoc, setShowLinkDoc] = useState(false)
  const [linkedDoc, setLinkedDoc] = useState(null)
  const [search, setSearch] = useState('')
  const [hoveredThreadId, setHoveredThreadId] = useState(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const threadsSigRef = useRef('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  async function fetchThreads({ silent = false } = {}) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    if (!silent) setLoading(true)
    const { data } = await supabase
      .from('message_threads')
      .select('*')
      .eq('creative_id', userData.user.id)
      .order('last_message_at', { ascending: false })
    const next = data || []
    const sig = next
      .map((t) => `${t.id}|${t.last_message_at || ''}|${t.unread_count || 0}|${threadPreview(t)}`)
      .join('~')
    if (sig !== threadsSigRef.current) {
      threadsSigRef.current = sig
      setThreads(next)
    }
    if (!silent) setLoading(false)
  }

  async function fetchMessages(threadId) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }

  async function fetchDocs() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const [inv, quo, con] = await Promise.all([
      supabase.from('invoices').select('id, client_name, amount, status').eq('creative_id', userData.user.id),
      supabase.from('quotes').select('id, client_name, amount, status').eq('creative_id', userData.user.id),
      supabase.from('contracts').select('id, client_name, title, status').eq('creative_id', userData.user.id),
    ])
    setInvoices(inv.data || [])
    setQuotes(quo.data || [])
    setContracts(con.data || [])
  }

  async function markThreadRead(threadId) {
    await supabase.from('message_threads').update({ unread_count: 0 }).eq('id', threadId)
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread_count: 0 } : t)))
  }

  useEffect(() => {
    if (!user) return
    /* eslint-disable react-hooks/set-state-in-effect -- initial load threads/docs */
    fetchThreads()
    fetchDocs()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user])

  useEffect(() => {
    if (!activeThread) return
    /* eslint-disable react-hooks/set-state-in-effect -- load messages on selection */
    fetchMessages(activeThread.id)
    markThreadRead(activeThread.id)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!activeThread) return
    const interval = setInterval(() => {
      fetchMessages(activeThread.id)
      fetchThreads({ silent: true })
    }, 3000)
    return () => clearInterval(interval)
  }, [activeThread])

  const deleteThread = async (e, thread) => {
    e.stopPropagation()
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return
    await supabase.from('messages').delete().eq('thread_id', thread.id)
    await supabase.from('message_threads').delete().eq('id', thread.id)
    setThreads((prev) => prev.filter((t) => t.id !== thread.id))
    if (activeThread?.id === thread.id) {
      setActiveThread(null)
      setMessages([])
    }
  }

  const createThread = async () => {
    if (!newThreadForm.client_name || !newThreadForm.subject) return
    const { data: userData } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('message_threads')
      .insert({ ...newThreadForm, creative_id: userData.user.id })
      .select()
      .single()
    if (!error && data) {
      setThreads((prev) => [data, ...prev])
      setActiveThread(data)
      setShowNewThread(false)
      setNewThreadForm({ client_name: '', client_email: '', subject: '' })
    }
  }

  const handleFileUpload = async (files) => {
    if (!files.length) return
    setUploading(true)
    const { data: userData } = await supabase.auth.getUser()
    const uploaded = []
    for (const file of files) {
      const path = `${userData.user.id}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('message-attachments').upload(path, file)
      if (!error) {
        const { data: urlData } = supabase.storage.from('message-attachments').getPublicUrl(path)
        uploaded.push({ name: file.name, url: urlData.publicUrl, type: file.type })
      }
    }
    setAttachments((prev) => [...prev, ...uploaded])
    setUploading(false)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() && !attachments.length && !linkedDoc) return
    if (!activeThread) return
    const { data: userData } = await supabase.auth.getUser()
    const msgData = {
      thread_id: activeThread.id,
      creative_id: userData.user.id,
      sender_type: 'creative',
      sender_name: 'You',
      sender_email: userData.user.email,
      body: newMessage,
      attachments: attachments,
      linked_doc_type: linkedDoc?.type || null,
      linked_doc_id: linkedDoc?.id || null,
      subject: activeThread.subject,
      read: true,
    }
    const { data, error } = await supabase.from('messages').insert(msgData).select().single()
    if (!error) {
      setMessages((prev) => [...prev, data])
      await supabase.from('message_threads').update({ last_message_at: new Date().toISOString() }).eq('id', activeThread.id)
      setNewMessage('')
      setAttachments([])
      setLinkedDoc(null)
      if (activeThread.client_email && newMessage.trim()) {
        fetch('https://lqafxisymvrazipaozfk.supabase.co/functions/v1/send-reply-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYWZ4aXN5bXZyYXppcGFvemZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNDM3NTIsImV4cCI6MjA4OTgxOTc1Mn0.FPcNjzMkHSjFEMQvXrpVMvggBDzaKBf4JqbEpDVuoms',
            Authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYWZ4aXN5bXZyYXppcGFvemZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNDM3NTIsImV4cCI6MjA4OTgxOTc1Mn0.FPcNjzMkHSjFEMQvXrpVMvggBDzaKBf4JqbEpDVuoms',
          },
          body: JSON.stringify({ thread_id: activeThread.id, reply_body: newMessage.trim() }),
        }).catch(console.error)
      }
    }
  }

  const filteredThreads = threads.filter(
    (t) =>
      t.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.subject?.toLowerCase().includes(search.toLowerCase()),
  )

  const layoutStyle = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 'calc(100dvh - 5.5rem)',
    margin: '-1.75rem -1.75rem -2.5rem',
    background: PAGE.bg,
    color: PAGE.text,
    ...font,
    boxSizing: 'border-box',
  }

  const rowBaseStyle = (isActive, isHovered) => ({
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: `1px solid ${PAGE.border}`,
    background: isActive ? PAGE.activeRow : isHovered ? PAGE.inputBg : 'transparent',
    borderLeft: isActive ? `3px solid ${PAGE.green}` : '3px solid transparent',
    boxSizing: 'border-box',
    position: 'relative',
  })

  const modalOverlay = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    ...font,
  }

  const modalBox = {
    background: PAGE.inputBg,
    border: `1px solid ${PAGE.border2}`,
    borderRadius: 16,
    padding: 28,
    width: 420,
    maxWidth: '90vw',
    boxSizing: 'border-box',
  }

  return (
    <>
      <div style={layoutStyle}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '16px 20px 12px',
            flexShrink: 0,
            ...font,
          }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
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
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff', ...font }}>Messages</h1>
        </header>

        <div
          style={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <aside
            style={{
              width: 320,
              minWidth: 320,
              flexShrink: 0,
              background: PAGE.panel,
              borderRight: `1px solid ${PAGE.border}`,
              display: 'flex',
              flexDirection: 'column',
              ...font,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 16px 12px',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', ...font }}>Messages</span>
              <button
                type="button"
                onClick={() => setShowNewThread(true)}
                style={{
                  background: PAGE.green,
                  color: '#000',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  ...font,
                }}
              >
                + New
              </button>
            </div>
            <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
              <input
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: PAGE.inputBg,
                  border: `1px solid ${PAGE.border2}`,
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none',
                  ...font,
                }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: PAGE.dim, fontSize: 13, ...font }}>
                  Loading…
                </div>
              ) : filteredThreads.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: PAGE.dim, fontSize: 13, ...font }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }} aria-hidden>
                    💬
                  </div>
                  <p style={{ margin: 0, color: PAGE.muted }}>No conversations yet</p>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: PAGE.dim }}>Click + New to start one</p>
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isActive = activeThread?.id === thread.id
                  const isHovered = hoveredThreadId === thread.id
                  const unread = (thread.unread_count || 0) > 0
                  const initial = thread.client_name?.[0]?.toUpperCase() || '?'
                  const preview = threadPreview(thread)
                  return (
                    <div
                      key={thread.id}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setActiveThread(thread)
                        }
                      }}
                      onClick={() => setActiveThread(thread)}
                      onMouseEnter={() => setHoveredThreadId(thread.id)}
                      onMouseLeave={() => setHoveredThreadId(null)}
                      style={rowBaseStyle(isActive, isHovered)}
                    >
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: PAGE.green,
                            color: '#000',
                            fontWeight: 700,
                            fontSize: 15,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            ...font,
                          }}
                        >
                          {initial}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: unread ? PAGE.green : '#fff',
                                lineHeight: 1.3,
                                ...font,
                              }}
                            >
                              {thread.client_name}
                            </span>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                flexShrink: 0,
                                ...font,
                              }}
                            >
                              {isHovered ? (
                                <button
                                  type="button"
                                  title="Delete conversation"
                                  onClick={(e) => deleteThread(e, thread)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '2px 4px',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    lineHeight: 1,
                                    opacity: 0.85,
                                  }}
                                  aria-label="Delete conversation"
                                >
                                  🗑️
                                </button>
                              ) : null}
                              <span style={{ fontSize: 11, color: PAGE.dim, whiteSpace: 'nowrap', ...font }}>
                                {formatTime(thread.last_message_at)}
                              </span>
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: PAGE.muted,
                              marginTop: 4,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              ...font,
                            }}
                          >
                            {preview}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </aside>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              background: PAGE.bg,
              ...font,
            }}
          >
            {!activeThread ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  padding: 24,
                }}
              >
                <span style={{ fontSize: 48, lineHeight: 1, opacity: 0.35 }} aria-hidden>
                  💬
                </span>
                <p style={{ margin: 0, color: PAGE.dim, fontSize: 14, ...font }}>
                  Select a conversation to view it
                </p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: `1px solid ${PAGE.border}`,
                    background: PAGE.panel,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', ...font }}>
                    {activeThread.client_name}
                  </div>
                  <div style={{ fontSize: 12, color: PAGE.muted, marginTop: 4, ...font }}>
                    {activeThread.client_email || '—'}
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    minHeight: 0,
                    padding: '20px 20px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: PAGE.dim, fontSize: 13, marginTop: 32, ...font }}>
                      No messages yet — send the first one!
                    </div>
                  ) : null}
                  {messages.map((msg) => {
                    const fromCreative = msg.sender_type === 'creative'
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          justifyContent: fromCreative ? 'flex-end' : 'flex-start',
                          width: '100%',
                        }}
                      >
                        <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {msg.body ? (
                            <div
                              style={{
                                background: fromCreative ? PAGE.activeRow : PAGE.panel,
                                border: fromCreative ? `1px solid ${PAGE.green}` : `1px solid ${PAGE.border}`,
                                borderRadius: fromCreative ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                                padding: '10px 14px',
                                fontSize: 14,
                                lineHeight: 1.5,
                                wordBreak: 'break-word',
                                color: PAGE.text,
                                ...font,
                              }}
                            >
                              {msg.body}
                            </div>
                          ) : null}
                          {msg.attachments?.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {msg.attachments.map((a, i) => (
                                <AttachmentPreview key={i} attachment={a} />
                              ))}
                            </div>
                          ) : null}
                          {msg.linked_doc_type ? <LinkedDocBadge type={msg.linked_doc_type} /> : null}
                          <div
                            style={{
                              fontSize: 11,
                              color: PAGE.dim,
                              paddingLeft: 4,
                              paddingRight: 4,
                              textAlign: fromCreative ? 'right' : 'left',
                              ...font,
                            }}
                          >
                            {formatTime(msg.created_at)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>

                <div
                  style={{
                    borderTop: `1px solid ${PAGE.border}`,
                    background: PAGE.bg,
                    padding: '12px 20px 20px',
                    flexShrink: 0,
                  }}
                >
                  {attachments.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {attachments.map((a, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: PAGE.panel,
                            border: `1px solid ${PAGE.border2}`,
                            borderRadius: 8,
                            padding: '4px 10px',
                            fontSize: 12,
                            color: PAGE.muted,
                            ...font,
                          }}
                        >
                          <span>{a.type?.startsWith('image/') ? 'IMG' : 'PDF'}</span>
                          <span>{a.name}</span>
                          <button
                            type="button"
                            onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: PAGE.dim,
                              cursor: 'pointer',
                              fontSize: 14,
                              padding: 0,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {linkedDoc ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#1e1e3a',
                        border: '1px solid #3a3a6a',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: 12,
                        color: '#a78bfa',
                        marginBottom: 10,
                        ...font,
                      }}
                    >
                      <span>
                        Attaching {linkedDoc.type}: {linkedDoc.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLinkedDoc(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: PAGE.dim,
                          cursor: 'pointer',
                          fontSize: 14,
                          marginLeft: 'auto',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <textarea
                      placeholder="Type a message…"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                      rows={2}
                      style={{
                        flex: 1,
                        minWidth: 200,
                        background: PAGE.panel,
                        border: `1px solid ${PAGE.border}`,
                        borderRadius: 8,
                        padding: 10,
                        color: '#fff',
                        fontSize: 14,
                        resize: 'none',
                        outline: 'none',
                        minHeight: 44,
                        maxHeight: 120,
                        lineHeight: 1.5,
                        boxSizing: 'border-box',
                        ...font,
                      }}
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileUpload(Array.from(e.target.files || []))}
                    />
                    <button
                      type="button"
                      title="Attach file"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        width: 40,
                        height: 40,
                        background: PAGE.inputBg,
                        border: `1px solid ${PAGE.border2}`,
                        borderRadius: 8,
                        color: PAGE.muted,
                        cursor: 'pointer',
                        fontSize: 12,
                        flexShrink: 0,
                        ...font,
                      }}
                    >
                      {uploading ? '…' : '📎'}
                    </button>
                    <button
                      type="button"
                      title="Link document"
                      onClick={() => setShowLinkDoc(true)}
                      style={{
                        width: 40,
                        height: 40,
                        background: PAGE.inputBg,
                        border: `1px solid ${PAGE.border2}`,
                        borderRadius: 8,
                        color: PAGE.muted,
                        cursor: 'pointer',
                        fontSize: 12,
                        flexShrink: 0,
                        ...font,
                      }}
                    >
                      Doc
                    </button>
                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={!newMessage.trim() && !attachments.length && !linkedDoc}
                      style={{
                        background: PAGE.green,
                        color: '#000',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 18px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor:
                          !newMessage.trim() && !attachments.length && !linkedDoc ? 'not-allowed' : 'pointer',
                        opacity: !newMessage.trim() && !attachments.length && !linkedDoc ? 0.45 : 1,
                        flexShrink: 0,
                        ...font,
                      }}
                    >
                      Send Reply
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showNewThread ? (
        <div style={modalOverlay} onClick={() => setShowNewThread(false)} role="presentation">
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 20px', ...font }}>
              New Conversation
            </h3>
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  color: PAGE.muted,
                  marginBottom: 6,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  ...font,
                }}
              >
                Client Name
              </label>
              <input
                placeholder="Jane Smith"
                value={newThreadForm.client_name}
                onChange={(e) => setNewThreadForm((p) => ({ ...p, client_name: e.target.value }))}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: PAGE.bg,
                  border: `1px solid ${PAGE.border2}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: PAGE.text,
                  fontSize: 14,
                  outline: 'none',
                  ...font,
                }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  color: PAGE.muted,
                  marginBottom: 6,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  ...font,
                }}
              >
                Client Email
              </label>
              <input
                placeholder="jane@example.com"
                value={newThreadForm.client_email}
                onChange={(e) => setNewThreadForm((p) => ({ ...p, client_email: e.target.value }))}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: PAGE.bg,
                  border: `1px solid ${PAGE.border2}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: PAGE.text,
                  fontSize: 14,
                  outline: 'none',
                  ...font,
                }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  color: PAGE.muted,
                  marginBottom: 6,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  ...font,
                }}
              >
                Subject
              </label>
              <input
                placeholder="Wedding shoot"
                value={newThreadForm.subject}
                onChange={(e) => setNewThreadForm((p) => ({ ...p, subject: e.target.value }))}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: PAGE.bg,
                  border: `1px solid ${PAGE.border2}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: PAGE.text,
                  fontSize: 14,
                  outline: 'none',
                  ...font,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowNewThread(false)}
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
                onClick={createThread}
                style={{
                  background: PAGE.green,
                  border: 'none',
                  color: '#000',
                  borderRadius: 8,
                  padding: '9px 20px',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  ...font,
                }}
              >
                Start Conversation
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showLinkDoc ? (
        <div style={modalOverlay} onClick={() => setShowLinkDoc(false)} role="presentation">
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 16px', ...font }}>
              Link a Document
            </h3>
            <LinkDocPicker
              invoices={invoices}
              quotes={quotes}
              contracts={contracts}
              onSelect={(doc) => {
                setLinkedDoc(doc)
                setShowLinkDoc(false)
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowLinkDoc(false)}
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
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function LinkDocPicker({ invoices, quotes, contracts, onSelect }) {
  const [tab, setTab] = useState('invoice')
  const docs = { invoice: invoices, quote: quotes, contract: contracts }
  const current = docs[tab] || []
  return (
    <div style={{ ...font }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['invoice', 'quote', 'contract'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              background: tab === t ? '#1e1e3a' : PAGE.bg,
              border: tab === t ? '1px solid #a78bfa' : `1px solid ${PAGE.border2}`,
              borderRadius: 8,
              padding: 8,
              fontSize: 12,
              color: tab === t ? '#a78bfa' : PAGE.muted,
              cursor: 'pointer',
              fontWeight: tab === t ? 600 : 500,
              textAlign: 'center',
              ...font,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}s
          </button>
        ))}
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 4 }}>
        {current.length === 0 ? (
          <div style={{ color: PAGE.dim, fontSize: 13, textAlign: 'center', padding: '20px 0', ...font }}>
            No {tab}s found
          </div>
        ) : (
          current.map((doc) => (
            <div
              key={doc.id}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect({
                    type: tab,
                    id: doc.id,
                    label:
                      doc.client_name +
                      (doc.amount ? ` - $${doc.amount}` : doc.title ? ` - ${doc.title}` : ''),
                  })
                }
              }}
              onClick={() =>
                onSelect({
                  type: tab,
                  id: doc.id,
                  label:
                    doc.client_name + (doc.amount ? ` - $${doc.amount}` : doc.title ? ` - ${doc.title}` : ''),
                })
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                border: `1px solid ${PAGE.border2}`,
                borderRadius: 8,
                marginBottom: 6,
                cursor: 'pointer',
                ...font,
              }}
            >
              <div>
                <div style={{ fontSize: 14, color: PAGE.text, ...font }}>
                  {doc.client_name}
                  {doc.title ? ` - ${doc.title}` : ''}
                </div>
                <div style={{ fontSize: 11, color: PAGE.dim, marginTop: 2, ...font }}>
                  {doc.amount ? `$${doc.amount}` : ''}
                  {doc.amount ? ' · ' : ''}
                  {doc.status}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
