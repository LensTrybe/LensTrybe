import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { TYPO, LIQUID_GLASS, LIQUID_FIELD } from '../../lib/glassTokensLight'
import { LiquidPill } from '../../components/ui/liquidGlass'
import PublicPageShell from '../../components/layout/PublicPageShell'

// What a client sees when they search the directory before it opens on 1 October.
//
// The homepage hero invites a search, and until launch that search has nowhere to land.
// Rather than a flat "come back later", the page repeats what they were looking for and
// offers to email them when exactly that is live. The search terms go into the waitlist
// row, so on 1 October the list says which discipline and which city each person wanted
// instead of just an address.
//
// Also covers /creatives/:id, where there is no search context and it reads as a plain
// notice. Both routes go through DirectoryGate in App.jsx, which stops rendering this the
// moment hasLaunched() is true.

const GREEN_TEXT = '#0E7C3A'
const PINK_TEXT = '#c11f5a'

function plural(word) {
  const w = String(word || '').trim()
  if (!w) return ''
  return /s$/i.test(w) ? w.toLowerCase() : `${w.toLowerCase()}s`
}

// "Brisbane photographers", "Gold Coast videographers", "Photographers", "Creatives".
//
// Built from what they actually typed. The city goes in front rather than after a
// preposition, because Australians say "on the Gold Coast" but "in Brisbane" and there is
// no way to pick the right one from a city name. Putting it first sidesteps the problem
// and reads more naturally either way.
//
// The city keeps the capitals it arrived with, so this is safe to drop into a sentence
// mid-flow as well as to use as a heading. Lowercasing the whole phrase would turn
// Gold Coast into gold coast.
function searchPhrase({ type, city }) {
  const who = type ? plural(type) : 'creatives'
  const full = city ? `${city.trim()} ${who}` : who
  return full.charAt(0).toUpperCase() + full.slice(1)
}

export default function DirectoryClosedPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const type = params.get('type') || ''
  const city = params.get('city') || ''
  const state = params.get('state') || 'QLD'
  const searched = params.has('type') || params.has('city') || params.has('name')

  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [already, setAlready] = useState(false)
  const [err, setErr] = useState('')
  // Bots fill every field they find. A real person never sees this one.
  const [website, setWebsite] = useState('')

  const phrase = searchPhrase({ type, city })

  async function onSubmit(e) {
    e.preventDefault()
    if (sending) return
    setErr('')
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('waitlist-signup', {
        body: {
          email: email.trim(),
          audience: 'client',
          creative_type: type || null,
          city: city || null,
          state: state || null,
          website,
        },
      })
      if (error) {
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
      setAlready(Boolean(data && data.already))
      setDone(true)
    } catch (e2) {
      setErr(e2.message || 'Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <PublicPageShell maxWidth={700} centre>
      {({ isMobile }) => (
        <div style={{ ...LIQUID_GLASS, width: '100%', textAlign: 'center', padding: isMobile ? '32px 22px' : '44px 40px' }}>
          <p style={{ margin: '0 0 14px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: PINK_TEXT }}>
            Opening 1 October 2026
          </p>

          <h1 style={{ margin: 0, fontSize: isMobile ? '30px' : '40px', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)' }}>
            {searched ? `${phrase} go live on 1 October` : 'The directory opens 1 October'}
          </h1>

          <p style={{ margin: '16px auto 0', maxWidth: '50ch', fontSize: '16px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {searched
              ? 'Our founding creatives are setting up their profiles right now. Leave your email and we will tell you the day you can browse them.'
              : 'Our founding creatives are setting up their profiles right now. Come back on 1 October and you will be able to search every one of them.'}
          </p>

          {done ? (
            <p style={{ margin: '24px auto 0', maxWidth: '46ch', fontSize: '16px', lineHeight: 1.6, color: 'var(--text-primary)', ...TYPO.body }}>
              <strong style={{ color: GREEN_TEXT }}>{already ? 'You are already on the list.' : 'You are on the list.'}</strong>{' '}
              {already
                ? 'We will email you on 1 October when the directory opens.'
                : `We will email you on 1 October. ${searched ? `We have noted you were looking for ${phrase}.` : ''}`}
            </p>
          ) : searched ? (
            <form onSubmit={onSubmit} noValidate style={{ margin: '26px auto 0', maxWidth: '440px' }}>
              <div style={{ display: 'flex', gap: '10px', flexDirection: isMobile ? 'column' : 'row' }}>
                <label htmlFor="dc-email" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Email</label>
                <input
                  id="dc-email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ ...LIQUID_FIELD, flex: '1 1 auto', width: '100%', padding: '13px 14px', textAlign: 'left' }}
                />
                <LiquidPill type="submit" primary disabled={sending}
                  style={{ flex: '0 0 auto', display: 'inline-flex', padding: '13px 22px', whiteSpace: 'nowrap', opacity: sending ? 0.7 : 1 }}>
                  {sending ? 'Saving' : 'Tell me when it opens'}
                </LiquidPill>
              </div>
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
              />
              {err && <p style={{ margin: '12px 0 0', fontSize: '14px', color: PINK_TEXT }}>{err}</p>}
              <p style={{ margin: '12px 0 0', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                One email when we open, plus our newsletter. Unsubscribe any time.
              </p>
            </form>
          ) : null}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '26px' }}>
            <LiquidPill
              primary={!searched || done}
              style={{ flex: '0 0 auto', display: 'inline-flex', padding: '14px 26px' }}
              onClick={() => navigate('/join/creative')}
            >
              I'm a creative, let me in early
            </LiquidPill>
            <LiquidPill style={{ flex: '0 0 auto', display: 'inline-flex', padding: '14px 26px' }} onClick={() => navigate('/')}>
              Back to home
            </LiquidPill>
          </div>
        </div>
      )}
    </PublicPageShell>
  )
}
