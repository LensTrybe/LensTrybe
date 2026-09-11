import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { LIQUID_GLASS_CARD } from '../../lib/glassTokensLight'

const GREEN = '#1DB954'
const GREEN_DARK = '#0f7a37'
const GREEN_TEXT = '#04120a'

async function call(body) {
  const { data, error } = await supabase.functions.invoke('email-preferences', { body })
  if (data?.error) throw new Error(data.error)
  if (error) {
    let message = 'Something went wrong. Please try again.'
    try { const j = await error.context?.json?.(); if (j?.error) message = j.error } catch { /* keep default */ }
    throw new Error(message)
  }
  return data
}

export default function UnsubscribePage() {
  const { token } = useParams()
  const { user, profile } = useAuth()
  const [state, setState] = useState(token ? 'working' : 'no-token')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    // Unsubscribe as soon as the page opens: one step, no sign-in needed.
    call({ action: 'unsubscribe', token })
      .then((d) => { if (!cancelled) { setEmail(d.email || ''); setState('unsubscribed') } })
      .catch((e) => { if (!cancelled) { setError(e.message); setState('error') } })
    return () => { cancelled = true }
  }, [token])

  async function resubscribe() {
    setBusy(true); setError('')
    try { await call({ action: 'resubscribe', token }); setState('resubscribed') }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const settingsPath = profile ? '/dashboard/settings' : '/client-dashboard'
  const btn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: 'none', minHeight: 44, textDecoration: 'none' }

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ ...LIQUID_GLASS_CARD, width: '100%', maxWidth: 520, borderRadius: 20, padding: '36px 30px', display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--text-secondary)', lineHeight: 1.65, fontSize: 15 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GREEN_DARK }}>Email preferences</div>

        {state === 'working' && <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Unsubscribing you…</h1>}

        {state === 'unsubscribed' && (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>You're unsubscribed</h1>
            <p style={{ margin: 0 }}>{email ? <><strong style={{ color: 'var(--text-primary)' }}>{email}</strong> won't receive </> : "You won't receive "}The Trybe Edit or other LensTrybe marketing emails any more. If you have an account, you'll still get important emails about it, such as billing and messages.</p>
            <p style={{ margin: 0, fontSize: 14 }}>Unsubscribed by mistake?</p>
            <div><button type="button" style={{ ...btn, background: GREEN, color: GREEN_TEXT }} onClick={resubscribe} disabled={busy}>{busy ? 'Resubscribing…' : 'Resubscribe'}</button></div>
          </>
        )}

        {state === 'resubscribed' && (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Welcome back</h1>
            <p style={{ margin: 0 }}>You're subscribed to The Trybe Edit again. You can unsubscribe any time using the link at the bottom of any of our emails.</p>
          </>
        )}

        {state === 'error' && (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>We couldn't use that link</h1>
            <p style={{ margin: 0 }}>{error} You can also unsubscribe by emailing <a href="mailto:privacy@lenstrybe.com" style={{ color: GREEN_DARK, fontWeight: 600 }}>privacy@lenstrybe.com</a> and we'll take care of it.</p>
          </>
        )}

        {state === 'no-token' && (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Unsubscribe from The Trybe Edit</h1>
            <p style={{ margin: 0 }}>Every LensTrybe newsletter email has an unsubscribe link at the bottom. Click it and you'll be unsubscribed straight away, no sign-in needed.</p>
            {user ? (
              <div><Link to={settingsPath} style={{ ...btn, background: GREEN, color: GREEN_TEXT }}>Manage email preferences</Link></div>
            ) : (
              <p style={{ margin: 0 }}>Have a LensTrybe account? <Link to="/login" style={{ color: GREEN_DARK, fontWeight: 600 }}>Sign in</Link> and turn the newsletter off in your settings.</p>
            )}
            <p style={{ margin: 0, fontSize: 14 }}>Or email <a href="mailto:privacy@lenstrybe.com" style={{ color: GREEN_DARK, fontWeight: 600 }}>privacy@lenstrybe.com</a> and we'll unsubscribe you.</p>
          </>
        )}
      </div>
    </div>
  )
}
