/* What one client document means, in one place.
 *
 * Documents shows these as rows and My Bookings shows the same documents as
 * chips under the booking they belong to. Those were two copies of this logic
 * and they had already drifted: the chips ignored gallery expiry, so an expired
 * gallery was still clickable and landed on "this link has expired", and they
 * sent a signed contract back to the signing page. One copy, imported by both.
 *
 * Nothing here touches React, so it can be exercised on its own.
 */

/* The shot list builder is not live yet, so /shot-list/:token is not a route on
 * this branch and a shot list row would link nowhere. client_documents() still
 * returns them, so they are filtered out here rather than removed. Flip this to
 * true in the same commit that ships the builder. */
export const SHOT_LISTS_LIVE = false

/** The things a creative can send a client, in the order they are listed. */
export const DOC_KINDS = [
  { key: 'invoice',  collection: 'invoices',   label: 'Invoice' },
  { key: 'quote',    collection: 'quotes',     label: 'Quote' },
  { key: 'contract', collection: 'contracts',  label: 'Contract' },
  { key: 'delivery', collection: 'deliveries', label: 'Gallery' },
  ...(SHOT_LISTS_LIVE ? [{ key: 'shotlist', collection: 'shot_lists', label: 'Shot list' }] : []),
]

export const DOC_LABEL = Object.fromEntries(DOC_KINDS.map((k) => [k.key, k.label]))

const money = (n) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(n) || 0)

/** A date as a client reads it: 5 Oct 2026. */
export const formatDay = (d) => {
  if (!d) return ''
  const parsed = new Date(d)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

const day = formatDay

const daysUntil = (d) => {
  if (!d) return null
  const parsed = new Date(d)
  if (Number.isNaN(parsed.getTime())) return null
  return Math.ceil((parsed.getTime() - Date.now()) / 86400000)
}

const titleCase = (v) => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '')

/* One row's worth of meaning, worked out once so the row itself stays dumb.
 * `tone` drives colour, `act` is the thing worth doing and is null when there
 * is nothing useful to open, and `wants` marks a row that needs a decision.
 */
export function describeDocument(kind, row) {
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
