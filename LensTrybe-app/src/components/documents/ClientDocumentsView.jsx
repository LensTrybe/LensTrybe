import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

/* Everything a client has been sent, in one place.
 *
 * Invoices, quotes, contracts, galleries and shot lists are addressed by email
 * and have only ever been reachable through an emailed token link, so a client
 * who lost the email lost the invoice. client_documents() resolves the same set
 * for the signed in client, and this draws it.
 *
 * The rows still open the existing public token pages rather than reimplementing
 * them, so there is one renderer per document type, not two.
 */

const TYPES = [
  { key: 'all', label: 'Everything' },
  { key: 'invoice', label: 'Invoices' },
  { key: 'quote', label: 'Quotes' },
  { key: 'contract', label: 'Contracts' },
  { key: 'delivery', label: 'Galleries' },
  { key: 'shotlist', label: 'Shot lists' },
]

const money = (n) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(n) || 0)

const day = (d) => {
  if (!d) return ''
  const parsed = new Date(d)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

const daysUntil = (d) => {
  if (!d) return null
  const parsed = new Date(d)
  if (Number.isNaN(parsed.getTime())) return null
  return Math.ceil((parsed.getTime() - Date.now()) / 86400000)
}

const titleCase = (v) => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '')

/* One row's worth of meaning, worked out once so the row itself stays dumb.
 * `tone` drives colour, `act` is the thing worth doing, `wants` puts the row in
 * the attention list at the top. */
function describe(kind, row) {
  if (kind === 'invoice') {
    const paid = String(row.status || '').toLowerCase() === 'paid'
    const late = !paid && row.due_date && daysUntil(row.due_date) < 0
    return {
      title: money(row.amount),
      meta: [row.skill_type, row.due_date ? `${paid ? 'Was due' : 'Due'} ${day(row.due_date)}` : null]
        .filter(Boolean).join(' · '),
      status: paid ? 'Paid' : late ? 'Overdue' : titleCase(row.status) || 'Sent',
      tone: paid ? 'green' : late ? 'pink' : 'neutral',
      wants: !paid,
      act: row.view_token ? { label: paid ? 'View receipt' : 'View invoice', href: `/doc/invoice/${row.view_token}` } : null,
    }
  }

  if (kind === 'quote') {
    const state = String(row.status || '').toLowerCase()
    const expired = state !== 'accepted' && row.valid_until && daysUntil(row.valid_until) < 0
    return {
      title: money(row.amount),
      meta: row.valid_until ? `${expired ? 'Expired' : 'Valid until'} ${day(row.valid_until)}` : '',
      status: expired ? 'Expired' : titleCase(row.status) || 'Sent',
      tone: state === 'accepted' ? 'green' : state === 'declined' || expired ? 'neutral' : 'amber',
      wants: !expired && state !== 'accepted' && state !== 'declined',
      act: row.view_token ? { label: 'View quote', href: `/doc/quote/${row.view_token}` } : null,
    }
  }

  if (kind === 'contract') {
    const signed = Boolean(row.signed_at)
    return {
      title: row.title || 'Contract',
      meta: signed ? `Signed ${day(row.signed_at)}` : 'Not signed yet',
      status: signed ? 'Signed' : 'Awaiting signature',
      tone: signed ? 'green' : 'amber',
      wants: !signed,
      act: !signed && row.signing_token
        ? { label: 'Sign now', href: `/sign/${row.signing_token}` }
        : row.contract_file_url
          ? { label: 'Download', href: row.contract_file_url, external: true }
          : null,
    }
  }

  if (kind === 'delivery') {
    const gone = Boolean(row.files_purged_at)
    const left = daysUntil(row.expires_at)
    const expired = !gone && left !== null && left < 0
    const closing = !gone && !expired && left !== null && left <= 14
    return {
      title: row.title || 'Gallery',
      meta: [
        row.file_count ? `${row.file_count} file${row.file_count === 1 ? '' : 's'}` : null,
        row.password_protected ? 'Password protected' : null,
        gone ? 'Files removed' : expired ? `Expired ${day(row.expires_at)}` : closing ? `Expires in ${left} day${left === 1 ? '' : 's'}` : row.expires_at ? `Available until ${day(row.expires_at)}` : null,
      ].filter(Boolean).join(' · '),
      status: gone ? 'Removed' : expired ? 'Expired' : closing ? 'Expiring' : row.is_final ? 'Final' : 'Ready',
      tone: gone || expired ? 'neutral' : closing ? 'pink' : 'green',
      wants: closing,
      act: !gone && !expired && row.download_token
        ? { label: 'Open gallery', href: `/deliver/${row.download_token}` }
        : null,
    }
  }

  const sent = Boolean(row.client_submitted_at)
  return {
    title: row.name || 'Shot list',
    meta: [row.shoot_date ? day(row.shoot_date) : null, row.kind === 'video' ? 'Video' : 'Photo']
      .filter(Boolean).join(' · '),
    status: sent ? 'Sent' : 'Waiting on you',
    tone: sent ? 'green' : 'amber',
    wants: !sent,
    act: row.client_token ? { label: sent ? 'View your list' : 'Add your groups', href: `/shot-list/${row.client_token}` } : null,
  }
}

