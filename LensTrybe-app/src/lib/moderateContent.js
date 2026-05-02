import { supabase } from './supabaseClient'

/** Shown inline when moderation blocks user-submitted text anywhere in the app. */
export const MODERATION_BLOCKED_USER_MESSAGE =
  'Your message contains prohibited language and could not be sent. Please review and try again.'

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
