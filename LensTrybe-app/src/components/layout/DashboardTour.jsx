import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

// First-run dashboard walkthrough for new creatives. Shows once (on the dashboard
// home) until it is finished or skipped, and can be replayed any time by
// dispatching the window event 'lt:start-tour' (Settings has a button for it).
// Each step can spotlight an element found by a CSS selector; if the element isn't
// on screen (for example on mobile, where the menu is a drawer) the step shows as
// a centred card instead.

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'
const PAD = 8

const STEPS = [
  {
    id: 'welcome',
    title: (name) => `Welcome to LensTrybe${name ? `, ${name}` : ''}`,
    body: "Here's a quick look around your dashboard. It takes about a minute, and you can skip it any time.",
  },
  {
    id: 'menu',
    target: '[data-tour="sidebar"]',
    mobileTarget: '.hamburger-btn',
    title: 'Your menu',
    body: 'Everything lives here. Hover over the menu to expand it, then click a section to open it. Tools that need a paid plan show a small badge with the plan that unlocks them.',
    mobileBody: 'Everything lives in the menu. Tap the menu button at the top left to open it. Tools that need a paid plan show a small badge with the plan that unlocks them.',
  },
  {
    id: 'dashboard',
    target: '[data-tour="nav-Dashboard"]',
    title: 'Your home base',
    body: 'Your dashboard shows enquiries, bookings, profile strength and how often you appear in search, all at a glance.',
  },
  {
    id: 'account',
    target: '[data-tour="nav-Account"]',
    title: 'Start with your profile',
    body: 'Open Account > Edit Profile to add your photos, services and pricing. A complete profile is what gets you found by clients. View Profile shows exactly what they see.',
  },
  {
    id: 'clients',
    target: '[data-tour="nav-Clients"]',
    title: 'Clients',
    body: 'Enquiries land in Messages. Meetings, Contacts and your CRM keep every client and conversation in one place.',
  },
  {
    id: 'finance',
    target: '[data-tour="nav-Finance"]',
    title: 'Get paid, commission free',
    body: 'Send branded quotes, invoices and contracts with e-signatures. Clients pay you directly, and LensTrybe never takes a cut.',
  },
  {
    id: 'portfolio',
    target: '[data-tour="nav-Portfolio"]',
    title: 'Portfolio and delivery',
    body: 'Set up your Brand Kit and your own portfolio website, and use Deliver to send clients a private, branded gallery of their finished work.',
  },
  {
    id: 'work',
    target: '[data-tour="nav-Work"]',
    title: 'Bookings and jobs',
    body: 'Manage bookings, set your availability, and browse the Job Board where clients post work.',
  },
  {
    id: 'business',
    target: '[data-tour="nav-Business"]',
    title: 'Grow your business',
    body: 'Collect reviews, buy and sell gear in the Marketplace, team up with other creatives, and add team members on Elite.',
  },
  {
    id: 'lumi',
    target: '.lumi-launch',
    mobileTarget: '.lumi-launch',
    title: 'Meet Lumi',
    body: 'Lumi is your AI assistant. Ask it to help write a quote, a caption or a client email, or to work out your pricing.',
  },
  {
    id: 'bell',
    target: '.ltn-bell',
    mobileTarget: '.ltn-bell',
    title: 'Notifications',
    body: 'New messages, bookings, signed contracts and paid invoices show up here.',
  },
  {
    id: 'note',
    target: '[aria-label="Quick note"]',
    mobileTarget: '[aria-label="Quick note"]',
    title: 'Quick notes',
    body: 'Jot down a note from anywhere in the app. Find them all later in Notes.',
  },
  {
    id: 'done',
    title: () => "You're all set",
    body: 'Your next step is finishing your profile so clients can find you. You can replay this tour any time from Settings.',
    finish: true,
  },
]

function storageKey(userId) { return `lt_tour_done_${userId}` }
function readLocalDone(userId) { try { return localStorage.getItem(storageKey(userId)) === '1' } catch { return false } }
function writeLocalDone(userId) { try { localStorage.setItem(storageKey(userId), '1') } catch { /* ignore */ } }

function measure(selector) {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return null
  if (r.right < 0 || r.bottom < 0 || r.left > window.innerWidth || r.top > window.innerHeight) return null
  // Items inside the menu: place the card beside the whole menu, not on top of it.
  const menu = el.closest('[data-tour="sidebar"]')
  const anchorRight = menu && menu !== el ? menu.getBoundingClientRect().right : null
  return { top: r.top, left: r.left, width: r.width, height: r.height, anchorRight }
}

