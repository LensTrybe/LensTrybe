import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { tierHas, lowestTierWith } from '../../lib/tierFeatures'
import {
  moderateText,
  moderateImage,
  MODERATION_BLOCKED_USER_MESSAGE,
  PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE,
} from '../../lib/moderateContent'

// The promotional poster an Expert or Elite creative shows the first time a client opens
// their public profile. A picture, or words, or both, and optionally a button that drops the
// client straight into the enquiry form while they are still interested.
//
// The client sees it once. That is deliberate: a premium profile that pops the same thing at
// you every visit stops reading as a promotion and starts reading as an ad.
//
// Top level component. Never define this inside another component's render function.

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'
const PINK = '#FF2D78'
const BUCKET = 'posters'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const HEADING_MAX = 80
const BODY_MAX = 400
const CTA_MAX = 32

const EMPTY = {
  enabled: false,
  heading: '',
  body: '',
  image_path: '',
  cta_enabled: false,
  cta_label: 'Enquire now',
  ends_at: '',
}

// The posters bucket is private, so there is no public URL to build. The owner can read
// their own folder under the storage policies, so signing from here works for the editor
// preview. Clients looking at the profile go through the poster-image function instead,
// which checks the poster is actually live before it signs anything.
const SIGNED_FOR_SECONDS = 3600

async function signedUrl(path) {
  if (!path) return ''
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_FOR_SECONDS)
  if (error) return ''
  return data?.signedUrl || ''
}

// Formats a browser will render, and that storage will accept. SVG is deliberately out:
// it can carry script, and these are served from our own domain.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** yyyy-mm-dd for a date input, from a timestamp. */
function toDateInput(ts) {
  if (!ts) return ''
  try { return new Date(ts).toISOString().slice(0, 10) } catch { return '' }
}

function Label({ children, hint }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--lt-text)' }}>{children}</span>
      {hint && <span style={{ fontSize: 12, color: 'var(--lt-faint)', marginLeft: 8 }}>{hint}</span>}
    </div>
  )
}

function Counter({ value, max }) {
  const over = value.length > max * 0.9
  return (
    <div style={{ fontSize: 11, color: over ? PINK : 'var(--lt-faint)', textAlign: 'right', marginTop: 4 }}>
      {value.length} / {max}
    </div>
  )
}

