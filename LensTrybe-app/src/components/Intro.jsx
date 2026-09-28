import { useCallback, useEffect, useRef, useState } from 'react'

// The intro that plays the first time the site opens in a session (item 9, 28 Sep). The LensTrybe
// mark behaves like a lens: it blinks once, racks focus in and out, the viewfinder locks on, the
// aperture snaps shut, and the page underneath is the photo it just took. About five seconds; a tap, a click or any key skips it. Anyone who asked their system for less motion,
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
    const t = setTimeout(finish, 4750)
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
            <radialGradient id="iGlass" cx="38%" cy="32%" r="80%"><stop offset="0" stopColor="#2a2a36" /><stop offset=".55" stopColor="#111118" /><stop offset="1" stopColor="#0a0a10" /></radialGradient>
            <clipPath id="iClip"><circle cx={C} cy={C} r="118" /></clipPath>
          </defs>
          <foreignObject x="0" y="0" width="412" height="412"><div xmlns="http://www.w3.org/1999/xhtml" className="ihalo" /></foreignObject>
          <circle cx={C} cy={C} r="138" fill="none" stroke="#0c0c13" strokeWidth="42" />
          <circle cx={C} cy={C} r="118" fill="none" stroke="#2b2b38" strokeWidth="2" />
          <g clipPath="url(#iClip)">
            <g className="iglass">
              <circle cx={C} cy={C} r="118" fill="url(#iGlass)" />
              <ellipse className="ihl" cx="170" cy="150" rx="40" ry="26" fill="#fff" opacity=".07" />
            </g>
            {BLADES.map(k => <g key={k} transform={`rotate(${k * 60} ${C} ${C})`}><polygon className="iblade" points="330,206 330,900 1100,900 1100,206" /></g>)}
          </g>
        </svg>
        <span className="ivf a" /><span className="ivf b" /><span className="ivf c" /><span className="ivf d" />
      </div>
    </div>
  )
}