export default function DashboardTour() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280)
  const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight : 800)
  const cardRef = useRef(null)
  const autoChecked = useRef(false)

  const step = STEPS[index]
  const firstName = useMemo(() => {
    const full = String(profile?.full_name || '').trim()
    if (full) return full.split(/\s+/)[0]
    return String(profile?.business_name || '').trim()
  }, [profile?.full_name, profile?.business_name])

  const setSidebarOpen = (v) => window.dispatchEvent(new CustomEvent('lt:tour-sidebar', { detail: v }))

  const start = useCallback(() => {
    setIndex(0)
    setOpen(true)
  }, [])

  // Show automatically once for creatives who haven't seen it, on the dashboard home.
  useEffect(() => {
    if (autoChecked.current || !user?.id || !profile) return undefined
    if (pathname !== '/dashboard' && pathname !== '/dashboard/') return undefined
    if (profile.dashboard_tour_done_at || readLocalDone(user.id) || profile.pending_deletion) { autoChecked.current = true; return undefined }
    const t = setTimeout(() => { autoChecked.current = true; start() }, 700)
    return () => clearTimeout(t)
  }, [user?.id, profile, pathname, start])

  // Replay on request.
  useEffect(() => {
    function onStart() {
      if (pathname !== '/dashboard') navigate('/dashboard')
      setTimeout(start, 250)
    }
    window.addEventListener('lt:start-tour', onStart)
    return () => window.removeEventListener('lt:start-tour', onStart)
  }, [pathname, navigate, start])

  // Keep the menu expanded while the tour is on screen.
  useEffect(() => {
    setSidebarOpen(open)
    return () => setSidebarOpen(false)
  }, [open])

  // Track the highlighted element (it can move as the menu expands or the window resizes).
  useEffect(() => {
    if (!open) return undefined
    let raf = 0
    let last = ''
    const tick = () => {
      const r = measure(window.innerWidth < 768 ? step?.mobileTarget : step?.target)
      const key = r ? `${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}` : 'none'
      if (key !== last) { last = key; setRect(r) }
      raf = requestAnimationFrame(tick)
    }
    tick()
    function onResize() { setVw(window.innerWidth); setVh(window.innerHeight) }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [open, step?.target, step?.mobileTarget])

  const markDone = useCallback(async () => {
    if (!user?.id) return
    writeLocalDone(user.id)
    try {
      await supabase.from('profiles').update({ dashboard_tour_done_at: new Date().toISOString() }).eq('id', user.id)
    } catch { /* the local flag still stops it showing again on this device */ }
  }, [user?.id])

  const close = useCallback(() => {
    setOpen(false)
    markDone()
  }, [markDone])

  const next = useCallback(() => {
    if (index >= STEPS.length - 1) { close(); return }
    setIndex((i) => i + 1)
  }, [index, close])
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    if (!open) return undefined
    function onKey(e) {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft') back()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close, next, back])

  useEffect(() => { if (open) cardRef.current?.focus() }, [open, index])

  if (!open || !step) return null

  const mobile = vw < 768
  const spot = rect || null
  const cardW = Math.min(360, vw - 32)

  // Place the card beside the highlighted element, or centred when there isn't one.
  let cardStyle
  if (spot && !mobile) {
    const gap = 18
    const estH = 230
    let left = (spot.anchorRight ?? spot.left + spot.width + PAD) + gap
    if (left + cardW > vw - 16) left = spot.left - PAD - gap - cardW
    if (left < 16) left = Math.min(Math.max(16, spot.left), vw - cardW - 16)
    let top = spot.top + spot.height / 2 - estH / 2
    top = Math.min(Math.max(16, top), vh - estH - 16)
    cardStyle = { position: 'fixed', left, top, width: cardW }
  } else if (mobile) {
    cardStyle = { position: 'fixed', left: 16, right: 16, bottom: 16, width: 'auto' }
  } else {
    cardStyle = { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: Math.min(420, vw - 32) }
  }

  const title = typeof step.title === 'function' ? step.title(firstName) : step.title
  const isFirst = index === 0
  const total = STEPS.length

  return (
    <div className="lt-tour" role="dialog" aria-modal="true" aria-labelledby="lt-tour-title">
      <style>{`
        .lt-tour-card { background: var(--lt-modal-bg, #14141c); border: var(--lt-modal-border, 1px solid rgba(255,255,255,0.14)); box-shadow: var(--lt-modal-shadow, 0 30px 80px -30px rgba(0,0,0,0.7)); backdrop-filter: var(--lt-modal-blur, blur(24px)); -webkit-backdrop-filter: var(--lt-modal-blur, blur(24px)); border-radius: 20px; padding: 22px 22px 18px; color: var(--lt-text, #fff); font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; outline: none; box-sizing: border-box; animation: ltTourIn .22s ease; }
        .lt-tour-btn { display: inline-flex; align-items: center; justify-content: center; padding: 9px 16px; border-radius: 11px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: 1px solid transparent; min-height: 40px; }
        .lt-tour-primary { background: ${GREEN}; color: ${GREEN_TEXT}; }
        .lt-tour-ghost { background: var(--lt-surface, rgba(255,255,255,0.06)); color: var(--lt-text, #fff); border-color: var(--lt-border, rgba(255,255,255,0.12)); }
        .lt-tour-skip { background: none; border: none; color: var(--lt-muted, #9a9aa8); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; padding: 6px 2px; }
        .lt-tour-skip:hover { color: var(--lt-text, #fff); }
        .lt-tour-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--lt-border, rgba(255,255,255,0.2)); transition: width .2s ease, background .2s ease; }
        .lt-tour-dot.on { width: 18px; background: ${GREEN}; }
        .lt-tour-spot { position: fixed; border-radius: 16px; pointer-events: none; transition: top .22s ease, left .22s ease, width .22s ease, height .22s ease; box-shadow: 0 0 0 9999px rgba(6,6,12,0.62), 0 0 0 2px rgba(255,255,255,0.9), 0 0 24px 4px rgba(255,255,255,0.45); }
        @keyframes ltTourIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) { .lt-tour-card { animation: none } .lt-tour-spot { transition: none } }
      `}</style>

      {/* Blocks clicks on the page behind the tour. */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: spot ? 'transparent' : 'rgba(6,6,12,0.62)', backdropFilter: spot ? 'none' : 'blur(2px)' }} />
      {spot && (
        <div className="lt-tour-spot" style={{ zIndex: 5001, top: spot.top - PAD, left: spot.left - PAD, width: spot.width + PAD * 2, height: spot.height + PAD * 2 }} />
      )}

      <div ref={cardRef} tabIndex={-1} className="lt-tour-card" style={{ ...cardStyle, zIndex: 5002 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: GREEN }}>
            {isFirst ? 'Welcome' : step.finish ? 'Tour complete' : `Step ${index} of ${total - 2}`}
          </span>
          {!step.finish && <button type="button" className="lt-tour-skip" onClick={close}>Skip tour</button>}
        </div>

        <h2 id="lt-tour-title" style={{ margin: '0 0 8px', fontSize: isFirst || step.finish ? 21 : 17, fontWeight: 800, lineHeight: 1.25, color: 'var(--lt-text, #fff)' }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--lt-muted, #b4b4c2)' }}>{mobile && step.mobileBody ? step.mobileBody : step.body}</p>

        {!isFirst && !step.finish && (
          <div style={{ display: 'flex', gap: 5, marginTop: 16 }} aria-hidden>
            {STEPS.slice(1, -1).map((s, i) => <span key={s.id} className={`lt-tour-dot${i + 1 === index ? ' on' : ''}`} />)}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          {isFirst && (
            <>
              <button type="button" className="lt-tour-btn lt-tour-ghost" onClick={close}>Skip for now</button>
              <button type="button" className="lt-tour-btn lt-tour-primary" onClick={next}>Show me around</button>
            </>
          )}
          {!isFirst && !step.finish && (
            <>
              <button type="button" className="lt-tour-btn lt-tour-ghost" onClick={back}>Back</button>
              <button type="button" className="lt-tour-btn lt-tour-primary" onClick={next}>{index === total - 2 ? 'Finish' : 'Next'}</button>
            </>
          )}
          {step.finish && (
            <>
              <button type="button" className="lt-tour-btn lt-tour-ghost" onClick={close}>Explore on my own</button>
              <button type="button" className="lt-tour-btn lt-tour-primary" onClick={() => { close(); navigate('/dashboard/profile/edit-profile') }}>Finish my profile</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
