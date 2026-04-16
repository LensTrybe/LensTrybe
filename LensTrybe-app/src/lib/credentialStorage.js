/**
 * Private Supabase Storage for credential documents (bucket: credentials).
 * Never expose returned paths or public URLs in public UI — only profile boolean flags.
 */

const BUCKET = 'credentials'

export const WIZARD_DOC_KEY_TO_TYPE = {
  publicLiability: 'public_liability',
  blueCard: 'blue_card',
  policeCheck: 'police_check',
  wwvp: 'wwvp',
  licence: 'professional_licence',
}

export const WIZARD_DOC_KEY_TO_FLAG = {
  publicLiability: 'has_public_liability',
  blueCard: 'has_blue_card',
  policeCheck: 'has_police_check',
  wwvp: 'has_wwvp',
  licence: 'has_professional_licence',
}

export function sanitizeCredentialFileName(name) {
  const base = String(name || 'document')
    .replace(/[/\\]/g, '_')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  const trimmed = base.slice(0, 180)
  return trimmed || 'document'
}

export async function listCredentialObjectsInUserFolder(supabase, userId) {
  const { data, error } = await supabase.storage.from(BUCKET).list(userId, { limit: 100 })
  if (error) return { files: [], error }
  return { files: Array.isArray(data) ? data : [], error: null }
}

/** Remove all objects in the user's folder whose names start with `${typeSlug}_`. */
export async function removeCredentialFilesForType(supabase, userId, typeSlug) {
  const { files, error: listErr } = await listCredentialObjectsInUserFolder(supabase, userId)
  if (listErr) return { error: listErr }
  const prefix = `${typeSlug}_`
  const paths = files.filter((f) => f?.name && String(f.name).startsWith(prefix)).map((f) => `${userId}/${f.name}`)
  if (!paths.length) return { error: null }
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  return { error }
}

/**
 * Upload one credential file to {user_id}/{credential_type}_{filename}.
 * Replaces any previous file for that credential type in storage.
 */
export async function uploadCredentialForType(supabase, userId, typeSlug, file) {
  if (!file || !userId || !typeSlug) return { error: new Error('Missing upload parameters') }
  const { error: rmErr } = await removeCredentialFilesForType(supabase, userId, typeSlug)
  if (rmErr) return { error: rmErr }
  const safe = sanitizeCredentialFileName(file.name)
  const path = `${userId}/${typeSlug}_${safe}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  return { error }
}
