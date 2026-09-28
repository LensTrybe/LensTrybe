import { useCallback, useEffect, useRef, useState } from 'react'

// The intro that plays the first time the site opens in a session (item 9, 28 Sep). The LensTrybe
// mark behaves like a lens: it blinks once, racks focus in and out, the viewfinder locks on, the
// aperture snaps shut, and the page underneath is the photo it just took. About five seconds; a tap, a click or any key skips it. Anyone who asked their system for less motion,
// or who has seen it this session, goes straight to the page.
const KEY = 'lt-intro'
const seen = () => { try { return sessionStorage.getItem(KEY) === '1' } catch { return false } }
const mark = () => { try { sessionStorage.setItem(KEY, '1') } catch { /* private mode */ } }
const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const BLADES = [0, 1, 2, 3, 4, 5]

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
        <div className="imark">
          <div className="ihalo" />
          <div className="iband" />
          <div className="iglass"><i className="ihl" />
            {BLADES.map(k => <div key={k} className="ibl" style={{ transform: `rotate(${k * 60}deg)` }}><div className="iblade" /></div>)}
          </div>
        </div>
        <span className="ivf a" /><span className="ivf b" /><span className="ivf c" /><span className="ivf d" />
      </div>
    </div>
  )
}
