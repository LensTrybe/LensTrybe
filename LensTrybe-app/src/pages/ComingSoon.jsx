import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { LIQUID_GLASS, LIQUID_GLASS_CARD, LIQUID_FIELD, GLASS_CARD_GREEN } from '../lib/glassTokensLight'

// ── Launch config ───────────────────────────────────────────────
const LAUNCH = new Date('2026-10-01T00:00:00+10:00')
const FOUNDING_SPOTS = 250
const SITE = 'https://lenstrybe.com'

// Brand tokens (mirror the homepage hero)
const FONT = "'Inter', sans-serif"
const SERIF = "'Instrument Serif', Georgia, serif"
const GREEN = '#1DB954'
const TEXT_PRIMARY = '#14111a'
const TEXT_SECONDARY = '#565560'
const TEXT_MUTED = '#8a8995'
const PAGE_TONE = '246,245,243'

const CREATIVE_TYPES = [
  'Photographer', 'Videographer', 'Drone pilot', 'Video editor', 'Photo editor',
  'Social media manager', 'Hair & makeup artist', 'UGC creator', 'Other',
]
const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']

// ── Drifting pastel tile mosaic (ported from the hero) ──────────
const TILE_GRADS = [
  'linear-gradient(135deg,#a9c8f0,#7fa8e8)',
  'linear-gradient(135deg,#f3bcd6,#e894bd)',
  'linear-gradient(135deg,#cdbcf3,#a98be8)',
  'linear-gradient(135deg,#aee6cb,#7fd0aa)',
  'linear-gradient(135deg,#f6ccb0,#efab82)',
]
const TILE_GAP = 10
const TILE_SINGLE_H = 210
const TILE_PAIR_H = 100
const TILE_PATTERN = ['s', 'p', 's', 'p', 'p', 's']
const TILE_LOOP = TILE_PATTERN.reduce((sum, c) => sum + (c === 's' ? TILE_SINGLE_H : TILE_PAIR_H) + TILE_GAP, 0)

