import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import {
  MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE,
  messageBodyContainsContactDetails,
  threadOwnerTierContactSharingRestricted,
} from '../../lib/messagingContactPolicy'

/** Token-based client portal — no auth required; loads by `portal_token` only. */
export default function PublicPortalPage() {
  const { token } = useParams()
  const [portal, setPortal] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [quotes, setQuotes] = useState([])
  const [contracts, setContracts] = useState([])
  const [threads, setThreads] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [threadMessages, setThreadMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [portalMessageError, setPortalMessageError] = useState('')
  const [sending, setSending] = useState(false)
  const [creativeProfile, setCreativeProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('messages')
  const [notFound, setNotFound] = useState(false)
  const bottomRef = useRef(null)
  const activeThreadRef = useRef(null)

  useEffect(() => { activeThreadRef.current = activeThread }, [activeThread])
  useEffect(() => { fetchPortal() }, [token])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [threadMessages])

  const fetchPortal = async () => {
    const { data: portalData, error } = await supabase
      .from('client_portals').select('*').eq('portal_token', token).single()
    if (error || !portalData) { setNotFound(true); setLoading(false); return }
    setPortal(portalData)
    const creativeId = portalData.creative_id
    const clientEmail = portalData.client_email
    const [prof, inv, quo, con, thr] = await Promise.all([
      supabase.from('profiles').select('business_name, avatar_url, location, subscription_tier').eq('id', creativeId).eq('is_admin', false).single(),
      supabase.from('invoices').select('*').eq('creative_id', creativeId).eq('client_email', clientEmail),
      supabase.from('quotes').select('*').eq('creative_id', creativeId).eq('client_email', clientEmail),
      supabase.from('contracts').select('*').eq('creative_id', creativeId).eq('client_email', clientEmail),
      supabase.from('message_threads').select('*').eq('creative_id', creativeId).eq('client_email', clientEmail).order('last_message_at', { ascending: false }),
    ])
    setCreativeProfile(prof.data)
    setInvoices(inv.data || [])
    setQuotes(quo.data || [])
    setContracts(con.data || [])
    const thrData = thr.data || []
    setThreads(thrData)
    if (thrData.length > 0) { setActiveThread(thrData[0]); fetchThreadMessages(thrData[0].id) }
    setLoading(false)
    const sub = supabase.channel('portal-messages-' + token)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new
        if (activeThreadRef.current && newMsg.thread_id === activeThreadRef.current.id) {
          setThreadMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      }).subscribe()
    return () => { supabase.removeChannel(sub) }
  }

  const fetchThreadMessages = async (threadId) => {
    const { data } = await supabase.from('messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true })
    setThreadMessages(data || [])
  }

  const handleSelectThread = (thread) => {
    setPortalMessageError('')
    setActiveThread(thread)
    fetchThreadMessages(thread.id)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeThread || !portal) return
    setPortalMessageError('')
    if (
      threadOwnerTierContactSharingRestricted(creativeProfile?.subscription_tier) &&
      messageBodyContainsContactDetails(newMessage.trim())
    ) {
      setPortalMessageError(MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE)
      return
    }
    setSending(true)
    const { data, error } = await supabase.from('messages').insert({
      creative_id: portal.creative_id, thread_id: activeThread.id,
      sender_type: 'client', sender_name: portal.client_name,
      sender_email: portal.client_email, subject: activeThread.subject,
      body: newMessage.trim(), read: false,
    }).select().single()
    if (!error && data) {
      setThreadMessages((prev) => [...prev, data])
      await supabase.from('message_threads').update({ last_message_at: new Date().toISOString(), unread_count: 1 }).eq('id', activeThread.id)
      setNewMessage('')
    }
    setSending(false)
  }

  const statusColor = (s) => ({ draft: '#666', sent: '#facc15', paid: '#39ff14', accepted: '#39ff14', signed: '#39ff14', declined: '#f87171', overdue: '#f87171' }[s] || '#666')

  if (loading) return <div style={{ background: '#0f0f0f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontFamily: 'system-ui' }}>Loading your portal...</div>
  if (notFound) return <div style={{ background: '#0f0f0f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontFamily: 'system-ui', flexDirection: 'column', gap: 12 }}><span style={{ fontSize: 48 }}>🔍</span><p>Portal not found</p></div>

  const tabs = [
    { id: 'invoices', label: 'Invoices', count: invoices.length },
    { id: 'quotes', label: 'Quotes', count: quotes.length },
    { id: 'contracts', label: 'Contracts', count: contracts.length },
    { id: 'messages', label: 'Messages', count: threads.length },
  ]

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0f0f; }
        .portal-page { min-height: 100vh; background: #0f0f0f; color: #e8e8e8; font-family: 'DM Sans', system-ui, sans-serif; }
        .portal-hero { background: #141414; border-bottom: 1px solid #1e1e1e; padding: 32px; text-align: center; }
        .portal-brand { font-size: 22px; font-weight: 800; color: #39ff14; margin-bottom: 4px; }
        .portal-welcome { font-size: 15px; color: #888; }
        .portal-client { font-size: 28px; font-weight: 700; color: #fff; margin-top: 8px; }
        .portal-body { max-width: 800px; margin: 0 auto; padding: 28px 20px; }
        .portal-tabs { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
        .portal-tab { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 8px 16px; font-size: 13px; color: #888; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .portal-tab.active { background: #1e2a1e; border-color: #39ff14; color: #39ff14; }
        .tab-count { background: #2a2a2a; border-radius: 10px; padding: 1px 6px; font-size: 10px; font-weight: 700; }
        .portal-tab.active .tab-count { background: #2a4a2a; color: #39ff14; }
        .doc-list { display: flex; flex-direction: column; gap: 10px; }
        .doc-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; gap: 16px; }
        .doc-icon { font-size: 24px; flex-shrink: 0; }
        .doc-info { flex: 1; }
        .doc-title { font-size: 14px; font-weight: 600; color: #fff; }
        .doc-meta { font-size: 12px; color: #666; margin-top: 3px; }
        .doc-status { font-size: 11px; font-weight: 700; border-radius: 4px; padding: 3px 8px; border: 1px solid; text-transform: uppercase; flex-shrink: 0; }
        .doc-action { background: #39ff14; color: #000; border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: none; }
        .empty-tab { text-align: center; padding: 48px 20px; color: #444; font-size: 13px; }
        .empty-tab span { font-size: 36px; display: block; margin-bottom: 10px; }
        .portal-footer { text-align: center; padding: 32px; color: #333; font-size: 12px; border-top: 1px solid #1a1a1a; margin-top: 40px; }
        .portal-footer span { color: #39ff14; font-weight: 700; }
      `}</style>
      <div className="portal-page">
        <div className="portal-hero">
          <div className="portal-brand">{creativeProfile?.business_name || 'Your Creative'}</div>
          <div className="portal-welcome">Welcome to your client portal</div>
          <div className="portal-client">{portal.client_name}</div>
        </div>
        <div className="portal-body">
          <div className="portal-tabs">
            {tabs.map((t) => (
              <button key={t.id} type="button" className={`portal-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
                {t.label} <span className="tab-count">{t.count}</span>
              </button>
            ))}
          </div>
          {activeTab === 'invoices' && <div className="doc-list">{invoices.length === 0 ? <div className="empty-tab"><span>💰</span>No invoices yet</div> : invoices.map((inv) => <div key={inv.id} className="doc-card"><span className="doc-icon">💰</span><div className="doc-info"><div className="doc-title">Invoice #{inv.id.slice(0, 8).toUpperCase()}</div><div className="doc-meta">${inv.amount} · Due {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</div></div><span className="doc-status" style={{ color: statusColor(inv.status), borderColor: statusColor(inv.status) + '44' }}>{inv.status}</span></div>)}</div>}
          {activeTab === 'quotes' && <div className="doc-list">{quotes.length === 0 ? <div className="empty-tab"><span>📋</span>No quotes yet</div> : quotes.map((q) => <div key={q.id} className="doc-card"><span className="doc-icon">📋</span><div className="doc-info"><div className="doc-title">Quote #{q.id.slice(0, 8).toUpperCase()}</div><div className="doc-meta">${q.amount} · Valid until {q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '—'}</div></div><span className="doc-status" style={{ color: statusColor(q.status), borderColor: statusColor(q.status) + '44' }}>{q.status}</span></div>)}</div>}
          {activeTab === 'contracts' && <div className="doc-list">{contracts.length === 0 ? <div className="empty-tab"><span>📝</span>No contracts yet</div> : contracts.map((c) => <div key={c.id} className="doc-card"><span className="doc-icon">📝</span><div className="doc-info"><div className="doc-title">{c.title || 'Contract'}</div><div className="doc-meta">{c.signed_at ? `Signed ${new Date(c.signed_at).toLocaleDateString()}` : 'Awaiting signature'}</div></div><span className="doc-status" style={{ color: statusColor(c.status), borderColor: statusColor(c.status) + '44' }}>{c.status}</span>{c.status !== 'signed' && c.signing_token && <a href={`/sign/${c.signing_token}`} className="doc-action">Sign Now</a>}</div>)}</div>}
          {activeTab === 'messages' && (
            <div>
              {threads.length === 0 ? <div className="empty-tab"><span>💬</span>No messages yet</div> : (
                <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
                  {threads.length > 1 && <div style={{ borderBottom: '1px solid #1e1e1e', padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>{threads.map((t) => <button type="button" key={t.id} onClick={() => handleSelectThread(t)} style={{ background: activeThread?.id === t.id ? '#1e2a1e' : '#1a1a1a', border: activeThread?.id === t.id ? '1px solid #39ff14' : '1px solid #2a2a2a', color: activeThread?.id === t.id ? '#39ff14' : '#888', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>{t.subject}</button>)}</div>}
                  {activeThread && <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1e1e', background: '#1a1a1a' }}><div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{activeThread.subject}</div><div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Conversation with {creativeProfile?.business_name}</div></div>}
                  <div style={{ padding: '16px 20px', minHeight: 200, maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {threadMessages.length === 0 ? <div style={{ textAlign: 'center', color: '#444', fontSize: 13, padding: '20px 0' }}>No messages yet</div> : threadMessages.map((msg) => (
                      <div key={msg.id} style={{ display: 'flex', gap: 8, maxWidth: '80%', alignSelf: msg.sender_type === 'client' ? 'flex-end' : 'flex-start', flexDirection: msg.sender_type === 'client' ? 'row-reverse' : 'row' }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: msg.sender_type === 'client' ? 'linear-gradient(135deg,#39ff14,#22c55e)' : 'linear-gradient(135deg,#a855f7,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#000' }}>
                          {msg.sender_type === 'client' ? portal?.client_name?.[0]?.toUpperCase() : creativeProfile?.business_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ padding: '9px 13px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, background: msg.sender_type === 'client' ? '#1a3a1a' : '#1e1e1e', border: msg.sender_type === 'client' ? '1px solid #2a4a2a' : '1px solid #2a2a2a', color: msg.sender_type === 'client' ? '#d4f5d4' : '#e8e8e8' }}>{msg.body}</div>
                          <div style={{ fontSize: 10, color: '#444', marginTop: 3, textAlign: msg.sender_type === 'client' ? 'right' : 'left' }}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                  {portalMessageError ? (
                    <div style={{ padding: '0 16px 8px', fontSize: 12, color: '#f87171', lineHeight: 1.4 }}>{portalMessageError}</div>
                  ) : null}
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #1e1e1e', display: 'flex', gap: 8 }}>
                    <textarea value={newMessage} onChange={(e) => { setPortalMessageError(''); setNewMessage(e.target.value) }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }} placeholder="Type a reply... (Enter to send)" rows={1} style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '9px 13px', color: '#e8e8e8', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
                    <button type="button" onClick={sendMessage} disabled={sending || !newMessage.trim()} style={{ background: '#39ff14', border: 'none', borderRadius: 10, width: 38, height: 38, color: '#000', fontSize: 16, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending || !newMessage.trim() ? 0.4 : 1, flexShrink: 0 }}>↑</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="portal-footer">Powered by <span>LensTrybe</span></div>
      </div>
    </>
  )
}
