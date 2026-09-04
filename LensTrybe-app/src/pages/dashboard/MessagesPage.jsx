import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatClientAccountDisplayName } from '../../lib/clientDisplayName'
import { creativeSenderDisplayName } from '../../lib/creativeDisplayName'
import {
  MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE,
  messageBodyContainsContactDetails,
  threadOwnerTierContactSharingRestricted,
} from '../../lib/messagingContactPolicy'
import {
  MONTHLY_MESSAGE_LIMIT_EXCEEDED_MESSAGE,
  creativeMonthlyReplyLimit,
  fetchMyCreativeMessageReplyUsage,
  isAtOrOverCreativeReplyLimit,
  isMonthlyMessageLimitError,
} from '../../lib/messageMonthlyLimit'
import { moderateText, MODERATION_BLOCKED_USER_MESSAGE } from '../../lib/moderateContent'
import { useAuth } from '../../context/AuthContext'

const CSS = `
.ltmsg{position:relative;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--lt-text)}
.ltmsg .head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.ltmsg .title{font-family:var(--font-display),'Playfair Display',serif;font-size:24px;font-weight:700;letter-spacing:-0.02em;color:var(--lt-text)}
.ltmsg .sub{color:var(--lt-muted);font-size:13px;margin-top:3px}
.ltmsg .btn{font-family:inherit;font-size:13px;font-weight:600;border-radius:10px;padding:9px 15px;cursor:pointer;border:1px solid var(--lt-border);background:var(--lt-surface);color:var(--lt-text);display:inline-flex;align-items:center;gap:7px;transition:.15s;white-space:nowrap;min-height:40px}
.ltmsg .btn:hover{background:var(--lt-surface-2)}
.ltmsg .btn:disabled{opacity:.5;cursor:not-allowed}
.ltmsg .btn.primary{background:#1DB954;border-color:transparent;color:#04120a;font-weight:700;box-shadow:0 6px 18px -8px rgba(29,185,84,0.7)}
.ltmsg .btn.primary:hover{background:#22c95f}
.ltmsg .btn.ghost{background:transparent;border-color:transparent;color:var(--lt-muted)}
.ltmsg .btn.ghost:hover{color:var(--lt-text);background:var(--lt-surface)}
.ltmsg .usage{margin-bottom:12px;padding:10px 14px;border-radius:10px;font-size:13px;background:var(--lt-surface);border:1px solid var(--lt-border);color:var(--lt-muted)}
.ltmsg .usage.blocked{background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.35);color:#f2777a}
.ltmsg .shell{display:flex;border-radius:18px;overflow:hidden;background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur);height:calc(100vh - 172px);min-height:520px}
.ltmsg .side{width:312px;flex-shrink:0;border-right:1px solid var(--lt-hairline);display:flex;flex-direction:column;min-height:0}
.ltmsg .sidehead{padding:15px 18px;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--lt-muted);border-bottom:1px solid var(--lt-hairline)}
.ltmsg .threads{flex:1;overflow-y:auto;min-height:0}
.ltmsg .thread{position:relative;display:flex;gap:11px;align-items:center;padding:13px 16px;cursor:pointer;border-left:2px solid transparent;border-bottom:1px solid var(--lt-hairline);transition:.14s}
.ltmsg .thread:hover{background:var(--lt-surface)}
.ltmsg .thread.on{background:var(--lt-surface-2);border-left-color:#1DB954}
.ltmsg .avatar{width:38px;height:38px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:var(--lt-surface-2);color:var(--lt-muted);overflow:hidden}
.ltmsg .thread.on .avatar{background:rgba(29,185,84,0.16);color:#1DB954}
.ltmsg .tmeta{min-width:0;flex:1}
.ltmsg .tname{font-size:14px;font-weight:600;color:var(--lt-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ltmsg .tname.unread{font-weight:800}
.ltmsg .tprev{font-size:12px;color:var(--lt-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.ltmsg .dot{width:8px;height:8px;border-radius:50%;background:#1DB954;flex-shrink:0}
.ltmsg .del{position:absolute;top:9px;right:9px;opacity:0;background:none;border:none;color:var(--lt-faint);cursor:pointer;font-size:13px;transition:.15s;padding:2px 6px;border-radius:6px}
.ltmsg .thread:hover .del{opacity:1}
.ltmsg .del:hover{color:#ef4444;background:var(--lt-surface)}
.ltmsg .main{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.ltmsg .mainhead{padding:14px 20px;display:flex;align-items:center;gap:11px;border-bottom:1px solid var(--lt-hairline)}
.ltmsg .mname{font-size:15px;font-weight:700;color:var(--lt-text)}
.ltmsg .iconbtn{background:none;border:none;color:var(--lt-faint);cursor:pointer;font-size:13px;padding:2px 4px;border-radius:6px}
.ltmsg .iconbtn:hover{color:var(--lt-text)}
.ltmsg .msgs{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:11px;min-height:0}
.ltmsg .row{display:flex;width:100%}
.ltmsg .row.me{justify-content:flex-end}
.ltmsg .col{display:inline-flex;flex-direction:column;max-width:72%}
.ltmsg .row.me .col{align-items:flex-end}
.ltmsg .bubble{padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.5;word-break:break-word;overflow-wrap:anywhere;white-space:pre-wrap}
.ltmsg .bubble.them{background:var(--lt-surface-2);color:var(--lt-text);border-bottom-left-radius:5px}
.ltmsg .bubble.me{background:#1DB954;color:#04120a;font-weight:500;border-bottom-right-radius:5px}
.ltmsg .time{font-size:10.5px;color:var(--lt-faint);margin-top:4px}
.ltmsg .replybar{display:flex;gap:10px;align-items:center;padding:14px 18px;border-top:1px solid var(--lt-hairline)}
.ltmsg .inp{width:100%;background:var(--lt-input-bg);border:1px solid var(--lt-input-border);border-radius:10px;padding:11px 13px;color:var(--lt-text);font-family:inherit;font-size:14px;outline:none;transition:.15s}
.ltmsg .inp:focus{border-color:#1DB954}
.ltmsg textarea.inp{resize:vertical;min-height:96px}
.ltmsg .emptymain{flex:1;display:flex;align-items:center;justify-content:center;color:var(--lt-muted);font-size:14px;padding:40px;text-align:center}
.ltmsg .emptylist{padding:34px 20px;color:var(--lt-muted);font-size:13px;text-align:center;line-height:1.6}
.ltmsg .modal{position:fixed;inset:0;background:rgba(6,5,12,0.68);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:1100;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto}
.ltmsg .modalbox{width:100%;max-width:460px;border-radius:20px;padding:26px;background:var(--lt-modal-bg);border:var(--lt-modal-border);box-shadow:var(--lt-modal-shadow);backdrop-filter:var(--lt-modal-blur);-webkit-backdrop-filter:var(--lt-modal-blur)}
.ltmsg .mtitle{font-family:var(--font-display),'Playfair Display',serif;font-size:19px;font-weight:700;color:var(--lt-text)}
.ltmsg .msub{font-size:12.5px;color:var(--lt-muted);margin:6px 0 18px;line-height:1.6}
.ltmsg .lab{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--lt-muted);display:block;margin-bottom:6px}
.ltmsg .err{font-size:12px;color:#f2777a;margin-top:6px}
.ltmsg .toast{position:fixed;bottom:26px;right:26px;padding:12px 18px;border-radius:12px;font-size:13.5px;font-weight:700;box-shadow:0 12px 30px -10px rgba(0,0,0,0.5);z-index:1300;display:flex;align-items:center;gap:9px}
.ltmsg .toast.success{background:#1DB954;color:#04120a}
.ltmsg .toast.error{background:#ef4444;color:#fff}
@media(max-width:767px){
  .ltmsg .shell{flex-direction:column;height:auto;min-height:0}
  .ltmsg .side{width:100%;border-right:none;border-bottom:1px solid var(--lt-hairline);max-height:290px}
  .ltmsg .main{min-height:60vh}
  .ltmsg .col{max-width:86%}
}
`

