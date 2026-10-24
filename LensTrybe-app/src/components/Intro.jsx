import { useCallback, useEffect, useRef, useState } from 'react'
import { runIntro } from '../lib/intro'

// The intro that plays the first time the site opens in a session: the lens wakes up (24 Oct 2026).
// The living lens rolls in and lights the name, straightens the crooked T, settles in as the logo,
// takes the name in as light and flies into the screen; the page underneath is where it lands.
// About six seconds; a tap, a click or any key skips it. Anyone who asked their system for less
// motion, who has no WebGL, or who has seen it this session, goes straight to the page. The engine
// lives in src/lib/intro.js so this file is only the overlay and its lifecycle.
const KEY = 'lt-intro'
const seen = () => { try { return sessionStorage.getItem(KEY) === '1' } catch { return false } }
const mark = () => { try { sessionStorage.setItem(KEY, '1') } catch { /* private mode */ } }
const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Intro() {
  const [on, setOn] = useState(() => !seen() && !still())
  const [out, setOut] = useState(false)
  const stage = useRef(null), glc = useRef(null), fxc = useRef(null), tag = useRef(null), scan = useRef(null), flash = useRef(null)
  const engine = useRef(null)
  const finish = useCallback(() => {
    setOut(true)
    setTimeout(() => { setOn(false); document.documentElement.classList.remove('introing') }, 700)
  }, [])
  useEffect(() => {
    if (!on) return
    mark()
    document.documentElement.classList.add('introing')
    const e = runIntro({ stage: stage.current, gl: glc.current, fx: fxc.current, tag: tag.current, scan: scan.current, flash: flash.current }, { onCut: finish })
    engine.current = e
    const key = ev => { if (!ev.metaKey && !ev.ctrlKey && !ev.altKey) e.skip() }
    addEventListener('keydown', key)
    return () => { removeEventListener('keydown', key); e.destroy(); document.documentElement.classList.remove('introing') }
  }, [on, finish])
  if (!on) return null
  return (
    <div className={'intro' + (out ? ' out' : '')} ref={stage} onClick={() => engine.current?.skip()} role="presentation" aria-hidden="true">
      <canvas className="igl" ref={glc} />
      <div className="iscan" ref={scan} />
      <canvas className="ifx" ref={fxc} />
      <p className="itag" ref={tag}>Connect. Capture. <em>Create.</em></p>
      <div className="ilb t" /><div className="ilb b" />
      <div className="iflash" ref={flash} />
    </div>
  )
}
