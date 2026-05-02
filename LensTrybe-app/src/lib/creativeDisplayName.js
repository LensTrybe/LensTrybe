/**
 * Outbound label when the authenticated user is a creative (has a profiles row).
 * Prefer business_name, then full_name; only then fall back to email.
 */
export function creativeSenderDisplayName(profile, user) {
  const business = typeof profile?.business_name === 'string' ? profile.business_name.trim() : ''
  if (business) return business
  const full = typeof profile?.full_name === 'string' ? profile.full_name.trim() : ''
  if (full) return full
  const email = typeof user?.email === 'string' ? user.email.trim() : ''
  if (email) return email
  return 'Creative'
}
