import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useStore } from '../../lib/store'
import { LIVE } from '../../lib/mode'
import { supabase } from '../../backend/supabaseClient'
import { useAuth } from '../../backend/AuthContext'

// The first-login tour (item 17, Michael 29 Sep: a spotlight tour, once, on first login). The page
// dims, a soft ring sits on one part of the workspace at a time and a small card says what it is.
// Next, Back, Skip; Esc skips, arrow keys step. It plays once per account: done is kept on the
// account itself (user_metadata.tour_done) so a new phone doesn't replay it, with a local copy for
// the demo and for speed. Settings has "Replay the tour".
//
// Each step lists places to point at, first visible one wins: the sidebar on laptops, the tab bar
// and More on phones. A step with nothing visible is centred instead of pointing at nothing.
const STEPS = [
  { t: 'Welcome to your workspace', b: 'This is where you run the business side of every shoot. A one-minute look around, then it\'s all yours.' },
  { at: ['.rail a[href="/app/today"]', '.tabbar button:nth-child(1)'], t: 'Today', b: 'Your day at a glance: shoots, money owed and anything waiting on you. Start here each morning.' },
  { at: ['.rail a[href="/app/jobs"]', '.tabbar button:last-child'], t: 'Job board', b: 'Clients post jobs here. Reply with a price and a thread opens with them. Until 31 December every plan can reply.', phone: 'Find the Job board and every other page under More.' },
  { at: ['.rail a[href="/app/threads"]', '.tabbar button:nth-child(2)'], t: 'Threads', b: 'Every client conversation, with its quotes, contracts, invoices and dates in one place.' },
  { at: ['.rail a[href="/app/bookings"]', '.tabbar button:nth-child(3)'], t: 'Calendar', b: 'Bookings, pencilled dates and days off. Drag a booking to move it; LensTrybe asks before it tells the client.' },
  { at: ['.rail .gp:has(a[href="/app/money"]) .gh', '.tabbar button:nth-child(4)'], t: 'Finance', b: 'Quotes, invoices, contracts, expenses and tax, all tied to the client they belong to.' },
  { at: ['.setup'], optional: true, t: 'Your profile checklist', b: 'Your profile is your website. Work through this list and it goes live in Find a creative.' },
  { at: ['.top .cmd'], t: 'Ask or do anything', b: 'Type what you need, like "new invoice" or "block 3 Dec", and it happens. Anything else goes to Lumi, who can look up your own numbers.' },
  { at: ['.rail .me', '.tabbar button:last-child'], t: 'You', b: 'Switch light and dark, log out, and replay this tour any time from Settings.' },
  { t: 'That\'s the tour', b: 'Finish your profile first: clients can find you once it has a photo, a line about you and one kind of work.', last: true },
]
const KEY = 'lt-tour-done'
const localDone = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
const setLocalDone = v => { try { v ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY) } catch { /* private mode */ } }
const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' }
const find = at => { for (const sel of at || []) { let el = null; try { el = document.querySelector(sel) } catch { el = null } if (visible(el)) return el } return null }

// Settings calls this to play it again.
export function replayTour() { setLocalDone(false); dispatchEvent(new Event('lt-tour')) }

