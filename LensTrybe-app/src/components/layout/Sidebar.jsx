import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import { supabase } from '../../lib/supabaseClient'
import BrandLogo from '../ui/BrandLogo'
import NavIcon from './navIcons'

const TEXT = '#eef2fb'
const ICON = '#c2cde3'
const MUTED = '#8a97b4'
const GREEN = '#34e39a'
const PINK = '#ff5c93'
const FONT = "'Inter', sans-serif"
const SERIF = "'Instrument Serif', Georgia, serif"

const RAIL = 64
const OPEN_W = 236
const MARGIN = 14
const FLY_GAP = 10
const FLY_W = 230
const SPACER = MARGIN + RAIL + 14

// Dark liquid glass (light content sits on it, aurora glows through).
const GLASS = {
  background: 'linear-gradient(160deg, rgba(26,32,54,0.62) 0%, rgba(14,18,36,0.44) 100%)',
  backdropFilter: 'blur(38px) saturate(185%)',
  WebkitBackdropFilter: 'blur(38px) saturate(185%)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 34px 80px -26px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.16), inset 0 -2px 10px rgba(0,0,0,0.25)',
}

function sheen(radius) {
  return (
    <div aria-hidden style={{
      position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
      background: 'linear-gradient(150deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.03) 26%, rgba(255,255,255,0) 52%)',
    }} />
  )
}

const TOP = [
  { label: 'Dashboard', path: '/dashboard', icon: 'grid' },
  { label: 'Find a Creative', path: '/creatives', icon: 'search' },
]

const BASE_SECTIONS = [
  { label: 'Clients', icon: 'message', items: [
    { label: 'Messages', path: '/dashboard/clients/messages', icon: 'message' },
    { label: 'CRM', path: '/dashboard/clients/crm', icon: 'contact', feature: 'crm' },
  ] },
  { label: 'Finance', icon: 'receipt', items: [
    { label: 'Invoicing', path: '/dashboard/finance/invoicing', icon: 'dollar', feature: 'invoicing' },
    { label: 'Quotes', path: '/dashboard/finance/quotes', icon: 'file', feature: 'invoicing' },
    { label: 'Contracts', path: '/dashboard/finance/contracts', icon: 'fileCheck', feature: 'contracts' },
  ] },
  { label: 'Portfolio', icon: 'image', items: [
    { label: 'Brand Kit', path: '/dashboard/portfolio-design/brand-kit', icon: 'palette', feature: 'brandKit' },
    { label: 'Portfolio Website', path: '/dashboard/portfolio-design/portfolio-website', icon: 'globe' },
    { label: 'Deliver', path: '/dashboard/portfolio-design/deliver', icon: 'upload', feature: 'deliver' },
  ] },
  { label: 'Business', icon: 'briefcase', items: [
    { label: 'Reviews', path: '/dashboard/business/reviews', icon: 'star' },
    { label: 'Marketplace', path: '/dashboard/business/marketplace', icon: 'bag' },
    { label: 'Collaborate', path: '/dashboard/collaborate', icon: 'users' },
    { label: 'Team', path: '/dashboard/business/team', icon: 'users', feature: 'team' },
    { label: 'Lumi AI', path: '/dashboard/lumi', icon: 'sparkle' },
  ] },
  { label: 'Work', icon: 'calendar', items: [
    { label: 'Bookings', path: '/dashboard/my-work/my-bookings', icon: 'calendar' },
    { label: 'Availability', path: '/dashboard/my-work/availability', icon: 'clock' },
    { label: 'Job Board', path: '/dashboard/my-work/jobs', icon: 'briefcase' },
  ] },
  { label: 'Account', icon: 'user', items: [
    { label: 'Edit Profile', path: '/dashboard/profile/edit-profile', icon: 'edit' },
    { label: 'View Profile', path: '/dashboard/profile/view-profile', icon: 'eye' },
    { label: 'Referrals', path: '/dashboard/referrals', icon: 'gift' },
    { label: 'Settings', path: '/dashboard/settings', icon: 'settings' },
  ] },
]

