import { useCallback, useEffect, useRef, useState } from 'react'

// The intro that plays the first time the site opens in a session (item 9, 28 Sep). The same
// surface as the hero: brand black, the lens ring in mint, rose and lilac, the three words rising
// the way the headline does, then the wordmark, then it clears to the page. About four and a half
// seconds; a tap, a click or any key skips it. Anyone who asked their system for less motion, or
// who has seen it this session, goes straight to the page.
const KEY = 'lt-intro'
const seen = () => { try { return sessionStorage.getItem(KEY) === '1' } catch { return false } }
const mark = () => { try { sessionStorage.setItem(KEY, '1') } catch { /* private mode */ } }
const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Intro() {
  const [on, setOn] = useState(() => !seen() && !still())
  const [out, setOut] = useState(false)
  const done = useRef(false)
  const finish = useCallback(() => {
    if (done.current) return
    done.current = true
    setOut(true)
    setTimeout(() => { setOn(false); document.documentElement.classList.remove('introing') }, 700)
  }, [])
  useEffect(() => {
    if (!on) return
    mark()
    document.documentElement.classList.add('introing')
    const t = setTimeout(finish, 4400)
    const key = e => { if (!e.metaKey && !e.ctrlKey && !e.altKey) finish() }
    addEventListener('keydown', key)
    return () => { clearTimeout(t); removeEventListener('keydown', key); document.documentElement.classList.remove('introing') }
  }, [on, finish])
  if (!on) return null
  return (
    <div className={'intro' + (out ? ' out' : '')} onClick={finish} role="presentation" aria-hidden="true">
      <div className="iring"><i /><b /></div>
      <div className="iwords">
        <span className="ln"><span>Connect.</span></span>
        <span className="ln"><span>Capture.</span></span>
        <span className="ln"><span><em>Create.</em></span></span>
      </div>
      <img className="imark" src="/logo-white.svg" alt="" />
    </div>
  )
}
