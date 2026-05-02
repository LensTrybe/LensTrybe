import { supabase } from './supabaseClient'

/** Shown inline when moderation blocks user-submitted text anywhere in the app. */
export const MODERATION_BLOCKED_USER_MESSAGE =
  'Your message contains prohibited language and could not be sent. Please review and try again.'

/** Shown when an image is blocked for portfolio-style uploads (profile gallery, deliver files to portfolio bucket, etc.). */
export const PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE =
  'This photo could not be uploaded as it may contain inappropriate content.'

/**
 * Runs {@link moderateImage} in parallel for every `image/*` file. Non-image files are included in `filesToUpload` without scanning.
 * Use before uploading to Supabase. Blocked images are omitted; flagged (not blocked) images are kept and should be logged by the caller (e.g. console.warn).
 *
 * @param {File[]|FileList|null|undefined} files
 * @returns {Promise<{ filesToUpload: File[], blockedFileNames: string[], moderationFailedFileNames: string[] }>}
 */
export async function partitionFilesByPortfolioImageModeration(files) {
  const arr = Array.from(files || []).filter(Boolean)
  const images = arr.filter((f) => f.type.startsWith('image/'))
  const passthrough = arr.filter((f) => !f.type.startsWith('image/'))

  const moderated = await Promise.all(
    images.map(async (file) => {
      try {
        const result = await moderateImage(file)
        return { file, result, err: null }
      } catch (err) {
        return { file, result: null, err }
      }
    }),
  )

  const filesToUpload = [...passthrough]
  const blockedFileNames = []
  const moderationFailedFileNames = []

  for (const { file, result, err } of moderated) {
    if (err) {
      moderationFailedFileNames.push(file.name)
      continue
    }
    if (result?.blocked) {
      blockedFileNames.push(file.name)
      continue
    }
    if (result?.flagged) {
      console.warn('[moderateContent] Portfolio image flagged (upload allowed)', file.name, result?.reason ?? '')
    }
    filesToUpload.push(file)
  }

  return { filesToUpload, blockedFileNames, moderationFailedFileNames }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

async function callModerate(body) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !token) {
    console.warn('[moderateContent] Missing VITE_SUPABASE_URL or auth token')
    return { blocked: false, flagged: false, reason: null }
  }
  let res
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/moderate-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    console.warn('[moderateContent] Request failed', e)
    return { blocked: false, flagged: false, reason: null }
  }
  try {
    return await res.json()
  } catch {
    console.warn('[moderateContent] Response was not JSON')
    return { blocked: false, flagged: false, reason: null }
  }
}

export async function moderateText(text) {
  if (!text || !text.trim()) return { blocked: false, flagged: false, reason: null }
  return callModerate({ type: 'text', text })
}

export async function moderateImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const raw = reader.result
        const base64 = typeof raw === 'string' && raw.includes(',') ? raw.split(',')[1] : raw
        const result = await callModerate({ type: 'image', imageBase64: base64, mimeType: file.type })
        resolve(result)
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
