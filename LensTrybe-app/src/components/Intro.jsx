import { useCallback, useEffect, useRef, useState } from 'react'

// The intro that plays the first time the site opens in a session (item 9, 28 Sep). The LensTrybe
// mark behaves like a lens: it blinks once, racks focus in and out, the viewfinder locks on, the
// aperture snaps shut, the flash fires, and the page underneath is the photo it just took. About
// four seconds; a tap, a click or any key skips it. Anyone who asked their system for less motion,
// or who has seen it this session, goes straight to the page.
const KEY = 'lt-intro'
const seen = () => { try { return sessionStorage.getItem(KEY) === '1' } catch { return false } }
const mark = () => { try { sessionStorage.setItem(KEY, '1') } catch { /* private mode */ } }
const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const C = 206, BLADES = [0, 1, 2, 3, 4, 5]

export default function Intro() {
  const [on, setOn] = useState(() => !seen() && !still())
  const [out, setOut] = useState(false)
  const done = useRef(false)
  const finish = useCallback(() => {
    if (done.current) return
    done.current = true
    setOut(true)
    setTimeout(() => { setOn(false); document.documentElement.classList.remove('introing') }, 650)
  }, [])
  useEffect(() => {
    if (!on) return
    mark()
    document.documentElement.classList.add('introing')
    const t = setTimeout(finish, 3550)
    const key = e => { if (!e.metaKey && !e.ctrlKey && !e.altKey) finish() }
    addEventListener('keydown', key)
    return () => { clearTimeout(t); removeEventListener('keydown', key); document.documentElement.classList.remove('introing') }
  }, [on, finish])
  if (!on) return null
  return (
    <div className={'intro' + (out ? ' out' : '')} onClick={finish} role="presentation" aria-hidden="true">
      <div className="ilens">
        <svg viewBox="0 0 412 412" className="imark">
          <defs>
            <linearGradient id="iRing" x1="-64" y1="-92" x2="476" y2="504" gradientUnits="userSpaceOnUse"><stop stopColor="#9AC4C5" /><stop offset=".48" stopColor="#D996BA" /><stop offset="1" stopColor="#C6A5E5" /></linearGradient>
            <radialGradient id="iGlass" cx="37%" cy="31%" r="78%"><stop offset="0" stopColor="#FFFDF4" /><stop offset=".36" stopColor="#C8EBDE" /><stop offset=".72" stopColor="#F5B0CD" /><stop offset="1" stopColor="#C9ACE8" /></radialGradient>
            <clipPath id="iClip"><circle cx={C} cy={C} r="132" /></clipPath>
          </defs>
          <circle className="ibody" cx={C} cy={C} r="206" fill="#2A2C3A" />
          <circle className="iring" cx={C} cy={C} r="181" fill="none" stroke="url(#iRing)" strokeWidth="31" />
          <g clipPath="url(#iClip)">
            <g className="iglass">
              <circle cx={C} cy={C} r="132" fill="url(#iGlass)" />
              <ellipse className="ihl" cx="160" cy="151" rx="54" ry="37" fill="#fff" opacity=".31" />
            </g>
            <rect className="ilid top" x="60" y="-72" width="292" height="146" fill="#2A2C3A" />
            <rect className="ilid bot" x="60" y="338" width="292" height="146" fill="#2A2C3A" />
            {BLADES.map(k => <g key={k} transform={`rotate(${k * 60} ${C} ${C})`}><polygon className="iblade" points="346,206 346,900 1100,900 1100,206" /></g>)}
          </g>
          <circle cx={C} cy={C} r="132" fill="none" stroke="#DBE6E1" strokeOpacity=".82" strokeWidth="9" />
        </svg>
        <span className="ivf a" /><span className="ivf b" /><span className="ivf c" /><span className="ivf d" />
      </div>
      <div className="iflash" />
    </div>
  )
}