export default function Tour() {
  const { s } = useStore(); const auth = useAuth(); const nav = useNavigate(); const { pathname } = useLocation()
  const [on, setOn] = useState(false), [i, setI] = useState(0), [box, setBox] = useState(null), [steps, setSteps] = useState(STEPS)
  // Optional steps (the profile checklist) drop out when that part isn't on the page.
  const start = () => { setSteps(STEPS.filter(st => !st.optional || find(st.at))); setI(0); setOn(true) }
  const onToday = pathname === '/app' || pathname === '/app/today'

  // Start once, on Today, the first time this account opens the workspace.
  useEffect(() => {
    if (on || !onToday) return
    const seen = localDone() || (LIVE && auth.user?.user_metadata?.tour_done)
    if (seen || (LIVE && !auth.user)) return
    const t = setTimeout(start, 900)
    return () => clearTimeout(t)
  }, [onToday, auth.user, on]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const go = () => { if (!onToday) nav('/app/today'); setTimeout(start, onToday ? 50 : 900) }
    addEventListener('lt-tour', go); return () => removeEventListener('lt-tour', go)
  }, [onToday, nav]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    setOn(false); setLocalDone(true)
    if (LIVE && auth.user && !auth.user.user_metadata?.tour_done) supabase.auth.updateUser({ data: { tour_done: true } }).catch(() => {})
  }, [auth.user])
  const step = steps[i] || steps[0]

  // Measure the thing we're pointing at, and keep measuring through scrolls and resizes.
  useLayoutEffect(() => {
    if (!on) return
    const measure = () => { const el = find(step.at); if (!el) return setBox(null); const r = el.getBoundingClientRect(); setBox({ x: r.left, y: r.top, w: r.width, h: r.height }) }
    const el = find(step.at); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    measure(); const t = setTimeout(measure, 350)
    addEventListener('resize', measure); addEventListener('scroll', measure, true)
    return () => { clearTimeout(t); removeEventListener('resize', measure); removeEventListener('scroll', measure, true) }
  }, [on, i, step])
  useEffect(() => {
    if (!on) return
    const k = e => { if (e.key === 'Escape') finish(); else if (e.key === 'ArrowRight') setI(n => Math.min(steps.length - 1, n + 1)); else if (e.key === 'ArrowLeft') setI(n => Math.max(0, n - 1)) }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [on, finish, steps.length])

  if (!on) return null
  const W = typeof innerWidth === 'number' ? innerWidth : 1200, H = typeof innerHeight === 'number' ? innerHeight : 800
  const phone = W <= 900, pad = 6
  const hole = box && { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 }
  // Card placement: beside the target on wide screens, above or below it on phones, centred when
  // there is nothing to point at.
  const cw = Math.min(340, W - 32)
  let pos
  if (!hole) pos = { left: (W - cw) / 2, top: Math.max(24, H / 2 - 120) }
  else if (!phone && hole.x + hole.w + 16 + cw < W - 16) pos = { left: hole.x + hole.w + 16, top: Math.min(Math.max(16, hole.y - 8), H - 230) }
  else if (hole.y > H / 2) pos = { left: Math.min(Math.max(16, hole.x + hole.w / 2 - cw / 2), W - cw - 16), bottom: H - hole.y + 14 }
  else pos = { left: Math.min(Math.max(16, hole.x + hole.w / 2 - cw / 2), W - cw - 16), top: hole.y + hole.h + 14 }
  const name = (s.profile?.n || '').split(' ')[0]
  const body = phone && step.phone ? step.phone + ' ' + step.b : step.b
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-t">
      <div className="tour-dim" onClick={e => e.stopPropagation()} style={hole ? { clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 ${hole.y}px,${hole.x}px ${hole.y}px,${hole.x}px ${hole.y + hole.h}px,${hole.x + hole.w}px ${hole.y + hole.h}px,${hole.x + hole.w}px ${hole.y}px,0 ${hole.y}px)` } : undefined} />
      {hole && <div className="tour-ring" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />}
      <div className="tour-card" style={{ ...pos, width: cw }} key={i}>
        <small>{i + 1} of {steps.length}</small>
        <h3 id="tour-t">{i === 0 && name ? 'Welcome, ' + name : step.t}</h3>
        <p>{i === 0 && name ? step.b.replace('This is where', 'Your workspace is where') : body}</p>
        <div className="tour-f">
          {!step.last && <button type="button" className="skip" onClick={finish}>Skip tour</button>}
          <span />
          {i > 0 && <button type="button" className="btn g sm" onClick={() => setI(n => n - 1)}>Back</button>}
          {step.last ? <button type="button" className="btn w sm" onClick={() => { finish(); nav('/app/profile') }}>Finish my profile <Icon name="arrow" size={13} /></button>
            : <button type="button" className="btn w sm" onClick={() => setI(n => n + 1)} autoFocus>{i === 0 ? 'Show me' : 'Next'} <Icon name="arrow" size={13} /></button>}
        </div>
        {step.last && <button type="button" className="skip end" onClick={finish}>I'll look around first</button>}
      </div>
    </div>
  )
}