export default function ProfilePosterCard({ userId, tier }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  // Signing is a round trip, so the preview URL is state rather than something derived
  // during render.
  const [imageUrl, setImageUrl] = useState('')
  const fileRef = useRef(null)

  const locked = !tierHas(tier, 'profilePoster')

  const field = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setMessage('')
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!userId) return undefined
    supabase.from('profile_posters').select('*').eq('creative_id', userId).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (data) {
          setForm({
            enabled: !!data.enabled,
            heading: data.heading || '',
            body: data.body || '',
            image_path: data.image_path || '',
            cta_enabled: !!data.cta_enabled,
            cta_label: data.cta_label || 'Enquire now',
            ends_at: toDateInput(data.ends_at),
          })
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId])

  // Re-sign whenever the picture changes. A signed URL expires, so this also refreshes
  // it if the card is left open for a long editing session.
  useEffect(() => {
    let cancelled = false
    if (!form.image_path) { setImageUrl(''); return undefined }
    signedUrl(form.image_path).then((url) => { if (!cancelled) setImageUrl(url) })
    return () => { cancelled = true }
  }, [form.image_path])

  async function pickImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    if (!IMAGE_TYPES.includes(file.type)) {
      setError('That needs to be a JPG, PNG, WebP or GIF.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) { setError('That image is over 5MB. Try a smaller one.'); return }

    setUploading(true)
    try {
      // Same check the portfolio and avatar uploads run. A poster is the first thing a
      // client sees on a profile, so it should not be the one upload that skips it.
      const check = await moderateImage(file)
      if (check?.blocked) {
        setError(PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE)
        if (fileRef.current) fileRef.current.value = ''
        return
      }
      if (check?.flagged) console.warn('[moderateContent] Poster image flagged (upload allowed)', check?.reason ?? '')

      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${userId}/poster-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
      if (upErr) { setError('That did not upload. Please try again.'); return }

      // Clear the old file rather than leaving it sitting in storage forever.
      const previous = form.image_path
      field('image_path', path)
      if (previous && previous !== path) {
        supabase.storage.from(BUCKET).remove([previous]).catch(() => { /* best effort */ })
      }
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setError(err?.message || 'Could not check that image. Please try again.')
      if (fileRef.current) fileRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }

  async function removeImage() {
    const previous = form.image_path
    field('image_path', '')
    if (previous) supabase.storage.from(BUCKET).remove([previous]).catch(() => { /* best effort */ })
  }

  const hasContent = !!(form.heading.trim() || form.body.trim() || form.image_path)

  async function save() {
    setError('')
    setMessage('')
    if (form.enabled && !hasContent) {
      setError('Add a picture or some words before you switch it on.')
      return
    }
    setSaving(true)

    // Heading, body and button label all end up in front of a client, so all three go
    // through the same check the rest of the app uses. One call, because the checker
    // works on a blob of text and three round trips would only slow the save down.
    const words = [form.heading, form.body, form.cta_enabled ? form.cta_label : '']
      .map((s) => (s || '').trim()).filter(Boolean).join('\n')
    if (words) {
      try {
        const check = await moderateText(words)
        if (check?.blocked) {
          setSaving(false)
          setError(MODERATION_BLOCKED_USER_MESSAGE)
          return
        }
        if (check?.flagged) console.warn('[moderateContent] Poster text flagged (save allowed)', check?.reason ?? '')
      } catch {
        // The checker being unreachable should not stop someone editing their own
        // poster. The image check above is the one that matters most, and it fails loud.
      }
    }

    const { error: saveErr } = await supabase.from('profile_posters').upsert({
      creative_id: userId,
      enabled: form.enabled,
      heading: form.heading.trim() || null,
      body: form.body.trim() || null,
      image_path: form.image_path || null,
      cta_enabled: form.cta_enabled,
      cta_label: form.cta_enabled ? (form.cta_label.trim() || 'Enquire now') : null,
      // A date input gives a plain day. Run it to the end of that day so a poster set to
      // finish on the 30th is still up all through the 30th.
      ends_at: form.ends_at ? new Date(`${form.ends_at}T23:59:59`).toISOString() : null,
    }, { onConflict: 'creative_id' })
    setSaving(false)
    if (saveErr) { setError(saveErr.message || 'Could not save your poster.'); return }
    setMessage(form.enabled ? 'Saved. Clients will see this on your profile.' : 'Saved. Your poster is switched off.')
  }

  const cardStyle = {
    background: 'var(--lt-glass-bg)',
    border: 'var(--lt-glass-border)',
    boxShadow: 'var(--lt-glass-shadow)',
    backdropFilter: 'var(--lt-glass-blur)',
    WebkitBackdropFilter: 'var(--lt-glass-blur)',
    borderRadius: 16,
    padding: 18,
  }
  const inputStyle = {
    width: '100%', boxSizing: 'border-box', background: 'var(--lt-input-bg)',
    border: '1px solid var(--lt-input-border)', borderRadius: 10, padding: '10px 12px',
    color: 'var(--lt-text)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none',
  }

  if (locked) {
    const need = lowestTierWith('profilePoster')
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--lt-text)' }}>Profile poster</div>
        <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.6, margin: '6px 0 16px' }}>
          Show clients an offer the moment they open your profile. A picture, a few words, and a
          button that takes them straight to enquiring. Available on {need === 'elite' ? 'Elite' : 'Expert'} and above.
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/settings/subscription')}
          style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: GREEN, color: GREEN_TEXT, fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          See plans
        </button>
      </div>
    )
  }

  if (loading) {
    return <div style={cardStyle}><div style={{ fontSize: 13, color: 'var(--lt-faint)' }}>Loading your poster…</div></div>
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--lt-text)' }}>Profile poster</div>
          <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.6, marginTop: 4 }}>
            Shown once the first time a client opens your profile. Good for a seasonal offer, a
            few remaining spots, or something you want noticed before they scroll.
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => field('enabled', e.target.checked)}
            style={{ width: 17, height: 17, accentColor: GREEN, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--lt-text)' }}>
            {form.enabled ? 'On' : 'Off'}
          </span>
        </label>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Label hint="optional">Picture</Label>
        {imageUrl ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <img
              src={imageUrl}
              alt="Your poster"
              style={{ width: 132, height: 132, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--lt-border)' }}
            />
            <button
              type="button"
              onClick={removeImage}
              style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid var(--lt-border)', background: 'none', color: 'var(--lt-text)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              Remove picture
            </button>
          </div>
        ) : (
          <>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={pickImage} disabled={uploading} style={{ fontSize: 13, color: 'var(--lt-muted)' }} />
            <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 5 }}>
              {uploading ? 'Uploading…' : 'Up to 5MB. A square or portrait picture sits best.'}
            </div>
          </>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <Label hint="optional">Heading</Label>
        <input
          value={form.heading}
          maxLength={HEADING_MAX}
          onChange={(e) => field('heading', e.target.value)}
          placeholder="20% off spring shoots"
          style={inputStyle}
        />
        <Counter value={form.heading} max={HEADING_MAX} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <Label hint="optional">Words</Label>
        <textarea
          value={form.body}
          maxLength={BODY_MAX}
          onChange={(e) => field('body', e.target.value)}
          placeholder="Booking now for September and October. Three weekend spots left."
          style={{ ...inputStyle, minHeight: 90, resize: 'vertical', lineHeight: 1.55 }}
        />
        <Counter value={form.body} max={BODY_MAX} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={form.cta_enabled}
            onChange={(e) => field('cta_enabled', e.target.checked)}
            style={{ width: 16, height: 16, accentColor: GREEN, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lt-text)' }}>Add a button that opens your enquiry form</span>
        </label>
        {form.cta_enabled && (
          <>
            <input
              value={form.cta_label}
              maxLength={CTA_MAX}
              onChange={(e) => field('cta_label', e.target.value)}
              placeholder="Enquire now"
              style={inputStyle}
            />
            <Counter value={form.cta_label} max={CTA_MAX} />
          </>
        )}
      </div>

      <div style={{ marginBottom: 18 }}>
        <Label hint="optional">Stop showing it after</Label>
        <input
          type="date"
          value={form.ends_at}
          onChange={(e) => field('ends_at', e.target.value)}
          style={{ ...inputStyle, maxWidth: 220 }}
        />
        <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 5 }}>
          Leave this empty to keep it up until you switch it off. Worth setting for anything
          with a date in it, so an old offer is not still popping up months later.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={save}
          disabled={saving || uploading}
          style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: GREEN, color: GREEN_TEXT, fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: saving || uploading ? 'not-allowed' : 'pointer', opacity: saving || uploading ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : 'Save poster'}
        </button>
        {message && <span style={{ fontSize: 12.5, color: GREEN, fontWeight: 600 }}>{message}</span>}
        {error && <span style={{ fontSize: 12.5, color: PINK, fontWeight: 600 }}>{error}</span>}
      </div>
    </div>
  )
}
