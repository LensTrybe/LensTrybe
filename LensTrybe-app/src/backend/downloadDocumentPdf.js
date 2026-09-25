import { supabase } from './supabaseClient'

/**
 * Download a branded PDF of an invoice, quote or contract (document-pdf Edge Function).
 * Creatives are identified by their session; clients pass their portal or signing token.
 * Throws an Error with a user-friendly message on failure.
 */
export async function downloadDocumentPdf({ type, id, portalToken, signingToken }) {
  const body = { type, id }
  if (portalToken) body.portal_token = portalToken
  if (signingToken) body.signing_token = signingToken

  const { data, error } = await supabase.functions.invoke('document-pdf', { body })
  if (error || !data?.content_base64) {
    let message = data?.error || 'Could not create the PDF. Please try again.'
    try {
      const ctx = error?.context
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json()
        if (j?.error) message = j.error
      }
    } catch { /* keep default message */ }
    throw new Error(message)
  }

  const bin = atob(data.content_base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = data.filename || `${type}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
