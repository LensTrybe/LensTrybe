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
  const [quoteActioning, setQuoteActioning] = useState(null)
  const bottomRef = useRef(null)
  const activeThreadRef = useRef(null)

  useEffect(() => { activeThreadRef.current = activeThread }, [activeThread])
  useEffect(() => { fetchPortal() }, [token])
  // Portal visitors aren't signed in, so realtime can't stream messages to them
  // (messages are private). Poll the open conversation instead.
  useEffect(() => {
    if (!activeThread?.id) return undefined
    const iv = setInterval(() => { fetchThreadMessages(activeThread.id, true) }, 10000)
    return () => clearInterval(iv)
  }, [activeThread?.id, token])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [threadMessages])

  // Everything loads through token-checked database functions: the portal token is
  // the only key, and it only ever returns this client's own records.
  const fetchPortal = async () => {
    const { data, error } = await supabase.rpc('portal_load', { p_token: token })
    if (error || !data?.portal) { setNotFound(true); setLoading(false); return }
    setPortal(data.portal)
    setCreativeProfile(data.creative || null)
    setInvoices(data.invoices || [])
    setQuotes(data.quotes || [])
    setContracts(data.contracts || [])
    const thrData = data.threads || []
    setThreads(thrData)
    if (thrData.length > 0) { setActiveThread(thrData[0]); fetchThreadMessages(thrData[0].id) }
    setLoading(false)
  }

  const fetchThreadMessages = async (threadId, isPoll = false) => {
    const { data, error } = await supabase.rpc('portal_thread_messages', { p_token: token, p_thread_id: threadId })
    if (error) return
    if (isPoll && activeThreadRef.current?.id !== threadId) return
    const rows = data || []
    // On a poll, only re-render when something new arrived (avoids jumping the scroll).
    setThreadMessages((prev) => (isPoll && prev.length === rows.length ? prev : rows))
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
    const { data, error } = await supabase.rpc('portal_send_message', {
      p_token: token, p_thread_id: activeThread.id, p_body: newMessage.trim(),
    })
    if (error) {
      setPortalMessageError('Could not send your message. Please try again.')
    } else if (data) {
      setThreadMessages((prev) => (prev.find((m) => m.id === data.id) ? prev : [...prev, data]))
      setNewMessage('')
    }
    setSending(false)
  }

  async function respondToQuote(quoteId, action) {
    setQuoteActioning(quoteId)
    try {
      const { data, error } = await supabase.functions.invoke('respond-quote', { body: { quote_id: quoteId, portal_token: token, action } })
      if (!error && data?.status) {
        setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, status: data.status } : q)))
      }
    } finally {
      setQuoteActioning(null)
    }
  }

  const statusColor = (s) => ({ draft: '#666', sent: '#facc15', paid: '#1DB954', accepted: '#1DB954', signed: '#1DB954', declined: '#f87171', overdue: '#f87171' }[s] || '#666')

  if (loading) return <div style={{ background: '#0f0f0f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontFamily: 'system-ui' }}>Loading your portal...</div>
  if (notFound) return <div style={{ background: '#0f0f0f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontFamily: 'system-ui', flexDirection: 'column', gap: 12 }}><span style={{ fontSize: 48 }}></span><p>Portal not found</p></div>

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
        .portal-brand { font-size: 22px; font-weight: 800; color: #1DB954; margin-bottom: 4px; }
        .portal-welcome { font-size: 15px; color: #888; }
        .portal-client { font-size: 28px; font-weight: 700; color: #fff; margin-top: 8px; }
        .portal-body { max-width: 800px; margin: 0 auto; padding: 28px 20px; }
        .portal-tabs { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
        .portal-tab { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 8px 16px; font-size: 13px; color: #888; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .portal-tab.active { background: #1e2a1e; border-color: #1DB954; color: #1DB954; }
        .tab-count { background: #2a2a2a; border-radius: 10px; padding: 1px 6px; font-size: 10px; font-weight: 700; }
        .portal-tab.active .tab-count { background: #2a4a2a; color: #1DB954; }
        .doc-list { display: flex; flex-direction: column; gap: 10px; }
        .doc-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; gap: 16px; }
        .doc-icon { font-size: 24px; flex-shrink: 0; }
        .doc-info { flex: 1; }
        .doc-title { font-size: 14px; font-weight: 600; color: #fff; }
        .doc-meta { font-size: 12px; color: #666; margin-top: 3px; }
        .doc-status { font-size: 11px; font-weight: 700; border-radius: 4px; padding: 3px 8px; border: 1px solid; text-transform: uppercase; flex-shrink: 0; }
        .doc-action { background: #1DB954; color: #000; border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: none; }
        .quote-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .doc-decline { background: transparent; color: #f87171; border: 1px solid #f8717155; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .doc-action:disabled, .doc-decline:disabled { opacity: 0.5; cursor: default; }
        .empty-tab { text-align: center; padding: 48px 20px; color: #444; font-size: 13px; }
        .empty-tab span { font-size: 36px; display: block; margin-bottom: 10px; }
        .portal-footer { text-align: center; padding: 32px; color: #333; font-size: 12px; border-top: 1px solid #1a1a1a; margin-top: 40px; }
        .portal-footer span { color: #1DB954; font-weight: 700; }
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
          {activeTab === 'invoices' && <div className="doc-list">{invoices.length === 0 ? <div className="empty-tab"><span></span>No invoices yet</div> : invoices.map((inv) => <div key={inv.id} className="doc-card"><span className="doc-icon"></span><div className="doc-info"><div className="doc-title">Invoice #{inv.id.slice(0, 8).toUpperCase()}</div><div className="doc-meta">${inv.amount} · Due {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</div></div><span className="doc-status" style={{ color: statusColor(inv.status), borderColor: statusColor(inv.status) + '44' }}>{inv.status}</span></div>)}</div>}
          {activeTab === 'quotes' && <div className="doc-list">{quotes.length === 0 ? <div className="empty-tab"><span></span>No quotes yet</div> : quotes.map((q) => <div key={q.id} className="doc-card"><span className="doc-icon"></span><div className="doc-info"><div className="doc-title">Quote #{q.id.slice(0, 8).toUpperCase()}</div><div className="doc-meta">${q.amount} · Valid until {q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '—'}</div></div><span className="doc-status" style={{ color: statusColor(q.status), borderColor: statusColor(q.status) + '44' }}>{q.status}</span>{!['accepted', 'declined', 'paid'].includes(String(q.status || '').toLowerCase()) && <span className="quote-actions"><button type="button" className="doc-action" disabled={quoteActioning === q.id} onClick={() => respondToQuote(q.id, 'accept')}>Accept</button><button type="button" className="doc-decline" disabled={quoteActioning === q.id} onClick={() => respondToQuote(q.id, 'decline')}>Decline</button></span>}</div>)}</div>}
          {activeTab === 'contracts' && <div className="doc-list">{contracts.length === 0 ? <div className="empty-tab"><span></span>No contracts yet</div> : contracts.map((c) => <div key={c.id} className="doc-card"><span className="doc-icon"></span><div className="doc-info"><div className="doc-title">{c.title || 'Contract'}</div><div className="doc-meta">{c.signed_at ? `Signed ${new Date(c.signed_at).toLocaleDateString()}` : 'Awaiting signature'}</div></div><span className="doc-status" style={{ color: statusColor(c.status), borderColor: statusColor(c.status) + '44' }}>{c.status}</span>{c.status !== 'signed' && c.signing_token && <a href={`/sign/${c.signing_token}`} className="doc-action">Sign Now</a>}</div>)}</div>}
          {activeTab === 'messages' && (
            <div>
              {threads.length === 0 ? <div className="empty-tab"><span></span>No messages yet</div> : (
                <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
                  {threads.length > 1 && <div style={{ borderBottom: '1px solid #1e1e1e', padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>{threads.map((t) => <button type="button" key={t.id} onClick={() => handleSelectThread(t)} style={{ background: activeThread?.id === t.id ? '#1e2a1e' : '#1a1a1a', border: activeThread?.id === t.id ? '1px solid #1DB954' : '1px solid #2a2a2a', color: activeThread?.id === t.id ? '#1DB954' : '#888', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>{t.subject}</button>)}</div>}
                  {activeThread && <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1e1e', background: '#1a1a1a' }}><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{activeThread.subject}</div><div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Conversation with {creativeProfile?.business_name}</div></div>}
                  <div style={{ padding: '16px 20px', minHeight: 200, maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {threadMessages.length === 0 ? <div style={{ textAlign: 'center', color: '#444', fontSize: 13, padding: '20px 0' }}>No messages yet</div> : threadMessages.map((msg) => (
                      <div key={msg.id} style={{ display: 'flex', gap: 8, maxWidth: '80%', alignSelf: msg.sender_type === 'client' ? 'flex-end' : 'flex-start', flexDirection: msg.sender_type === 'client' ? 'row-reverse' : 'row' }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: msg.sender_type === 'client' ? 'linear-gradient(135deg,#1DB954,#22c55e)' : 'linear-gradient(135deg,#a855f7,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#000' }}>
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
                    <button type="button" onClick={sendMessage} disabled={sending || !newMessage.trim()} style={{ background: '#1DB954', border: 'none', borderRadius: 10, width: 38, height: 38, color: '#000', fontSize: 16, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending || !newMessage.trim() ? 0.4 : 1, flexShrink: 0 }}>↑</button>
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
