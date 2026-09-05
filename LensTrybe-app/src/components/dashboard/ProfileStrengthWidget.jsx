import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { FONT, TEXT, MUTED, FAINT, GREEN, Tile, CenterModal } from './widgetKit'
import { isDemoMode, demoProfile, demoPortfolioCount } from '../../lib/demoMode'
import { completenessItems, completenessFromItems, fetchPortfolioCount } from '../../lib/profileCompleteness'

const AMBER = '#f59e0b'
const PINK = '#FF2D78'

// Colour of the ring by how complete the profile is.
function ringColour(pct) {
  if (pct >= 80) return GREEN
  if (pct >= 50) return AMBER
  return PINK
}

// Circular progress ring with the percentage in the centre.
function Ring({ pct, size = 92, stroke = 9, showLabel = true }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c - (Math.min(100, Math.max(0, pct)) / 100) * c
  const col = ringColour(pct)
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--lt-border)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .5s ease, stroke .3s ease' }} />
      </svg>
      {showLabel ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
          <span style={{ fontSize: size * 0.28, fontWeight: 700, color: TEXT, letterSpacing: '-0.02em', lineHeight: 1 }}>{pct}<span style={{ fontSize: size * 0.15, color: MUTED }}>%</span></span>
        </div>
      ) : null}
    </div>
  )
}

const ARROW = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const TICK = (
  <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.2 2.2 4.8-4.8" stroke="#0a0a0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

export default function ProfileStrengthWidget({ userId }) {
  const [profile, setProfile] = useState(null)
  const [portfolioCount, setPortfolioCount] = useState(0)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  async function load() {
    if (!userId) return
    if (isDemoMode()) { setProfile(demoProfile()); setPortfolioCount(demoPortfolioCount); return }
    const { data } = await supabase
      .from('profiles')
      .select('business_name, tagline, bio, phone, website, avatar_url, city, state, skill_types, specialties, instagram_url, tiktok_url, linkedin_url, facebook_url, twitter_url')
      .eq('id', userId)
      .single()
    setProfile(data ?? {})
    setPortfolioCount(await fetchPortfolioCount(userId))
  }
  useEffect(() => { void load() }, [userId])

  // Reload when the tab is refocused, so items cross off after editing the profile.
  useEffect(() => {
    const onFocus = () => { void load() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [userId])

  // Canonical checklist: the single source of truth in lib/profileCompleteness.
  const items = useMemo(() => completenessItems(profile || {}, portfolioCount), [profile, portfolioCount])
  const { doneCount, pct, remaining } = completenessFromItems(items)

  function go(tab) { setOpen(false); navigate(`/dashboard/profile/edit-profile?tab=${tab}`) }

  return (
    <>
      <Tile label="Profile" onClick={() => setOpen(true)}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Ring pct={pct} size={84} stroke={8} />
          <span style={{ fontSize: 11.5, color: MUTED, fontFamily: FONT }}>
            {remaining === 0 ? 'Complete' : `${remaining} to go`}
          </span>
        </div>
      </Tile>

      {open ? (
        <CenterModal title="Profile strength" subtitle={pct === 100 ? 'Your profile is complete' : 'Finish these to get seen by more clients'} onClose={() => setOpen(false)} width={520}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '4px 2px 18px' }}>
            <Ring pct={pct} size={104} stroke={10} />
            <div style={{ fontFamily: FONT }}>
              <div style={{ fontSize: 15, color: TEXT, fontWeight: 600 }}>{doneCount} of {items.length} done</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 4, maxWidth: 260 }}>
                {pct === 100
                  ? 'Nice work. A complete profile ranks higher and converts more enquiries.'
                  : 'A stronger profile appears higher in search and earns more trust from clients.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={() => go(it.tab)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                  background: it.done ? 'rgba(29,185,84,0.06)' : 'var(--lt-surface)',
                  border: `1px solid ${it.done ? 'rgba(29,185,84,0.22)' : 'var(--lt-border)'}`,
                  borderRadius: 12, padding: '11px 13px', cursor: 'pointer', fontFamily: FONT,
                }}
              >
                <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: it.done ? `1px solid ${GREEN}` : '1px solid var(--lt-input-border)', background: it.done ? GREEN : 'transparent' }}>
                  {it.done ? TICK : null}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, color: it.done ? MUTED : TEXT, textDecoration: it.done ? 'line-through' : 'none' }}>{it.label}</span>
                  {!it.done ? <span style={{ display: 'block', fontSize: 11.5, color: FAINT, marginTop: 2 }}>{it.hint}</span> : null}
                </span>
                {!it.done ? <span style={{ color: MUTED, display: 'flex' }}>{ARROW}</span> : null}
              </button>
            ))}
          </div>
        </CenterModal>
      ) : null}
    </>
  )
}
