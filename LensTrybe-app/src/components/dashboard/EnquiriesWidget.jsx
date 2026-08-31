import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useSubscription } from '../../context/SubscriptionContext'
import { fetchMyCreativeMessageReplyUsage, creativeMonthlyReplyLimit } from '../../lib/messageMonthlyLimit'
import { isDemoMode, demoThreadsUnread, demoReplyUsage } from '../../lib/demoMode'
import { FONT, TEXT, MUTED, FAINT, GREEN, PINK, DANGER, Tile, CenterModal } from './widgetKit'

function timeAgo(v) {
  if (!v) return ''
  const s = Math.max(1, Math.floor((Date.now() - new Date(v).getTime()) / 1000))
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export default function EnquiriesWidget({ userId }) {
  const navigate = useNavigate()
  const { tier } = useSubscription()
  const [threads, setThreads] = useState([])
  const [usage, setUsage] = useState(null)
  const [open, setOpen] = useState(false)

  async function load() {
    if (!userId) return
    if (isDemoMode()) { setThreads(demoThreadsUnread()); return }
    const { data } = await supabase.from('message_threads').select('id, client_name, nickname, subject, unread_count, last_message_at').eq('creative_id', userId).gt('unread_count', 0).order('last_message_at', { ascending: false })
    setThreads(data ?? [])
  }
  useEffect(() => { void load() }, [userId])
  useEffect(() => {
    if (isDemoMode()) { setUsage(demoReplyUsage()); return }
    let active = true
    fetchMyCreativeMessageReplyUsage(supabase).then((u) => { if (active) setUsage(u) }).catch(() => { if (active) setUsage({ used: 0, maxAllowed: 0, unlimited: true, rpcMissing: true }) })
    return () => { active = false }
  }, [userId])

  const newCount = threads.length
  const cap = creativeMonthlyReplyLimit(tier)
  const replyLine = useMemo(() => {
    if (cap == null) return { text: 'Unlimited replies this month', pct: null, over: false }
    if (!usage || usage.rpcMissing) return { text: `Up to ${cap} replies this month`, pct: null, over: false }
    const remaining = Math.max(0, cap - usage.used)
    return { text: `${remaining} of ${cap} replies left this month`, pct: Math.min(100, Math.round((usage.used / cap) * 100)), over: remaining <= 0 }
  }, [usage, cap])

  function go(path) { setOpen(false); navigate(path) }

  return (
    <>
      <Tile label="Enquiries" onClick={() => setOpen(true)}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', color: newCount ? TEXT : GREEN, fontFamily: FONT, lineHeight: 1 }}>{newCount || '0'}</span>
          <span style={{ fontSize: 12.5, color: MUTED, fontFamily: FONT }}>{newCount ? 'new' : 'caught up'}</span>
        </div>
      </Tile>

      {open ? (
        <CenterModal title="Enquiries" subtitle="Inbox" width={520} onClose={() => setOpen(false)}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: replyLine.over ? DANGER : MUTED, fontFamily: FONT }}>{replyLine.text}</div>
            {replyLine.pct != null ? (
              <div style={{ height: 6, borderRadius: 999, background: 'var(--lt-border)', marginTop: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${replyLine.pct}%`, borderRadius: 999, background: replyLine.over ? DANGER : `linear-gradient(90deg, ${GREEN}, ${PINK})` }} />
              </div>
            ) : null}
            {replyLine.over ? <button type="button" onClick={() => go('/dashboard/settings/subscription')} style={{ marginTop: 6, background: 'none', border: 'none', color: GREEN, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', padding: 0 }}>Upgrade for more replies →</button> : null}
          </div>
          <div style={{ height: 1, background: 'var(--lt-border)', margin: '4px 0 8px' }} />
          {newCount === 0 ? (
            <div style={{ fontSize: 14, color: GREEN, fontFamily: FONT, padding: '8px 0' }}>You&apos;re all caught up ✨</div>
          ) : threads.map((th) => (
            <button key={th.id} type="button" onClick={() => go('/dashboard/clients/messages')} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--lt-surface-2)', cursor: 'pointer' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: PINK, flexShrink: 0, boxShadow: `0 0 8px ${PINK}` }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14, color: TEXT, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{th.nickname || th.client_name || 'Client'}</span>
                {th.subject ? <span style={{ display: 'block', fontSize: 12, color: FAINT, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{th.subject}</span> : null}
              </span>
              <span style={{ flexShrink: 0, fontSize: 12, color: FAINT, fontFamily: FONT }}>{timeAgo(th.last_message_at)}</span>
            </button>
          ))}
          <button type="button" onClick={() => go('/dashboard/clients/messages')} style={{ marginTop: 14, background: 'none', border: 'none', color: GREEN, fontSize: 13.5, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', padding: 0 }}>Open messages →</button>
        </CenterModal>
      ) : null}
    </>
  )
}
