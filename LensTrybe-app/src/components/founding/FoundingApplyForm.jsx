import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { TYPO, LIQUID_GLASS, LIQUID_FIELD } from '../../lib/glassTokensLight'
import { LiquidPill, LiquidSelect } from '../ui/liquidGlass'

/* The founding offer application.
 *
 * One form, used in two places: the modal off the home page hero, and the bottom of
 * /founding. It used to live inside FoundingOfferPage, which meant the hero could only
 * link away to it. Kept as one component so the two can never ask different questions.
 *
 * An application is a request, never a place. It lands in the admin panel, the admins
 * get an email and a notification, and a person decides who gets a code.
 */

// Brand green and pink are too light for text on the public site's near-white
// background, so small type uses the darkened pair the rest of the public site uses.
const GREEN_TEXT = '#0E7C3A'
const PINK_TEXT = '#c11f5a'

const CREATIVE_TYPES = [
  'Photographer',
  'Videographer',
  'Drone pilot',
  'Video editor',
  'Photo editor',
  'Social media manager',
  'Hair and makeup artist',
  'UGC creator',
  'Something else',
]

const EMPTY = {
  name: '',
  business_name: '',
  email: '',
  portfolio_url: '',
  creative_type: '',
  region: '',
}

export default function FoundingApplyForm({ isMobile, framed = true, onDone, autoFocus = false }) {
  const [form, setForm] = useState(EMPTY)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e) {
    e.preventDefault()
    if (sending) return

    // Caught here first so a missing field is named straight away, without a round trip.
    if (!form.name.trim()) { setErr('Please add your name.'); return }
    if (!form.business_name.trim()) { setErr('Please add your business name. Your own name is fine if you trade under it.'); return }
    if (!form.email.trim()) { setErr('Please add your email.'); return }
    if (!form.portfolio_url.trim()) { setErr('Please add a link to your work, like your Instagram or your website.'); return }

    setErr('')
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('founding-apply', { body: form })
      if (error) {
        // invoke() throws away the function's own message on a non-2xx, so read the body.
        let msg = ''
        try {
          const parsed = await error.context.json()
          msg = parsed && parsed.error ? parsed.error : ''
        } catch {
          msg = ''
        }
        throw new Error(msg || 'Something went wrong. Please try again.')
      }
      if (data && data.error) throw new Error(data.error)
      setDone(true)
      if (onDone) onDone()
    } catch (e2) {
      setErr(e2.message || 'Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const frame = framed
    ? { ...LIQUID_GLASS, position: 'relative', zIndex: 1, padding: isMobile ? '20px' : '26px' }
    : { position: 'relative' }

  if (done) {
    return (
      <div style={frame} role="status">
        <div style={{ fontSize: '17px', marginBottom: '8px', color: GREEN_TEXT, ...TYPO.heading }}>
          Thanks, your application is in.
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '15px', ...TYPO.body }}>
          We read every one, so give it a few days. If you are a fit, your code arrives by email
          from connect@lenstrybe.com.
        </div>
      </div>
    )
  }

  const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: '13px 14px', ...LIQUID_FIELD }
  const labelStyle = { display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }
  const optional = { fontWeight: 400, opacity: 0.8 }
  const twoUp = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }

  return (
    <form onSubmit={onSubmit} noValidate style={frame}>
      <div style={twoUp}>
        <div>
          <label style={labelStyle} htmlFor="fo-name">Your name</label>
          <input id="fo-name" type="text" autoComplete="name" maxLength={120} value={form.name}
            autoFocus={autoFocus}
            onChange={(e) => set('name', e.target.value)} placeholder="Jess Turner" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="fo-business">Business name</label>
          <input id="fo-business" type="text" autoComplete="organization" maxLength={120} value={form.business_name}
            onChange={(e) => set('business_name', e.target.value)} placeholder="Turner Photography" style={fieldStyle} />
        </div>
      </div>

      <div style={twoUp}>
        <div>
          <label style={labelStyle} htmlFor="fo-email">Email</label>
          <input id="fo-email" type="email" autoComplete="email" maxLength={254} value={form.email}
            onChange={(e) => set('email', e.target.value)} placeholder="you@yourstudio.com.au" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="fo-link">Instagram or website</label>
          <input id="fo-link" type="text" inputMode="url" maxLength={300} value={form.portfolio_url}
            onChange={(e) => set('portfolio_url', e.target.value)} placeholder="@yourhandle or yourwebsite.com.au" style={fieldStyle} />
        </div>
      </div>

      <div style={twoUp}>
        <div>
          <span style={labelStyle}>What you do <span style={optional}>(optional)</span></span>
          <LiquidSelect
            value={form.creative_type}
            onChange={(v) => set('creative_type', v)}
            ariaLabel="What you do"
            placeholder="Choose one"
            style={{ flex: '1 1 100%' }}
            options={[{ value: '', label: 'Choose one' }, ...CREATIVE_TYPES.map((t) => ({ value: t, label: t }))]}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="fo-region">Where you work <span style={optional}>(optional)</span></label>
          <input id="fo-region" type="text" maxLength={120} value={form.region}
            onChange={(e) => set('region', e.target.value)} placeholder="Brisbane and the Sunshine Coast" style={fieldStyle} />
        </div>
      </div>

      {err && (
        <p role="alert" style={{ margin: '4px 0 12px', fontSize: '13.5px', color: PINK_TEXT, ...TYPO.body }}>{err}</p>
      )}

      <LiquidPill type="submit" primary disabled={sending}
        style={{ flex: '0 0 auto', display: 'inline-flex', padding: '14px 26px', marginTop: '4px', opacity: sending ? 0.7 : 1 }}>
        {sending ? 'Sending' : 'Apply for a place'}
      </LiquidPill>

      <p style={{ margin: '14px 0 0', fontSize: '12.5px', color: 'var(--text-muted)', ...TYPO.body }}>
        No spam. Your details are only used to look at your application and send you a code.
        Read our <Link to="/privacy" style={{ color: GREEN_TEXT, fontWeight: 600, textDecoration: 'none' }}>Privacy Policy</Link>.
      </p>
    </form>
  )
}
