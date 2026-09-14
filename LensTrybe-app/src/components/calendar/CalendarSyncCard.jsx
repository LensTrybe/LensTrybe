import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// "Sync to your calendar": the creative pastes one private URL into Google, Apple or
// Outlook and their LensTrybe bookings, meetings and blocked out days appear alongside the
// rest of their life. Read only and one way, so nothing here can touch their bookings.
//
// The URL contains a secret token, which is how every calendar subscription works. Anyone
// holding it can read the feed, so the card says so plainly and gives them a way to kill it.
//
// Top level component. Never define this inside another component's render function.

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'
const PINK = '#FF2D78'

function feedUrl(token) {
  const base = import.meta.env.VITE_SUPABASE_URL
  if (!base || !token) return ''
  return `${base}/functions/v1/calendar-feed?token=${token}`
}

function Step({ n, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginBottom: 12 }}>
      <span
        style={{
          width: 21, height: 21, borderRadius: '50%', flexShrink: 0, marginTop: 1,
          background: 'var(--lt-surface-2)', color: 'var(--lt-text)',
          fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {n}
      </span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lt-text)' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--lt-muted)', lineHeight: 1.55, marginTop: 2 }}>{children}</div>
      </div>
    </div>
  )
}

export default function CalendarSyncCard({ userId }) {
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!userId) return undefined
    supabase.from('profiles').select('calendar_token').eq('id', userId).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setToken(data?.calendar_token || null)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId])

  const url = feedUrl(token)
  // Apple Calendar and Outlook subscribe straight from a webcal link. Google needs its own.
  const webcal = url ? url.replace(/^https:\/\//, 'webcal://') : ''
  const googleUrl = url ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` : ''

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      setError('Could not copy. Select the link and copy it by hand.')
    }
  }

  async function resetToken() {
    setResetting(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('reset_calendar_token')
    if (rpcError) {
      setError('Could not create a new link. Please try again.')
    } else {
      setToken(data)
      setConfirmReset(false)
    }
    setResetting(false)
  }

  return (
    <div
      style={{
        background: 'var(--lt-glass-bg)',
        border: 'var(--lt-glass-border)',
        boxShadow: 'var(--lt-glass-shadow)',
        backdropFilter: 'var(--lt-glass-blur)',
        WebkitBackdropFilter: 'var(--lt-glass-blur)',
        borderRadius: 16,
        padding: 18,
        marginBottom: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--lt-text)' }}>Sync to your calendar</div>
          <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.6, marginTop: 4 }}>
            Your bookings, client meetings and blocked out days, in the calendar you already use.
            Set it up once and it keeps itself up to date.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            padding: '9px 18px', borderRadius: 10, border: 'none',
            background: open ? 'var(--lt-surface)' : GREEN,
            color: open ? 'var(--lt-text)' : GREEN_TEXT,
            fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
          }}
        >
          {open ? 'Hide' : 'Set up'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 18, borderTop: '1px solid var(--lt-hairline)', paddingTop: 18 }}>
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--lt-faint)' }}>Loading your link…</div>
          ) : !url ? (
            <div style={{ fontSize: 13, color: PINK }}>
              Your calendar link is not ready yet. Refresh the page, and tell us if it keeps happening.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                  aria-label="Your private calendar link"
                  style={{
                    flex: 1, minWidth: 200, background: 'var(--lt-input-bg)',
                    border: '1px solid var(--lt-input-border)', borderRadius: 10,
                    padding: '10px 12px', color: 'var(--lt-text)', fontSize: 12.5,
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={copy}
                  style={{
                    padding: '10px 18px', borderRadius: 10, border: 'none', background: GREEN,
                    color: GREEN_TEXT, fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>

              <div style={{ fontSize: 12, color: 'var(--lt-faint)', lineHeight: 1.6, marginBottom: 18 }}>
                Treat this like a password. Anyone with the link can see your bookings, so do not post
                it anywhere. If it gets out, create a new one below.
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: GREEN, marginBottom: 12 }}>
                Google Calendar
              </div>
              <Step n="1" title="Open the subscribe page">
                <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={{ color: GREEN, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  Add to Google Calendar
                </a>
                , then click Add when it asks.
              </Step>
              <Step n="2" title="If that does not open">
                In Google Calendar, go to Other calendars, then the plus sign, then From URL, and paste the link.
              </Step>

              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: GREEN, margin: '18px 0 12px' }}>
                Apple Calendar
              </div>
              <Step n="1" title="Subscribe">
                <a href={webcal} style={{ color: GREEN, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  Add to Apple Calendar
                </a>
                . On a Mac you can also use File, then New Calendar Subscription, and paste the link.
              </Step>
              <Step n="2" title="On iPhone">
                Settings, then Apps, then Calendar, then Calendar Accounts, then Add Account, then Other,
                then Add Subscribed Calendar, and paste the link.
              </Step>

              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: GREEN, margin: '18px 0 12px' }}>
                Outlook
              </div>
              <Step n="1" title="Subscribe from the web">
                In Outlook, go to Calendar, then Add calendar, then Subscribe from web, and paste the link.
              </Step>

              <div style={{ borderTop: '1px solid var(--lt-hairline)', paddingTop: 16, marginTop: 18 }}>
                <div style={{ fontSize: 12.5, color: 'var(--lt-muted)', lineHeight: 1.6, marginBottom: 12 }}>
                  This is one way. Your calendar shows what is in LensTrybe, and nothing in your
                  calendar changes your bookings. Most calendars check for new events every few hours,
                  so a booking you accept now may take a little while to appear.
                </div>

                {confirmReset ? (
                  <div style={{ background: 'var(--lt-surface)', border: `1px solid ${PINK}55`, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 13, color: 'var(--lt-text)', fontWeight: 700, marginBottom: 4 }}>
                      Create a new link?
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--lt-muted)', lineHeight: 1.6, marginBottom: 12 }}>
                      The old link stops working straight away. Every calendar you have already set up
                      will go blank until you add the new link to it.
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={resetToken}
                        disabled={resetting}
                        style={{
                          padding: '9px 18px', borderRadius: 9, border: 'none', background: PINK,
                          color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
                          cursor: resetting ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {resetting ? 'Creating…' : 'Yes, create a new link'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        style={{
                          padding: '9px 18px', borderRadius: 9, border: '1px solid var(--lt-border)',
                          background: 'none', color: 'var(--lt-text)', fontSize: 13, fontWeight: 700,
                          fontFamily: 'inherit', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    style={{
                      border: 'none', background: 'none', padding: 0, color: 'var(--lt-muted)',
                      fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                      textDecoration: 'underline', textUnderlineOffset: 3,
                    }}
                  >
                    Create a new link and stop the old one
                  </button>
                )}

                {error && (
                  <div style={{ fontSize: 12.5, color: PINK, marginTop: 10 }}>{error}</div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
