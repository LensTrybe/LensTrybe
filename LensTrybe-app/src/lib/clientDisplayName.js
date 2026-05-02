/**
 * Display label for a client_accounts row (or compatible shape).
 * Used for message threads, notifications, and enquiry flows.
 */
export function formatClientAccountDisplayName(account) {
  if (!account) return ''
  const first = typeof account.first_name === 'string' ? account.first_name.trim() : ''
  const last = typeof account.last_name === 'string' ? account.last_name.trim() : ''
  const parts = [first, last].filter(Boolean).join(' ').trim()
  if (parts) return parts
  const company = typeof account.company_name === 'string' ? account.company_name.trim() : ''
  if (company) return company
  const email = typeof account.email === 'string' ? account.email.trim() : ''
  return email
}