export default function Sidebar({ isMobile = false, mobileOpen = false, onCloseMobile }) {
  const { profile, user } = useAuth()
  const { hasFeature, tier } = useSubscription()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [hover, setHover] = useState(false)
  const [selected, setSelected] = useState(null)
  const expanded = isMobile || hover

  const isAdmin = Boolean(profile && (profile.is_admin === true || profile.is_admin === 'true' || profile.is_admin === 1 || profile.is_admin === '1'))

  const sections = useMemo(() => {
    if (!isAdmin) return BASE_SECTIONS
    return BASE_SECTIONS.map((s) => s.label === 'Account'
      ? { ...s, items: [...s.items, { label: 'Admin', path: '/dashboard/admin', icon: 'shield' }] }
      : s)
  }, [isAdmin])

  function itemActive(path) {
    if (path === '/dashboard') return pathname === '/dashboard'
    return pathname === path || pathname.startsWith(path + '/')
  }

  const activeSection = useMemo(() => {
    const isAct = (path) => (path === '/dashboard' ? pathname === '/dashboard' : (pathname === path || pathname.startsWith(path + '/')))
    return sections.find((s) => s.items.some((i) => isAct(i.path)))?.label || null
  }, [sections, pathname])

  const tierColors = { basic: MUTED, pro: PINK, expert: GREEN, elite: '#f6c552' }
  const tierColor = tierColors[tier] ?? MUTED

  function closeAll() { setHover(false); setSelected(null) }
  async function signOut() { await supabase.auth.signOut(); closeAll(); onCloseMobile?.(); navigate('/') }

  // Rounded glass chip holding an icon.
  function chip(iconName, active, locked) {
    return (
      <span style={{
        width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        background: active ? 'linear-gradient(135deg, rgba(52,227,154,0.26), rgba(52,227,154,0.06))' : 'rgba(255,255,255,0.05)',
        border: active ? '1px solid rgba(52,227,154,0.45)' : '1px solid rgba(255,255,255,0.09)',
        color: locked ? MUTED : active ? GREEN : ICON,
        boxShadow: active ? '0 0 16px -4px rgba(52,227,154,0.55)' : 'none',
        transition: 'background .15s ease, border-color .15s ease, color .15s ease',
      }}>
        <NavIcon name={iconName} size={19} />
      </span>
    )
  }

  function rowStyle(active) {
    return {
      display: 'flex', alignItems: 'center', gap: expanded ? 11 : 0,
      padding: expanded ? '5px 12px' : '5px 0', justifyContent: expanded ? 'flex-start' : 'center',
      margin: '3px 12px', borderRadius: 13, width: 'auto', boxSizing: 'border-box',
      color: active ? GREEN : TEXT, background: expanded && active ? 'rgba(52,227,154,0.09)' : 'transparent',
      fontFamily: FONT, fontSize: 13.5, fontWeight: active ? 600 : 450, textDecoration: 'none',
      cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', transition: 'background .15s ease, color .15s ease',
    }
  }
  const hoverBg = (active) => ({
    onMouseEnter: (e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' },
    onMouseLeave: (e) => { if (!active) e.currentTarget.style.background = 'transparent' },
  })

  function panelRow({ id, icon, label, active, to, onClick, chevron, chevronOpen, title }) {
    const inner = (
      <>
        {chip(icon, active)}
        {expanded && <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
        {expanded && chevron && <NavIcon name="chevron" size={14} style={{ color: MUTED, transform: chevronOpen ? 'rotate(90deg)' : 'none', transition: 'transform .18s ease' }} />}
      </>
    )
    if (to) return <Link key={id} to={to} title={title} style={rowStyle(active)} {...hoverBg(active)} onClick={() => { closeAll(); onCloseMobile?.() }}>{inner}</Link>
    return <button key={id} type="button" title={title} style={rowStyle(active)} {...hoverBg(active)} onClick={onClick}>{inner}</button>
  }

  function flyItem(item) {
    const active = itemActive(item.path)
    const locked = item.feature ? !hasFeature(item.feature) : false
    const inner = (
      <>
        {chip(item.icon, active, locked)}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: locked ? MUTED : active ? GREEN : TEXT }}>{item.label}</span>
        {locked && <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>🔒</span>}
      </>
    )
    const style = {
      display: 'flex', alignItems: 'center', gap: 11, padding: '5px 10px', margin: '3px 8px', borderRadius: 13,
      background: active ? 'rgba(52,227,154,0.09)' : 'transparent', fontFamily: FONT, fontSize: 13.5, fontWeight: active ? 600 : 450,
      textDecoration: 'none', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.6 : 1, transition: 'background .15s ease',
    }
    if (locked) return <div key={item.path} style={style} title={item.label}>{inner}</div>
    return <Link key={item.path} to={item.path} title={item.label} style={style} {...hoverBg(active)} onClick={() => { closeAll(); onCloseMobile?.() }}>{inner}</Link>
  }

  const avatar = (
    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,92,147,0.16)', border: '1px solid rgba(255,92,147,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: PINK, fontWeight: 600, overflow: 'hidden', fontFamily: FONT, flexShrink: 0 }}>
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (profile?.full_name ?? user?.email ?? 'U')[0].toUpperCase()}
    </div>
  )

  const wordmark = (
    <span style={{ fontSize: 19, fontWeight: 700, color: TEXT, letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
      Lens<span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: '1.12em', color: GREEN }}>Trybe</span>
    </span>
  )

  const firstBody = (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div onClick={() => { navigate('/dashboard'); closeAll(); onCloseMobile?.() }} title="LensTrybe"
        style={{ minHeight: 62, display: 'flex', alignItems: 'center', justifyContent: expanded ? 'flex-start' : 'center', gap: 10, padding: expanded ? '0 18px' : 0, cursor: 'pointer', flexShrink: 0 }}>
        <BrandLogo markSize={26} fontSize={19} showWordmark={false} />
        {expanded && wordmark}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '2px 0' }}>
        {TOP.map((it) => panelRow({ id: it.path, icon: it.icon, label: it.label, active: itemActive(it.path), to: it.path, title: it.label }))}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: expanded ? '8px 18px' : '8px 14px' }} />
        {sections.map((s) => panelRow({
          id: s.label, icon: s.icon, label: s.label,
          active: activeSection === s.label || selected === s.label,
          onClick: () => { if (expanded) setSelected((v) => (v === s.label ? null : s.label)); else navigate(s.items[0].path) },
          chevron: true, chevronOpen: selected === s.label, title: s.label,
        }))}
      </div>
      <div style={{ flexShrink: 0, padding: '6px 0 8px' }}>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: expanded ? '2px 18px 6px' : '2px 14px 6px' }} />
        <div onClick={() => { navigate('/dashboard/profile/view-profile'); closeAll(); onCloseMobile?.() }} title="Profile"
          style={{ display: 'flex', alignItems: 'center', gap: 11, justifyContent: expanded ? 'flex-start' : 'center', padding: expanded ? '6px 18px' : '6px 0', cursor: 'pointer' }}>
          {avatar}
          {expanded && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name ?? profile?.business_name ?? user?.email}</div>
              <div style={{ fontSize: 11, color: tierColor, fontFamily: FONT, textTransform: 'capitalize' }}>{tier} plan</div>
            </div>
          )}
        </div>
        <div onClick={signOut} title="Sign out" style={{ ...rowStyle(false), color: MUTED }}
          onMouseEnter={(e) => { e.currentTarget.style.color = PINK }} onMouseLeave={(e) => { e.currentTarget.style.color = MUTED }}>
          {chip('logout', false)}
          {expanded && <span>Sign Out</span>}
        </div>
      </div>
    </div>
  )

  // ── MOBILE ──────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className={`sidebar-drawer${mobileOpen ? ' open' : ''}`}
        style={{ position: 'fixed', top: 0, left: 0, width: '86%', maxWidth: 320, height: '100dvh', zIndex: 1001, transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .25s ease', ...GLASS, borderRadius: '0 20px 20px 0', overflow: 'hidden', boxSizing: 'border-box' }}>
        {sheen('0 20px 20px 0')}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <div onClick={() => { navigate('/dashboard'); onCloseMobile?.() }} style={{ padding: '18px 20px', minHeight: 64, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}>
            <BrandLogo markSize={26} fontSize={19} showWordmark={false} />{wordmark}
          </div>
          <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 0 8px' }}>
            {TOP.map((it) => flyItem({ ...it }))}
            {sections.map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, padding: '14px 20px 4px', fontFamily: FONT }}>{s.label}</div>
                {s.items.map((it) => flyItem(it))}
              </div>
            ))}
          </nav>
        </div>
      </div>
    )
  }

  // ── DESKTOP ─────────────────────────────────────────────────
  const selSection = selected ? sections.find((s) => s.label === selected) : null

  return (
    <>
      <div aria-hidden style={{ width: SPACER, flexShrink: 0 }} />
      <div onMouseEnter={() => setHover(true)} onMouseLeave={closeAll}
        style={{ position: 'fixed', left: MARGIN, top: MARGIN, bottom: MARGIN, zIndex: 60, display: 'flex', alignItems: 'stretch', gap: FLY_GAP }}>
        <aside style={{ position: 'relative', width: expanded ? OPEN_W : RAIL, ...GLASS, borderRadius: 24, overflow: 'hidden', boxSizing: 'border-box', transition: 'width .2s cubic-bezier(.4,0,.2,1)' }}>
          {sheen(24)}
          {firstBody}
        </aside>

        {selSection && (
          <div style={{ position: 'relative', width: FLY_W, alignSelf: 'stretch', ...GLASS, borderRadius: 24, overflow: 'hidden', boxSizing: 'border-box', animation: 'ltflyin .18s ease' }}>
            {sheen(24)}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              <div style={{ padding: '20px 18px 12px', flexShrink: 0 }}>
                <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 24, color: TEXT, lineHeight: 1 }}>{selSection.label}</div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 10 }}>
                {selSection.items.map((it) => flyItem(it))}
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes ltflyin { from { opacity: 0; transform: translateX(-8px) } to { opacity: 1; transform: none } }`}</style>
    </>
  )
}