function initials(name) {
  const s = (name || '').trim()
  if (!s) return '·'
  const parts = s.split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || s[0].toUpperCase()
}

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
  const [replyUsage, setReplyUsage] = useState(null)
  const [replyModerationError, setReplyModerationError] = useState('')
  const [portalModerationError, setPortalModerationError] = useState('')
  const bottomRef = useRef(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function loadReplyUsage() {
    if (!user?.id) return
    try {
      const u = await fetchMyCreativeMessageReplyUsage(supabase)
      setReplyUsage(u)
    } catch {
      setReplyUsage({ used: 0, maxAllowed: 0, unlimited: true, rpcMissing: true })
    }
  }

  async function sendPortal() {
    if (!newMessageEmail.trim() || !newMessageText.trim()) return
    if (!profile?.id) { showToast('Only creatives can send new messages', 'error'); return }
    setPortalModerationError('')
    setSendingPortal(true)
    try {
      const bodyText = newMessageText.trim()
      const mod = await moderateText(bodyText)
      if (mod?.blocked) {
        setPortalModerationError(MODERATION_BLOCKED_USER_MESSAGE)
        return
      }
      if (mod?.flagged) console.warn('[moderation] Flagged portal message', mod.reason)
      if (
        threadOwnerTierContactSharingRestricted(profile?.subscription_tier) &&
        messageBodyContainsContactDetails(bodyText)
      ) {
        showToast(MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE, 'error')
        return
      }

      if (
        replyUsage &&
        !replyUsage.unlimited &&
        isAtOrOverCreativeReplyLimit(replyUsage, profile?.subscription_tier)
      ) {
        showToast(MONTHLY_MESSAGE_LIMIT_EXCEEDED_MESSAGE, 'error')
        return
      }

      const email = newMessageEmail.trim()

      const { data: clientAccountRow } = await supabase
        .from('client_accounts')
        .select('id, email')
        .eq('email', email)
        .maybeSingle()

      const { data: thread, error: threadError } = await supabase
        .from('message_threads')
        .insert({
          creative_id: user.id,
          client_user_id: clientAccountRow?.id ?? null,
          client_name: newMessageName || email,
          client_email: email,
          subject: 'New Message',
        })
        .select()
        .single()
      if (threadError) throw threadError

      const creativeLabel = creativeSenderDisplayName(profile, user)
      const { error: msgError } = await supabase.from('messages').insert({
        thread_id: thread.id,
        sender_type: 'creative',
        sender_name: creativeLabel,
        body: bodyText,
        creative_id: user.id,
      })
      if (msgError) {
        await supabase.from('message_threads').delete().eq('id', thread.id)
        if (isMonthlyMessageLimitError(msgError)) {
          showToast(MONTHLY_MESSAGE_LIMIT_EXCEEDED_MESSAGE, 'error')
          return
        }
        throw msgError
      }

      const { error: fnError } = await supabase.functions.invoke('send-message-notification', {
        body: {
          to: email,
          toName: newMessageName || email,
          fromName: creativeLabel,
          subject: `New message from ${creativeLabel} on LensTrybe`,
          messageBody: bodyText,
          threadSubject: 'New Message',
          replyToEmail: user.email,
        },
      })
      if (fnError) throw fnError

      await loadThreads()
      setShowNewMessage(false)
      setNewMessageEmail('')
      setNewMessageName('')
      setNewMessageText('')
      showToast('Message sent to ' + email)
      await loadReplyUsage()
    } catch (err) {
      if (isMonthlyMessageLimitError(err)) {
        showToast(MONTHLY_MESSAGE_LIMIT_EXCEEDED_MESSAGE, 'error')
      } else {
        showToast('Failed to send: ' + (err?.message ?? 'Unknown error'), 'error')
      }
    } finally {
      setSendingPortal(false)
    }
  }

  useEffect(() => { loadThreads() }, [user, profile?.id])
  useEffect(() => { loadReplyUsage() }, [user?.id, profile?.subscription_tier])
  useEffect(() => { if (selected) loadMessages(selected.id) }, [selected])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768) }
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
    setReplyModerationError('')
    const mod = await moderateText(bodyText)
    if (mod?.blocked) {
      setReplyModerationError(MODERATION_BLOCKED_USER_MESSAGE)
      return
    }
    if (mod?.flagged) console.warn('[moderation] Flagged reply', mod.reason)
    if (selected.contactSharingRestricted && messageBodyContainsContactDetails(bodyText)) {
      showToast(MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE, 'error')
      return
    }
    const imListingCreative = selected.creative_id === user.id
    if (
      imListingCreative &&
      replyUsage &&
      !replyUsage.unlimited &&
      isAtOrOverCreativeReplyLimit(replyUsage, profile?.subscription_tier)
    ) {
      showToast(MONTHLY_MESSAGE_LIMIT_EXCEEDED_MESSAGE, 'error')
      return
    }

    setSending(true)
    try {
      if (imListingCreative) {
        const creativeLabel = creativeSenderDisplayName(profile, user)
        const { error: insertErr } = await supabase.from('messages').insert({
          thread_id: selected.id,
          sender_type: 'creative',
          sender_name: creativeLabel,
          body: bodyText,
          creative_id: user.id,
        })
        if (insertErr) {
          if (isMonthlyMessageLimitError(insertErr)) {
            showToast(MONTHLY_MESSAGE_LIMIT_EXCEEDED_MESSAGE, 'error')
            return
          }
          throw insertErr
        }
        if (selected?.client_email) {
          await supabase.functions.invoke('send-message-notification', {
            body: {
              to: selected.client_email,
              toName: selected.resolvedClientName ?? selected.client_name ?? selected.client_email,
              fromName: creativeLabel,
              subject: `Reply from ${creativeLabel} on LensTrybe`,
              messageBody: bodyText,
              threadSubject: selected.subject ?? 'your enquiry',
              replyToEmail: user.email,
              recipientRole: 'client',
            },
          })
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
        const { error: clientInsertErr } = await supabase.from('messages').insert(msgPayload)
        if (clientInsertErr) throw clientInsertErr
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
              replyToEmail: user.email,
              recipientRole: 'creative',
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
      if (imListingCreative) await loadReplyUsage()
    } catch (err) {
      if (isMonthlyMessageLimitError(err)) {
        showToast(MONTHLY_MESSAGE_LIMIT_EXCEEDED_MESSAGE, 'error')
      } else {
        showToast('Failed to send: ' + (err?.message ?? 'Unknown error'), 'error')
      }
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="ltmsg" style={{ padding: 40, color: 'var(--lt-muted)' }}><style>{CSS}</style>Loading messages…</div>

  const monthlyReplyCap = creativeMonthlyReplyLimit(profile?.subscription_tier)
  const showMonthlyReplyUsage =
    Boolean(profile?.id) && monthlyReplyCap != null && replyUsage && !replyUsage.unlimited && !replyUsage.rpcMissing
  const creativeMonthlyRepliesBlocked =
    Boolean(profile?.id) && replyUsage && !replyUsage.unlimited &&
    isAtOrOverCreativeReplyLimit(replyUsage, profile?.subscription_tier)

  const peerName = selected?.nickname ?? selected?.peerDisplayName ?? 'Client'

  return (
    <div className="ltmsg">
      <style>{CSS}</style>

      {toast && <div className={`toast ${toast.type}`}>{toast.type === 'success' ? '✓' : '✕'} {toast.msg}</div>}

      <div className="head">
        <div>
          <div className="title">Messages</div>
          <div className="sub">Enquiries and conversations with your clients.</div>
        </div>
        {profile && (
          <button type="button" className="btn primary" disabled={creativeMonthlyRepliesBlocked}
            onClick={() => { setNewMessageEmail(''); setNewMessageName(''); setNewMessageText(''); setShowNewMessage(true) }}>
            + New message
          </button>
        )}
      </div>

      {showMonthlyReplyUsage && (
        <div className={`usage${creativeMonthlyRepliesBlocked ? ' blocked' : ''}`}>
          {replyUsage.used} / {monthlyReplyCap} message replies this calendar month (UTC). Resets on the 1st.
          {creativeMonthlyRepliesBlocked ? ` ${MONTHLY_MESSAGE_LIMIT_EXCEEDED_MESSAGE}` : ''}
        </div>
      )}

      <div className="shell">
        <div className="side">
          <div className="sidehead">Conversations ({threads.length})</div>
          <div className="threads">
            {threads.length === 0 ? (
              <div className="emptylist">No messages yet. When clients enquire, they'll appear here.</div>
            ) : threads.map((t) => (
              <div key={t.id} className={`thread${selected?.id === t.id ? ' on' : ''}`}
                onClick={async () => {
                  setSelected(t)
                  await supabase.from('message_threads').update({ last_read_at: new Date().toISOString() }).eq('id', t.id)
                  setThreads(prev => prev.map(x => x.id === t.id ? { ...x, isUnread: false } : x))
                }}>
                <div className="avatar">{initials(t.nickname ?? t.peerDisplayName)}</div>
                <div className="tmeta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {t.isUnread && <span className="dot" />}
                    <span className={`tname${t.isUnread ? ' unread' : ''}`}>{t.nickname ?? t.peerDisplayName}</span>
                  </div>
                  <div className="tprev">{t.subject ?? 'New enquiry'}</div>
                </div>
                <button className="del" title="Delete conversation"
                  onClick={async e => {
                    e.stopPropagation()
                    if (!window.confirm('Delete this conversation?')) return
                    await supabase.from('messages').delete().eq('thread_id', t.id)
                    await supabase.from('message_threads').delete().eq('id', t.id)
                    setThreads(prev => prev.filter(x => x.id !== t.id))
                    if (selected?.id === t.id) setSelected(null)
                  }}>✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="main">
          {!selected ? (
            <div className="emptymain">Select a conversation to view messages</div>
          ) : (
            <>
              <div className="mainhead">
                <div className="avatar">{initials(peerName)}</div>
                {editingNickname ? (
                  <input autoFocus className="inp" style={{ maxWidth: 260, padding: '6px 10px' }}
                    defaultValue={selected?.nickname ?? selected?.peerDisplayName ?? ''}
                    onBlur={async e => {
                      const nickname = e.target.value.trim()
                      await supabase.from('message_threads').update({ nickname }).eq('id', selected.id)
                      setThreads(prev => prev.map(t => t.id === selected.id ? { ...t, nickname } : t))
                      setSelected(prev => ({ ...prev, nickname }))
                      setEditingNickname(false)
                    }}
                    onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
                ) : (
                  <>
                    <span className="mname">{peerName}</span>
                    <button type="button" className="iconbtn" title="Rename" onClick={() => setEditingNickname(true)}>✎</button>
                  </>
                )}
              </div>

              <div className="msgs">
                {messages.length === 0 ? (
                  <div style={{ color: 'var(--lt-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>No messages in this thread yet.</div>
                ) : messages.map((msg, i) => {
                  const isCreative = msg.sender_type === 'creative'
                  const me = (isCreative && selected.creative_id === user.id) || (!isCreative && selected.creative_id !== user.id)
                  return (
                    <div key={i} className={`row${me ? ' me' : ''}`}>
                      <div className="col">
                        <div className={`bubble ${me ? 'me' : 'them'}`}>{msg.body}</div>
                        <div className="time">{new Date(msg.created_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <div className="replybar">
                <div style={{ flex: 1 }}>
                  <input className="inp" placeholder="Type your reply…" value={reply}
                    onChange={e => { setReplyModerationError(''); setReply(e.target.value) }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendReply() } }} />
                  {replyModerationError ? <div className="err">{replyModerationError}</div> : null}
                </div>
                <button className="btn primary" style={{ minHeight: 44 }}
                  disabled={sending || !reply.trim() || (selected?.creative_id === user.id && creativeMonthlyRepliesBlocked)}
                  onClick={() => void sendReply()}>
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showNewMessage && (
        <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) { setShowNewMessage(false); setPortalModerationError('') } }}>
          <div className="modalbox">
            <div className="mtitle">New message</div>
            <p className="msub">Send a portal link to a client. They'll get a link to view their invoices, quotes, contracts and messages with you. No account needed.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
              <div>
                <label className="lab">Client name</label>
                <input className="inp" value={newMessageName} onChange={e => setNewMessageName(e.target.value)} placeholder="Jane Smith" />
              </div>
              <div>
                <label className="lab">Client email</label>
                <input className="inp" type="email" value={newMessageEmail} onChange={e => setNewMessageEmail(e.target.value)} placeholder="jane@example.com" />
              </div>
              <div>
                <label className="lab">Message</label>
                <textarea className="inp" value={newMessageText} onChange={e => { setPortalModerationError(''); setNewMessageText(e.target.value) }} placeholder="Write your message..." />
                {portalModerationError ? <div className="err">{portalModerationError}</div> : null}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn ghost" onClick={() => { setShowNewMessage(false); setNewMessageEmail(''); setNewMessageName(''); setNewMessageText(''); setPortalModerationError('') }}>Cancel</button>
              <button type="button" className="btn primary"
                disabled={sendingPortal || !newMessageEmail.trim() || !newMessageText.trim() || creativeMonthlyRepliesBlocked}
                onClick={() => void sendPortal()}>
                {sendingPortal ? 'Sending…' : 'Send portal link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