function MosaicColumn({ index }) {
  const dir = index % 2 === 0 ? 'up' : 'down'
  const dur = 44 + (index % 5) * 7
  const rot = index % TILE_PATTERN.length
  const rotated = [...TILE_PATTERN.slice(rot), ...TILE_PATTERN.slice(0, rot)]
  const cells = Array.from({ length: 6 }).flatMap(() => rotated)
  let g = index * 2
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', willChange: 'transform', animation: `${dir === 'up' ? 'ltHeroUp' : 'ltHeroDown'} ${dur}s linear infinite` }}>
        {cells.map((c, i) => {
          if (c === 's') {
            const bg = TILE_GRADS[g++ % TILE_GRADS.length]
            return <div key={i} style={{ height: `${TILE_SINGLE_H}px`, marginBottom: `${TILE_GAP}px`, borderRadius: '12px', background: bg }} />
          }
          const a = TILE_GRADS[g++ % TILE_GRADS.length]
          const b = TILE_GRADS[g++ % TILE_GRADS.length]
          return (
            <div key={i} style={{ display: 'flex', gap: `${TILE_GAP}px`, marginBottom: `${TILE_GAP}px` }}>
              <div style={{ flex: 1, height: `${TILE_PAIR_H}px`, borderRadius: '12px', background: a }} />
              <div style={{ flex: 1, height: `${TILE_PAIR_H}px`, borderRadius: '12px', background: b }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DriftingTiles({ colCount = 8 }) {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: `${TILE_GAP}px`, padding: `${TILE_GAP}px`, zIndex: 0 }}>
      {Array.from({ length: colCount }).map((_, i) => <MosaicColumn key={i} index={i} />)}
    </div>
  )
}

// ── Liquid-glass select (ported from the hero) ──────────────────
function LiquidSelect({ value, onChange, options, placeholder, ariaLabel }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const selected = options.find(o => o.value === value)
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button type="button" aria-label={ariaLabel} onClick={() => setOpen(o => !o)}
        style={{ ...LIQUID_FIELD, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected && selected.value ? TEXT_PRIMARY : TEXT_MUTED }}>{selected ? selected.label : placeholder}</span>
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', color: TEXT_MUTED, fontSize: 10, flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 60, background: 'rgba(255,255,255,0.99)', backdropFilter: 'blur(22px) saturate(140%)', WebkitBackdropFilter: 'blur(22px) saturate(140%)', border: '1px solid rgba(20,17,26,0.08)', borderRadius: 16, boxShadow: '0 24px 54px -16px rgba(40,30,60,0.32)', padding: 6, maxHeight: 232, overflowY: 'auto' }}>
          {options.map(o => (
            <div key={o.value || 'all'} onClick={() => { onChange(o.value); setOpen(false) }}
              style={{ padding: '10px 12px', borderRadius: 11, cursor: 'pointer', fontSize: 14, fontFamily: FONT, color: o.value === value ? GREEN : TEXT_PRIMARY, fontWeight: o.value === value ? 600 : 400, background: o.value === value ? 'rgba(29,185,84,0.12)' : 'transparent' }}
              onMouseEnter={(e) => { if (o.value !== value) e.currentTarget.style.background = 'rgba(20,17,26,0.06)' }}
              onMouseLeave={(e) => { if (o.value !== value) e.currentTarget.style.background = 'transparent' }}>
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LiquidPill({ onClick, children, primary, type = 'button', disabled, style }) {
  const [hover, setHover] = useState(false)
  return (
    <button type={type} onClick={onClick} disabled={disabled} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        ...LIQUID_GLASS, borderRadius: 999, padding: '15px 22px', fontFamily: FONT, fontWeight: 600, fontSize: 14,
        color: TEXT_PRIMARY, cursor: disabled ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', gap: 8, whiteSpace: 'nowrap',
        background: primary
          ? 'linear-gradient(125deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.06) 26%, rgba(255,255,255,0) 52%), linear-gradient(135deg, rgba(29,185,84,0.34) 0%, rgba(29,185,84,0.14) 100%)'
          : LIQUID_GLASS.background,
        transform: hover && !disabled ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        boxShadow: hover && !disabled
          ? '0 30px 64px -18px rgba(40,30,60,0.5), inset 0 1px 1px rgba(255,255,255,0.95), inset 0 -12px 28px rgba(255,255,255,0.22)'
          : LIQUID_GLASS.boxShadow,
        opacity: disabled ? 0.7 : 1, ...style,
      }}>{children}</button>
  )
}

const IconArrow = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>)

// Rotating 360° gradient glow border. The ring + halo sit BEHIND the card (in the
// wrapper's 2px padding gap), so open dropdowns and content are never covered.
const GLOW_GRAD = 'conic-gradient(from var(--a), #1DB954, #38bdf8, #7f77dd, #FF2D78, #1DB954)'
function GlowBorder({ radius = 24, children, style }) {
  return (
    <div style={{ position: 'relative', padding: 2, borderRadius: radius, ...style }}>
      <div aria-hidden style={{ position: 'absolute', inset: -3, borderRadius: radius + 3, background: GLOW_GRAD, filter: 'blur(15px)', opacity: 0.5, animation: 'ltborderspin 6.5s linear infinite', zIndex: 0, pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: radius, padding: 2, background: GLOW_GRAD, WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', animation: 'ltborderspin 6.5s linear infinite', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}

function timeLeft() {
  const diff = LAUNCH - new Date()
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0 }
  return {
    d: Math.floor(diff / 86400000), h: Math.floor((diff / 3600000) % 24),
    m: Math.floor((diff / 60000) % 60), s: Math.floor((diff / 1000) % 60),
  }
}

export default function ComingSoon() {
  const [time, setTime] = useState(timeLeft())
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 900)
  const [colCount, setColCount] = useState(() => (typeof window !== 'undefined' ? Math.max(6, Math.ceil(window.innerWidth / 240)) : 8))
  const [audience, setAudience] = useState('creative')
  const [email, setEmail] = useState('')
  const [creativeType, setCreativeType] = useState('')
  const [stateVal, setStateVal] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [stats, setStats] = useState(null)
  const [refInput, setRefInput] = useState(() => (new URLSearchParams(window.location.search).get('ref') || '').toUpperCase())
  const hp = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setTime(timeLeft()), 1000)
    const onResize = () => { setIsMobile(window.innerWidth < 900); setColCount(Math.max(6, Math.ceil(window.innerWidth / 240))) }
    window.addEventListener('resize', onResize)
    return () => { clearInterval(t); window.removeEventListener('resize', onResize) }
  }, [])

  useEffect(() => {
    let live = true
    supabase.rpc('waitlist_stats').then(({ data }) => { if (live && data) setStats(data) })
    return () => { live = false }
  }, [])

  const creativesJoined = stats?.creatives ?? null
  const spotsLeft = creativesJoined == null ? null : Math.max(0, FOUNDING_SPOTS - creativesJoined)

  async function submit(e) {
    if (e) e.preventDefault()
    if (status === 'loading') return
    const clean = email.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) { setError('Enter a valid email address.'); return }
    setError(''); setStatus('loading')
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('waitlist-signup', {
        body: {
          email: clean, audience,
          creative_type: audience === 'creative' ? (creativeType || null) : null,
          state: stateVal || null,
          referred_by: refInput.trim().toUpperCase() || null, website: hp.current?.value || '',
        },
      })
      if (fnErr || (data && data.error)) { setError((data && data.error) || 'Something went wrong. Try again.'); setStatus('error'); return }
      setResult(data); setStatus('done')
      supabase.rpc('waitlist_stats').then(({ data: s }) => { if (s) setStats(s) })
    } catch {
      setError('Something went wrong. Try again.'); setStatus('error')
    }
  }

  const pad = (n) => String(n).padStart(2, '0')
  const units = [['Days', time.d], ['Hours', time.h], ['Mins', time.m], ['Secs', time.s]]

  return (
    <div style={{ position: 'relative', minHeight: '100vh', width: '100%', overflowX: 'hidden', background: `rgb(${PAGE_TONE})`, color: TEXT_PRIMARY, fontFamily: FONT }}>
      {/* liquid-glass refraction filter — required by LIQUID_GLASS */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id="liquidLens" x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="2" seed="7" result="turb" />
          <feGaussianBlur in="turb" stdDeviation="2.2" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="22" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <style>{`
        @keyframes ltHeroUp { from { transform: translateY(0) } to { transform: translateY(-${TILE_LOOP}px) } }
        @keyframes ltHeroDown { from { transform: translateY(-${TILE_LOOP}px) } to { transform: translateY(0) } }
        @keyframes ltpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.45;transform:scale(.7)} }
        @keyframes ltspin { to { transform: rotate(360deg) } }
        @property --a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
        @keyframes ltborderspin { to { --a: 360deg } }
        .lt-in::placeholder { color: ${TEXT_MUTED} }
        .lt-a { transition: transform .12s ease }
        .lt-a:active { transform: scale(.98) }
        * { box-sizing: border-box }
      `}</style>

      {/* drifting tile field + clearings (desktop only, like the hero) */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {!isMobile && <DriftingTiles colCount={colCount} />}
        {!isMobile && (
          <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, background: `radial-gradient(ellipse 900px 620px at 30% 340px, rgba(${PAGE_TONE},0.97) 0%, rgba(${PAGE_TONE},0.82) 44%, rgba(${PAGE_TONE},0.34) 72%, rgba(${PAGE_TONE},0) 100%)` }} />
        )}
        {!isMobile && (
          <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, background: `linear-gradient(180deg, rgba(${PAGE_TONE},0) 0%, rgba(${PAGE_TONE},0) 30%, rgba(${PAGE_TONE},0.5) 62%, rgba(${PAGE_TONE},0.9) 86%, rgba(${PAGE_TONE},1) 100%)` }} />
        )}
      </div>

      {/* content */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* top bar */}
        <nav style={{ display: 'flex', alignItems: 'center', padding: isMobile ? '20px 22px' : '26px clamp(28px,4vw,72px)' }}>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.3px', color: TEXT_PRIMARY }}>
            Lens<span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: '1.15em', color: GREEN }}>Trybe</span>
          </div>
        </nav>

        <section style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '18px 20px 64px' : 'clamp(32px,4vw,72px) clamp(28px,4.5vw,88px) 96px' }}>
          {/* two columns */}
          <div style={{ display: isMobile ? 'block' : 'flex', alignItems: 'flex-start', gap: 'clamp(24px,4vw,72px)', position: 'relative', zIndex: 2 }}>
            {/* LEFT — copy */}
            <div style={{ flex: '1 1 auto', maxWidth: isMobile ? '100%' : 620, textAlign: isMobile ? 'center' : 'left', margin: isMobile ? '0 auto' : 0 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: isMobile ? 11 : 'clamp(11px,0.85vw,13px)', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a8478', marginBottom: 22 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, boxShadow: '0 0 6px rgba(29,185,84,0.6)', animation: 'ltpulse 2s infinite' }} />
                The waitlist is open · Launching October 1st 2026
              </div>

              <h1 style={{ fontSize: isMobile ? 'clamp(40px,12vw,54px)' : 'clamp(52px,4.6vw,84px)', fontWeight: 600, lineHeight: 1.04, margin: '0 0 22px', letterSpacing: '-0.02em', color: TEXT_PRIMARY }}>
                Connect. Capture.<br />
                <span style={{ fontFamily: SERIF, fontWeight: 400, fontStyle: 'italic', fontSize: '1.16em' }}>Create.</span>
              </h1>

              <p style={{ fontSize: isMobile ? 16 : 'clamp(16px,1.15vw,20px)', color: TEXT_SECONDARY, maxWidth: isMobile ? 460 : 'clamp(440px,34vw,560px)', lineHeight: 1.6, margin: isMobile ? '0 auto' : 0 }}>
                Australia's home for visual creatives opens October 1st. Showcase your work, get booked, and run your whole business in one place. No commissions, ever.
              </p>
            </div>

            {/* RIGHT — liquid glass waitlist card + founding banner under it */}
            <div style={{ flex: isMobile ? '1 1 auto' : '1 1 0', minWidth: 0, width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 36 : 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <GlowBorder radius={24} style={{ width: '100%', maxWidth: 460 }}>
              <div style={{ ...LIQUID_GLASS, padding: isMobile ? 20 : 26, width: '100%' }}>
                {status === 'done' ? (
                  <SuccessView result={result} />
                ) : (
                  <form onSubmit={submit}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: TEXT_SECONDARY, marginBottom: 14, textAlign: 'left' }}>Join the waitlist</div>

                    {/* audience toggle */}
                    <div style={{ display: 'flex', gap: 6, background: 'rgba(20,17,26,0.05)', borderRadius: 12, padding: 4, marginBottom: 14 }}>
                      {[['creative', "I'm a creative"], ['client', "I'm hiring"]].map(([key, label]) => (
                        <button key={key} type="button" className="lt-a" onClick={() => setAudience(key)} style={{
                          flex: 1, padding: '10px 8px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13.5,
                          fontWeight: audience === key ? 700 : 500, color: TEXT_PRIMARY,
                          background: audience === key ? '#fff' : 'transparent',
                          boxShadow: audience === key ? '0 2px 8px -3px rgba(40,30,60,0.25)' : 'none',
                        }}>{label}</button>
                      ))}
                    </div>

                    <input className="lt-in" type="email" placeholder="your@email.com" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ ...LIQUID_FIELD, width: '100%', flex: 'none', padding: '13px 15px', fontSize: 15, marginBottom: 10 }} />

                    {audience === 'creative' && (
                      <div style={{ marginBottom: 10 }}>
                        <LiquidSelect value={creativeType} onChange={setCreativeType} ariaLabel="Creative type" placeholder="What do you do? (optional)"
                          options={[{ value: '', label: 'What do you do? (optional)' }, ...CREATIVE_TYPES.map(t => ({ value: t, label: t }))]} />
                      </div>
                    )}

                    <div style={{ marginBottom: 10 }}>
                      <LiquidSelect value={stateVal} onChange={setStateVal} ariaLabel="State"
                        placeholder={audience === 'creative' ? 'Which state are you in?' : 'Which state are you hiring in?'}
                        options={[{ value: '', label: audience === 'creative' ? 'Which state are you in?' : 'Which state are you hiring in?' }, ...AU_STATES.map(s => ({ value: s, label: s }))]} />
                    </div>

                    {audience === 'creative' && (
                      <input className="lt-in" type="text" placeholder="Referral code (optional)" value={refInput}
                        onChange={(e) => setRefInput(e.target.value.toUpperCase())} aria-label="Referral code"
                        style={{ ...LIQUID_FIELD, width: '100%', flex: 'none', padding: '13px 15px', fontSize: 15, marginBottom: 10, letterSpacing: '0.06em' }} />
                    )}

                    <input ref={hp} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden
                      style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

                    {error && <div style={{ fontSize: 13, color: '#c0392b', margin: '2px 0 10px' }}>{error}</div>}

                    <LiquidPill type="submit" primary disabled={status === 'loading'} style={{ width: '100%', marginTop: 2 }}>
                      {status === 'loading'
                        ? <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(20,17,26,0.25)', borderTopColor: TEXT_PRIMARY, animation: 'ltspin .7s linear infinite' }} />
                        : <>{audience === 'creative' ? 'Claim my spot' : 'Join the list'} <IconArrow /></>}
                    </LiquidPill>

                    <p style={{ fontSize: 11.5, color: TEXT_MUTED, textAlign: 'center', margin: '14px 0 0' }}>No spam. Unsubscribe anytime.</p>
                  </form>
                )}
              </div>
              </GlowBorder>

              {/* founding banner — under the sign-up form */}
              <div style={{ ...GLASS_CARD_GREEN, width: '100%', maxWidth: 460, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderRadius: 14, padding: '13px 16px' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>First {FOUNDING_SPOTS} creatives get 3 months free</span>
                {spotsLeft != null && (
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f7a37', background: 'rgba(29,185,84,0.16)', borderRadius: 100, padding: '5px 12px' }}>
                    {spotsLeft > 0 ? `${spotsLeft} left` : 'Full'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* full-width countdown band — spans from the headline to the form edge */}
          <GlowBorder radius={20} style={{ marginTop: isMobile ? 40 : 52, zIndex: 1 }}>
          <div style={{ ...LIQUID_GLASS, display: 'flex', alignItems: 'stretch', borderRadius: 20, padding: isMobile ? '14px 6px' : '20px 12px' }}>
            {units.map(([label, val], i) => (
              <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: i ? '1px solid rgba(20,17,26,0.08)' : 'none' }}>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', fontSize: isMobile ? 'clamp(28px,8.5vw,40px)' : 'clamp(44px,5.2vw,76px)', lineHeight: 1, color: TEXT_PRIMARY }}>{pad(val)}</div>
                <div style={{ fontSize: isMobile ? 9.5 : 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: TEXT_MUTED, marginTop: isMobile ? 8 : 12, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
          </GlowBorder>
        </section>

        {/* footer */}
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 20px 40px', fontSize: 12.5, color: TEXT_MUTED, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="https://instagram.com/lenstrybe" target="_blank" rel="noopener noreferrer" style={{ color: TEXT_SECONDARY, textDecoration: 'none', fontWeight: 500 }}>Instagram</a>
          <span style={{ opacity: 0.4 }}>·</span>
          <a href="mailto:connect@lenstrybe.com" style={{ color: TEXT_SECONDARY, textDecoration: 'none', fontWeight: 500 }}>connect@lenstrybe.com</a>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>© 2026 LensTrybe</span>
        </div>
      </div>
    </div>
  )
}

function SuccessView({ result }) {
  const founding = result?.foundingSpot
  const isClient = result?.audience === 'client'
  const pos = result?.position

  const heading = founding ? `You're in. Founding creative #${pos}.` : "You're on the list."
  const sub = founding
    ? 'Three months free when we open on October 1st.'
    : isClient
      ? "We'll let you know the moment you can start booking Australian creatives."
      : "You'll be first through the doors on October 1st."

  return (
    <div style={{ textAlign: 'center', padding: '8px 4px 6px' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(29,185,84,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <span style={{ color: GREEN, fontSize: 26, fontWeight: 700 }}>✓</span>
      </div>
      <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: TEXT_PRIMARY }}>{heading}</h2>
      <p style={{ margin: '0 0 14px', fontSize: 14.5, lineHeight: 1.6, color: TEXT_SECONDARY }}>{sub}</p>
      <div style={{ background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.22)', borderRadius: 12, padding: '11px 14px', margin: '0 0 14px' }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: TEXT_SECONDARY }}>
          Keep an eye out for your welcome email. If it's not in your inbox, check your spam or promotions folder and mark us as safe so you don't miss any updates.
        </p>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED }}>
        Follow <a href="https://instagram.com/lenstrybe" target="_blank" rel="noopener noreferrer" style={{ color: GREEN, fontWeight: 600, textDecoration: 'none' }}>@lenstrybe</a> to keep up with our progress.
      </p>
    </div>
  )
}