const TONE = {
  green: { text: 'var(--lt-green-text)', bg: 'rgba(29,185,84,0.14)', border: 'rgba(29,185,84,0.38)' },
  pink: { text: 'var(--lt-pink-text)', bg: 'rgba(255,45,120,0.13)', border: 'rgba(255,45,120,0.38)' },
  amber: { text: 'var(--lt-amber-text)', bg: 'rgba(245,181,68,0.16)', border: 'rgba(245,181,68,0.42)' },
  neutral: { text: 'var(--lt-muted)', bg: 'var(--lt-surface-2)', border: 'var(--lt-border)' },
}

const LABEL = { invoice: 'Invoice', quote: 'Quote', contract: 'Contract', delivery: 'Gallery', shotlist: 'Shot list' }

function Pill({ tone, children }) {
  const t = TONE[tone] || TONE.neutral
  return (
    <span style={{
      flexShrink: 0, borderRadius: 999, padding: '4px 10px',
      background: t.bg, border: `1px solid ${t.border}`, color: t.text,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function DocRow({ item, showCreative }) {
  const d = item.described
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      padding: '14px 16px', borderRadius: 12,
      background: 'var(--lt-surface)', border: '1px solid var(--lt-border)',
    }}>
      <span style={{
        flexShrink: 0, minWidth: 68, textAlign: 'center', borderRadius: 8, padding: '5px 8px',
        background: 'var(--lt-surface-2)', border: '1px solid var(--lt-border)',
        color: 'var(--lt-muted)', fontSize: 10.5, fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        {LABEL[item.kind]}
      </span>

      <div style={{ flexGrow: 1, minWidth: 160 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>
          {d.title}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 3 }}>
          {[showCreative ? item.creativeName : null, d.meta].filter(Boolean).join(' · ') || day(item.row.created_at)}
        </div>
      </div>

      <Pill tone={d.tone}>{d.status}</Pill>

      {d.act ? (
        <a
          href={d.act.href}
          {...(d.act.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          style={{
            flexShrink: 0, minHeight: 40, display: 'inline-flex', alignItems: 'center',
            padding: '0 16px', borderRadius: 10, textDecoration: 'none',
            background: d.wants ? '#1DB954' : 'var(--lt-input-bg)',
            border: d.wants ? 'none' : '1px solid var(--lt-border)',
            color: d.wants ? '#04120a' : 'var(--lt-text)',
            fontSize: 13.5, fontWeight: 700,
          }}
        >
          {d.act.label}
        </a>
      ) : (
        <span style={{ flexShrink: 0, fontSize: 12.5, color: 'var(--lt-faint)' }}>No link</span>
      )}
    </div>
  )
}

export default function ClientDocumentsView({ onFindCreative }) {
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const [filter, setFilter] = useState('all')
  const [attempt, setAttempt] = useState(0)

  // The fetch lives in the effect and settles in the promise callback, so no
  // state is set synchronously during the effect body, and a response that
  // arrives after the view has gone is dropped rather than setting state on a
  // component that is no longer there. Retrying bumps `attempt`.
  useEffect(() => {
    let ignore = false
    supabase.rpc('client_documents').then(({ data, error }) => {
      if (ignore) return
      if (error) {
        setState({ loading: false, error: 'We could not load your documents just then. Try again in a moment.', data: null })
        return
      }
      setState({ loading: false, error: '', data: data || null })
    })
    return () => { ignore = true }
  }, [attempt])

  const retry = useCallback(() => {
    setState({ loading: true, error: '', data: null })
    setAttempt((n) => n + 1)
  }, [])

  if (state.loading) {
    return <div style={{ padding: 28, fontSize: 14, color: 'var(--lt-muted)' }}>Loading your documents…</div>
  }

  if (state.error) {
    return (
      <div style={{ padding: 28 }}>
        <div style={{ fontSize: 14.5, color: 'var(--lt-text)' }}>{state.error}</div>
        <button
          type="button"
          onClick={retry}
          style={{
          marginTop: 14, minHeight: 44, padding: '0 18px', borderRadius: 10, border: 'none',
          background: '#1DB954', color: '#04120a', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>
          Try again
        </button>
      </div>
    )
  }

  const d = state.data || {}
  const creatives = d.creatives || []
  const nameOf = (id) => creatives.find((c) => c.id === id)?.business_name || 'A creative'

  const items = [
    ...(d.invoices || []).map((row) => ({ kind: 'invoice', row })),
    ...(d.quotes || []).map((row) => ({ kind: 'quote', row })),
    ...(d.contracts || []).map((row) => ({ kind: 'contract', row })),
    ...(d.deliveries || []).map((row) => ({ kind: 'delivery', row })),
    ...(d.shot_lists || []).map((row) => ({ kind: 'shotlist', row })),
  ].map((item) => ({
    ...item,
    id: `${item.kind}:${item.row.id}`,
    creativeName: nameOf(item.row.creative_id),
    described: describe(item.kind, item.row),
  }))

  items.sort((a, b) => new Date(b.row.created_at || 0) - new Date(a.row.created_at || 0))

  if (items.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ maxWidth: 380, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>
            Nothing here yet
          </div>
          <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--lt-muted)', marginTop: 8 }}>
            Quotes, invoices, contracts, galleries and shot lists all land here once a creative sends them, so you never have to dig through your inbox for one.
          </div>
          {onFindCreative && (
            <button type="button" onClick={onFindCreative} style={{
              marginTop: 18, minHeight: 44, padding: '0 20px', borderRadius: 10, border: 'none',
              background: '#1DB954', color: '#04120a', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              Find a creative
            </button>
          )}
        </div>
      </div>
    )
  }

  const attention = items.filter((i) => i.described.wants)
  const shown = filter === 'all' ? items : items.filter((i) => i.kind === filter)
  const counts = items.reduce((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] || 0) + 1 }), {})

  // Grouped by creative, because that is how a client remembers it: the things
  // from the photographer, not the things of type invoice.
  const groups = creatives
    .map((c) => ({ creative: c, rows: shown.filter((i) => i.row.creative_id === c.id) }))
    .filter((g) => g.rows.length > 0)
  const orphans = shown.filter((i) => !creatives.some((c) => c.id === i.row.creative_id))
  if (orphans.length > 0) groups.push({ creative: null, rows: orphans })

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
      {attention.length > 0 && (
        <div style={{
          borderRadius: 14, padding: '16px 18px', marginBottom: 20,
          background: 'rgba(245,181,68,0.10)', border: '1px solid rgba(245,181,68,0.34)',
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--lt-amber-text)' }}>
            Needs you
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {attention.slice(0, 4).map((item) => (
              <DocRow key={`need-${item.id}`} item={item} showCreative />
            ))}
          </div>
          {attention.length > 4 && (
            <div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 10 }}>
              and {attention.length - 4} more below
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {TYPES.filter((t) => t.key === 'all' || counts[t.key]).map((t) => {
          const active = filter === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              style={{
                minHeight: 40, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? 'var(--lt-green-text)' : 'var(--lt-muted)',
                background: active ? 'rgba(29,185,84,0.14)' : 'var(--lt-surface)',
                border: `1px solid ${active ? 'rgba(29,185,84,0.45)' : 'var(--lt-border)'}`,
              }}
            >
              {t.label}{t.key === 'all' ? ` (${items.length})` : ` (${counts[t.key]})`}
            </button>
          )
        })}
      </div>

      {groups.map((g) => (
        <div key={g.creative?.id || 'other'} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div aria-hidden style={{
              width: 34, height: 34, flexShrink: 0, borderRadius: '50%', overflow: 'hidden',
              background: 'rgba(29,185,84,0.18)', color: 'var(--lt-green-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
            }}>
              {g.creative?.avatar_url
                ? <img src={g.creative.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (g.creative?.business_name || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>
                {g.creative?.business_name || 'Other documents'}
              </div>
              {(g.creative?.city || g.creative?.state) && (
                <div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>
                  {[g.creative.city, g.creative.state].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
            {g.creative?.portal_token && (
              <a href={`/portal/${g.creative.portal_token}`} style={{
                flexShrink: 0, minHeight: 40, display: 'inline-flex', alignItems: 'center', padding: '0 14px',
                borderRadius: 10, textDecoration: 'none', background: 'var(--lt-input-bg)',
                border: '1px solid var(--lt-border)', color: 'var(--lt-text)', fontSize: 13, fontWeight: 600,
              }}>
                Open portal
              </a>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {g.rows.map((item) => <DocRow key={item.id} item={item} showCreative={false} />)}
          </div>
        </div>
      ))}

      <div style={{ fontSize: 12, color: 'var(--lt-faint)', paddingTop: 4 }}>
        Everything sent to {d.email}. If a creative used a different address for you, ask them to resend it to this one.
      </div>
    </div>
  )
}
