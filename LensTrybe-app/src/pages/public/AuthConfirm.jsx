import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { mountLens } from '../../lib/lens'
import { supabase } from '../../backend/supabaseClient'
import { homeFor } from '../../lib/auth'

// Where the links in the Supabase account emails land (confirm sign-up, confirm a new email),
// so the button in the email points at lenstrybe.com and not at the Supabase project's address,
// which made iCloud file the confirm email as junk (29 Sep). The template sends
// /auth/confirm?token_hash={{ .TokenHash }}&type=email (or email_change); this page swaps the
// token for a session with verifyOtp and opens the right home: the workspace for creatives, the
// portal for clients (which picks up a saved job), Settings after an email change.
const TYPES = ['email', 'signup', 'email_change', 'invite', 'magiclink']

export default function AuthConfirm() {
  const [p] = useSearchParams()
  const cv = useRef(null), once = useRef(false)
  const [st, setSt] = useState('busy')
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .34 }); return () => l.destroy() }, [])
  useEffect(() => {
    if (once.current) return; once.current = true
    const token = p.get('token_hash') || '', type = TYPES.includes(p.get('type')) ? p.get('type') : 'email'
    if (!token || !supabase) { setSt('bad'); return }
    supabase.auth.verifyOtp({ token_hash: token, type }).then(({ data, error }) => {
      if (error || !data?.user) { setSt('bad'); return }
      const kind = String(data.user.user_metadata?.account_type || data.user.user_metadata?.account_kind || 'creative').toLowerCase()
      const to = type === 'email_change' ? '/app/settings' : kind === 'client' ? homeFor('client') : '/app/today?welcome=1'
      setSt('ok'); window.location.replace(to)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="hiw login dark darkhero">
      <canvas className="gl" ref={cv} aria-hidden="true" />
      <div className="lpane lg d">
        {st === 'bad' ? <>
          <p className="eb">Confirm your email</p>
          <h1>That link has <em>expired.</em></h1>
          <p className="hint">Links work once, for twenty-four hours, and only the newest one works if you asked for another. If you've already confirmed, just log in.</p>
          <p className="lfoot"><Link to="/login">Log in</Link>. New here? <Link to="/join">Join LensTrybe</Link>.</p>
        </> : <>
          <p className="eb">Confirm your email</p>
          <h1>{st === 'ok' ? <>You're <em>in.</em></> : <>One <em>moment.</em></>}</h1>
          <p className="hint">{st === 'ok' ? 'Opening your account now.' : 'Confirming your email address.'}</p>
        </>}
      </div>
    </section>
  )
}
