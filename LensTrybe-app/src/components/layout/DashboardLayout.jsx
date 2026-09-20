import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import DashSurface from './DashSurface'
import { useDashTheme } from './useDashTheme'
import NoteTaker from './NoteTaker'
import FloatingDock from './FloatingDock'
import NotificationBell from './NotificationBell'
import BroadcastHost from '../broadcasts/BroadcastHost'
import LumiWidget from './LumiWidget'
import DashboardTour from './DashboardTour'

// Dark base + drifting pastel "northern lights" wash behind the whole dashboard.
const AURORA_WRAP = {
  position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
  background: 'radial-gradient(1200px 900px at 15% -12%, #100f20 0%, transparent 55%), radial-gradient(1000px 820px at 100% 116%, #0a1622 0%, transparent 55%), #07060c',
}
const auroraBlob = (c, o) => ({ position: 'absolute', borderRadius: '50%', background: c, filter: 'blur(100px)', mixBlendMode: 'screen', opacity: o })

// Light mode: the same bright pastel mosaic as the hero, behind everything, with
// a soft white wash on top so text and glass widgets stay readable.

const GLASS_HAMBURGER = {
  backdropFilter: 'blur(20px) saturate(150%)',
  WebkitBackdropFilter: 'blur(20px) saturate(150%)',
  background: 'linear-gradient(160deg, rgba(255,255,255,0.92), rgba(255,255,255,0.7))',
  border: '1px solid rgba(20,17,26,0.12)',
  borderTop: '1px solid rgba(255,255,255,0.9)',
  boxShadow: '0 4px 16px -6px rgba(40,30,60,0.2)',
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <line x1="3" y1="6" x2="19" y2="6" stroke="#14111a" strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="11" x2="19" y2="11" stroke="#14111a" strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="16" x2="19" y2="16" stroke="#14111a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function DashboardLayout() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const { theme, dark, toggleTheme } = useDashTheme()
  const location = useLocation()
  const isHome = location.pathname === '/dashboard' || location.pathname === '/dashboard/'
  const navigate = useNavigate()
  const { profile } = useAuth()
  // A failed subscription payment: nudge them to update their card on every page.
  const pastDue = String(profile?.subscription_status || '').toLowerCase() === 'past_due'
  const onSubPage = location.pathname.startsWith('/dashboard/settings/subscription')

  // A profile below the listing bar is not in Find a Creative. Nobody should be invisible
  // without knowing it, so say so on every page and name exactly what is missing.
  const listingGaps = []
  if (!String(profile?.avatar_url || '').trim()) listingGaps.push('a profile photo')
  if (!String(profile?.tagline || '').trim()) listingGaps.push('a tagline')
  if (!(Array.isArray(profile?.skill_types) && profile.skill_types.length)) listingGaps.push('at least one creative type')
  // Clients have no profile row at all, so they never see this. Admins are excluded from
  // search by design, and an account on its way out does not need chasing.
  const notListed = !!profile && !profile.is_admin && !profile.pending_deletion && listingGaps.length > 0
  const onEditProfile = location.pathname.startsWith('/dashboard/profile/edit-profile')
  const gapsText = listingGaps.length === 1
    ? listingGaps[0]
    : `${listingGaps.slice(0, -1).join(', ')} and ${listingGaps[listingGaps.length - 1]}`

  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setMobileSidebarOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <>
      <DashSurface dark={dark} isMobile={isMobile} vivid={isHome} />
      {isMobile && (
        <button
          type="button"
          className="hamburger-btn"
          onClick={() => setMobileSidebarOpen(true)}
          style={{
            position: 'fixed',
            top: '12px',
            left: '12px',
            zIndex: 1002,
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            ...GLASS_HAMBURGER,
            color: '#14111a',
            cursor: 'pointer',
            fontWeight: 600,
            letterSpacing: '-0.3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1.6,
            transition: 'all 0.2s',
          }}
          aria-label="Open navigation menu"
        >
          <HamburgerIcon />
        </button>
      )}
      {isMobile && mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            background: 'rgba(20,17,26,0.35)',
            zIndex: 999,
          }}
        />
      )}
      <div className="lt-dash" data-theme={theme} style={{ display: isMobile ? 'block' : 'flex', minHeight: '100dvh', background: 'transparent', colorScheme: dark ? 'dark' : 'light', width: '100%', position: 'relative', zIndex: 1 }}>
        {!isMobile && <Sidebar isMobile={false} mobileOpen={false} onCloseMobile={() => setMobileSidebarOpen(false)} theme={theme} />}
        <main style={{
          flex: 1,
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
          boxSizing: 'border-box',
        }} className="dashboard-main-content">
          <div style={{
            flex: 1,
            // Extra bottom room on a phone so the last row of any page clears the
            // floating Lumi and quick-note buttons instead of sitting under them.
            padding: isMobile ? '72px 16px 108px' : '32px 40px',
            maxWidth: '1280px',
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
          }} className="dash-main">
            <BroadcastHost bannerWrapStyle={{ marginBottom: 8 }} />
            {pastDue && !onSubPage && (
              <div role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', marginBottom: 20, borderRadius: 14, border: '1.5px solid rgba(255,45,120,0.55)', background: dark ? 'rgba(255,45,120,0.12)' : 'rgba(255,45,120,0.08)', color: 'var(--lt-text)', fontSize: 13.5, lineHeight: 1.5, fontFamily: 'Inter, sans-serif' }}>
                <span style={{ flex: '1 1 240px' }}><strong style={{ color: '#FF2D78' }}>Your last payment didn't go through.</strong> Update your card to keep your plan's features.</span>
                <button type="button" onClick={() => navigate('/dashboard/settings/subscription?card=update')} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#1DB954', color: '#04120a', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Update card</button>
              </div>
            )}
            {notListed && !onEditProfile && (
              <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', marginBottom: 20, borderRadius: 14, border: '1.5px solid rgba(245,158,11,0.55)', background: dark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.1)', color: 'var(--lt-text)', fontSize: 13.5, lineHeight: 1.5, fontFamily: 'Inter, sans-serif' }}>
                <span style={{ flex: '1 1 240px' }}>
                  <strong style={{ color: '#f59e0b' }}>You are not showing in Find a Creative yet.</strong>{' '}
                  Add {gapsText} so clients can find you. Your profile link works in the meantime.
                </span>
                <button type="button" onClick={() => navigate('/dashboard/profile/edit-profile')} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#1DB954', color: '#04120a', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Finish my profile</button>
              </div>
            )}
            <Outlet context={{ theme, toggleTheme, dark }} />
          </div>
        </main>
        <NoteTaker />
        <NotificationBell docked />
        <LumiWidget />
        <FloatingDock />
        <DashboardTour />
      </div>
      {isMobile && (
        <Sidebar isMobile mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} theme={theme} />
      )}
    </>
  )
}
