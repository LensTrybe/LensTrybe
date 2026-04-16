import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function ClientDashboardPage() {
  const { user, clientAccount } = useAuth()
  const navigate = useNavigate()
  const [threads, setThreads] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [jobs, setJobs] = useState([])
  const [creatives, setCreatives] = useState([])
  const [view, setView] = useState('messages')
  const [editingNickname, setEditingNickname] = useState(false)

  useEffect(() => {
    if (window.location.pathname.startsWith('/portal/')) return
    if (window.location.pathname.startsWith('/deliver/')) return
  }, [])

  useEffect(() => { if (user) { loadThreads(); loadJobs() } }, [user, clientAccount])
  useEffect(() => { if (selected) loadMessages(selected.id) }, [selected])

  function getCreativeName(thread) {
    const creative = creatives.find(c => c.id === thread.creative_id)
    return creative?.business_name ?? thread.subject ?? 'Creative'
  }

  async function loadThreads() {
    if (!user) return
    const matchEmail = (clientAccount?.email ?? user.email ?? '').trim()
    console.log('Loading threads for user:', user.id, user.email)
    if (matchEmail) console.log('message_threads client_email match:', matchEmail)

    // First try by client_user_id
    const { data: byId } = await supabase
      .from('message_threads')
      .select('*')
      .eq('client_user_id', user.id)
      .order('created_at', { ascending: false })

    // Also get any threads matching email with null client_user_id (use account email when set — may differ from auth email)
    let byEmail = []
    if (matchEmail) {
      const { data: byEmailRows } = await supabase
        .from('message_threads')
        .select('*')
        .eq('client_email', matchEmail)
        .is('client_user_id', null)
        .order('created_at', { ascending: false })
      byEmail = byEmailRows ?? []
    }

    // Update any email-matched threads to link this user
    if (byEmail.length > 0 && matchEmail) {
      await supabase
        .from('message_threads')
        .update({ client_user_id: user.id })
        .eq('client_email', matchEmail)
        .is('client_user_id', null)
    }

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
    const { data } = await supabase
      .from('job_listings')
      .select('*')
      .eq('posted_by', user.id)
      .order('created_at', { ascending: false })
    setJobs(data ?? [])
  }

  async function sendReply() {
    if (!reply.trim() || !selected) return
    setSending(true)
    await supabase.from('messages').insert({
      thread_id: selected.id,
      sender_type: 'client',
      sender_name: clientAccount?.first_name ?? user.email,
      body: reply.trim(),
    })
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_name, business_email')
      .eq('id', selected.creative_id)
      .maybeSingle()
    if (profile?.business_email) {
      await supabase.functions.invoke('send-message-notification', {
        body: {
          to: profile.business_email,
          toName: profile.business_name,
          fromName: clientAccount?.first_name ?? user.email,
          subject: `Reply from ${clientAccount?.first_name ?? user.email} on LensTrybe`,
          messageBody: reply.trim(),
          threadSubject: selected.subject ?? 'your enquiry',
        }
      })
    }
    setReply('')
    await loadMessages(selected.id)
    setSending(false)
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

  const tierColor = { pro: '#ec4899', expert: '#a855f7', elite: '#f59e0b', basic: '#6b7280' }

  const s = {
    page: { minHeight: '100vh', background: '#080810', color: '#fff', fontFamily: 'var(--font-ui)' },
    nav: { height: '64px', background: 'rgba(8,8,16,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', position: 'sticky', top: 0, zIndex: 100 },
    logo: { fontSize: '18px', fontFamily: 'var(--font-display)', color: '#fff', cursor: 'pointer' },
    navRight: { display: 'flex', alignItems: 'center', gap: '16px' },
    userName: { fontSize: '13px', color: 'var(--text-secondary)' },
    signOutBtn: { fontSize: '13px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px' },
    body: { display: 'flex', height: 'calc(100vh - 64px)' },
    sidebar: { width: '260px', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
    sidebarHeader: { padding: '20px 20px 8px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' },
    navItem: (active) => ({ padding: '10px 20px', fontSize: '14px', cursor: 'pointer', color: active ? '#1DB954' : 'var(--text-secondary)', background: active ? 'rgba(29,185,84,0.08)' : 'transparent', borderLeft: active ? '2px solid #1DB954' : '2px solid transparent', transition: 'all 0.15s' }),
    threadList: { flex: 1, overflowY: 'auto' },
    thread: (active) => ({ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', background: active ? 'rgba(29,185,84,0.06)' : 'transparent', position: 'relative', transition: 'background 0.15s' }),
    threadName: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' },
    threadPreview: { fontSize: '12px', color: 'var(--text-muted)' },
    delBtn: { position: 'absolute', top: '8px', right: '8px', opacity: 0, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: '2px 6px', transition: 'opacity 0.2s' },
    main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    chatHeader: { padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '8px' },
    messageList: { flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' },
    messageRow: (isClient) => ({ display: 'flex', justifyContent: isClient ? 'flex-end' : 'flex-start', width: '100%' }),
    bubble: (isClient) => ({ padding: '10px 14px', borderRadius: '18px', maxWidth: '55%', background: isClient ? '#1DB954' : 'var(--bg-elevated)', color: isClient ? '#000' : 'var(--text-primary)', border: isClient ? 'none' : '1px solid rgba(255,255,255,0.08)', fontSize: '14px', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }),
    replyBar: { padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '12px' },
    replyInput: { flex: 1, background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '10px 16px', color: '#fff', fontSize: '14px', fontFamily: 'var(--font-ui)', outline: 'none' },
    sendBtn: { background: '#1DB954', color: '#000', border: 'none', borderRadius: '24px', padding: '10px 20px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' },
    empty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' },
    content: { flex: 1, overflowY: 'auto', padding: '24px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', maxWidth: '1200px' },
    creativeCard: { background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'border-color 0.15s', maxWidth: '240px', width: '100%' },
    avatar: { width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(29,185,84,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: '#1DB954', marginBottom: '10px', overflow: 'hidden' },
    creativeName: { fontSize: '14px', fontWeight: 600, marginBottom: '4px' },
    creativeType: { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' },
    messageBtn: { width: '100%', padding: '8px', background: 'rgba(29,185,84,0.1)', border: '1px solid rgba(29,185,84,0.3)', borderRadius: '8px', color: '#1DB954', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
    jobCard: { background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', marginBottom: '12px' },
    jobTitle: { fontSize: '15px', fontWeight: 600, marginBottom: '6px' },
    jobMeta: { fontSize: '12px', color: 'var(--text-muted)' },
    postBtn: { padding: '10px 20px', background: '#1DB954', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', marginBottom: '20px' },
    editInput: { background: 'var(--bg-base)', border: '1px solid #1DB954', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '14px', fontFamily: 'var(--font-ui)' },
    editIcon: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '2px' },
  }

  function goToCreativeThread(creativeId) {
    const thread = threads.find(t => t.creative_id === creativeId)
    if (thread) { setSelected(thread); setView('messages') }
  }

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={s.logo} onClick={() => navigate('/')}>LensTrybe</div>
        <div style={s.navRight}>
          <span style={s.userName}>{displayName}</span>
          <button style={s.signOutBtn} onClick={signOut}>Sign Out</button>
        </div>
      </nav>

      <div style={s.body}>
        <div style={s.sidebar}>
          <div style={s.sidebarHeader}>Menu</div>
          <div style={s.navItem(view === 'messages')} onClick={() => setView('messages')}>Messages {threads.length > 0 && `(${threads.length})`}</div>
          <div style={s.navItem(view === 'creatives')} onClick={() => setView('creatives')}>My Creatives {creatives.length > 0 && `(${creatives.length})`}</div>
          <div style={s.navItem(view === 'jobs')} onClick={() => setView('jobs')}>My Jobs {jobs.length > 0 && `(${jobs.length})`}</div>
          <div style={s.navItem(false)} onClick={() => navigate('/creatives')}>Find a Creative</div>
          <div style={s.navItem(false)} onClick={() => navigate('/jobs')}>Job Board</div>

          {view === 'messages' && threads.length > 0 && (
            <>
              <div style={s.sidebarHeader}>Conversations</div>
              <div style={s.threadList}>
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
                      <button style={s.editIcon} onClick={() => setEditingNickname(true)}>✎</button>
                    </>
                  )}
                </div>
                <div style={s.messageList}>
                  {messages.length === 0
                    ? <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>No messages yet.</div>
                    : messages.map(m => (
                      <div key={m.id} style={s.messageRow(m.sender_type === 'client')}>
                        <div style={s.bubble(m.sender_type === 'client')}>{m.body}</div>
                      </div>
                    ))
                  }
                </div>
                <div style={s.replyBar}>
                  <input
                    style={s.replyInput}
                    placeholder="Type your reply..."
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
                  />
                  <button style={s.sendBtn} onClick={sendReply} disabled={sending}>{sending ? '...' : 'Send'}</button>
                </div>
              </>
            ) : (
              <div style={s.empty}>No conversations yet. <span style={{ color: '#1DB954', cursor: 'pointer', marginLeft: '6px' }} onClick={() => navigate('/creatives')}>Find a Creative →</span></div>
            )
          )}

          {view === 'creatives' && (
            <div style={s.content}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>My Creatives</h2>
              {creatives.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  You haven't contacted any creatives yet. <span style={{ color: '#1DB954', cursor: 'pointer' }} onClick={() => navigate('/creatives')}>Find one now →</span>
                </div>
              ) : (
                <div style={s.grid}>
                  {creatives.map(c => (
                    <div key={c.id} style={s.creativeCard}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#1DB954'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                    >
                      <div style={s.avatar}>
                        {c.avatar_url
                          ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (c.business_name?.[0] ?? '?').toUpperCase()
                        }
                      </div>
                      <div style={s.creativeName}>{c.business_name}</div>
                      <div style={s.creativeType}>
                        {(c.skill_types ?? []).map(t => t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ')}
                      </div>
                      {c.city && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>📍 {c.city}{c.state ? `, ${c.state}` : ''}</div>}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button style={s.messageBtn} onClick={() => goToCreativeThread(c.id)}>Message</button>
                        <button style={{ ...s.messageBtn, background: 'transparent', color: 'var(--text-secondary)' }} onClick={() => navigate(`/creatives/${c.id}`)}>View Profile</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'jobs' && (
            <div style={s.content}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>My Jobs</h2>
              <button style={s.postBtn} onClick={() => navigate('/jobs')}>+ Post a Job</button>
              {jobs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>You haven't posted any jobs yet.</div>
              ) : jobs.map(j => (
                <div key={j.id} style={s.jobCard}>
                  <div style={s.jobTitle}>{j.title}</div>
                  <div style={s.jobMeta}>{j.location} · {j.budget_range} · {new Date(j.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
