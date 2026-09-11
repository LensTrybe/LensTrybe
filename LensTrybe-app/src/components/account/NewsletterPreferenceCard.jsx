import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const GREEN = '#1DB954'

// Works on both dashboards: theme-aware --lt-* tokens first, older tokens as fallback.
const CSS = `
  .ltnews-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 24px; border-radius: 18px;
    background: var(--lt-glass-bg, var(--bg-elevated, #14141c)); border: var(--lt-glass-border, 1px solid rgba(255,255,255,0.08));
    box-shadow: var(--lt-glass-shadow, none); backdrop-filter: var(--lt-glass-blur, none); -webkit-backdrop-filter: var(--lt-glass-blur, none); }
  .ltnews-h { font-size: 15px; font-weight: 800; color: var(--lt-text, var(--text-primary, #fff)); }
  .ltnews-p { font-size: 13px; line-height: 1.6; color: var(--lt-muted, var(--text-muted, #9a9aa8)); margin: 4px 0 0; max-width: 460px; }
  .ltnews-switch { position: relative; width: 48px; height: 28px; border-radius: 999px; border: none; cursor: pointer; padding: 0; transition: background .15s ease; flex-shrink: 0; }
  .ltnews-switch:disabled { opacity: .55; cursor: not-allowed; }
  .ltnews-knob { position: absolute; top: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: left .15s ease; }
`

async function call(body) {
  const { data, error } = await supabase.functions.invoke('email-preferences', { body })
  if (error || data?.error) throw new Error(data?.error || 'Could not update your email preferences.')
  return data
}

export default function NewsletterPreferenceCard() {
  const [subscribed, setSubscribed] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    let cancelled = false
    call({ action: 'me' })
      .then((d) => { if (!cancelled) setSubscribed(!!d.subscribed) })
      .catch(() => { if (!cancelled) setSubscribed(false) })
    return () => { cancelled = true }
  }, [])

  async function toggle() {
    const next = !subscribed
    setBusy(true); setMsg(null)
    try {
      await call({ action: 'set', subscribed: next })
      setSubscribed(next)
      setMsg(next ? "You're subscribed to The Trybe Edit." : "You've been unsubscribed. You'll still get emails about your account.")
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  const on = !!subscribed
  return (
    <div className="ltnews-card">
      <style>{CSS}</style>
      <div>
        <div className="ltnews-h">The Trybe Edit newsletter</div>
        <p className="ltnews-p">Our newsletter and occasional LensTrybe news, tips and features. You'll always get important emails about your account, billing and messages, whatever you choose here.</p>
        {msg && <p className="ltnews-p" style={{ color: GREEN, fontWeight: 600 }}>{msg}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Receive The Trybe Edit newsletter"
        className="ltnews-switch"
        onClick={toggle}
        disabled={busy || subscribed === null}
        style={{ background: on ? GREEN : 'var(--lt-border, rgba(255,255,255,0.18))' }}
      >
        <span className="ltnews-knob" style={{ left: on ? 23 : 3 }} />
      </button>
    </div>
  )
}
