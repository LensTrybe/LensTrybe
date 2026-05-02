import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import { supabase } from '../../lib/supabaseClient'

const nav = [
  { label: 'Dashboard', path: '/dashboard', icon: '⊞', section: null },
  { label: 'Find a Creative', path: '/creatives', icon: '🔍', section: null },
  { label: 'Messages', path: '/dashboard/clients/messages', icon: '✉', section: 'Clients' },
  { label: 'CRM', path: '/dashboard/clients/crm', icon: '◈', section: 'Clients', feature: 'crm' },
  { label: 'Invoicing', path: '/dashboard/finance/invoicing', icon: '◎', section: 'Finance', feature: 'invoicing' },
  { label: 'Quotes', path: '/dashboard/finance/quotes', icon: '◌', section: 'Finance', feature: 'invoicing' },
  { label: 'Contracts', path: '/dashboard/finance/contracts', icon: '✦', section: 'Finance', feature: 'contracts' },
  { label: 'Brand Kit', path: '/dashboard/portfolio-design/brand-kit', icon: '◉', section: 'Portfolio', feature: 'brandKit' },
  { label: 'Portfolio Website', path: '/dashboard/portfolio-design/portfolio-website', icon: '🌐', section: 'Portfolio' },
  { label: 'Deliver', path: '/dashboard/portfolio-design/deliver', icon: '⬆', section: 'Portfolio', feature: 'deliver' },
  { label: 'Reviews', path: '/dashboard/business/reviews', icon: '★', section: 'Business' },
  { label: 'Marketplace', path: '/dashboard/business/marketplace', icon: '◆', section: 'Business' },
  { label: 'Team', path: '/dashboard/business/team', icon: '⬡', section: 'Business', feature: 'team' },
  { label: 'Lumi AI', path: '/dashboard/lumi', icon: '✦', section: 'Business' },
  { label: 'Bookings', path: '/dashboard/my-work/my-bookings', icon: '◷', section: 'Work' },
  { label: 'Availability', path: '/dashboard/my-work/availability', icon: '📅', section: 'Work' },
  { label: 'Job Board', path: '/dashboard/my-work/jobs', icon: '◈', section: 'Work' },
  { label: 'Edit Profile', path: '/dashboard/profile/edit-profile', icon: '◎', section: 'Account' },
  { label: 'View Profile', path: '/dashboard/profile/view-profile', icon: '👁', section: 'Account' },
  { label: 'Settings', path: '/dashboard/settings', icon: '⚙', section: 'Account' },
]

export default function Sidebar({ isMobile = false, mobileOpen = false, onCloseMobile }) {
  const { profile, user } = useAuth()
  const { hasFeature, tier } = useSubscription()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const navItems = nav.some(item => item.path === '/dashboard/lumi')
    ? nav
    : [
        ...nav.slice(0, 21),
        { label: 'Lumi AI', path: '/dashboard/lumi', icon: '✦', section: 'Business' },
        ...nav.slice(21),
      ]

  const isAdminUser = Boolean(
    profile && (
      profile.is_admin === true
      || profile.is_admin === 'true'
      || profile.is_admin === 1
      || profile.is_admin === '1'
    ),
  )

  const navItemsWithAdmin = (() => {
    if (!isAdminUser) return navItems
    const adminItem = { label: 'Admin', path: '/dashboard/admin', icon: '⚡', section: 'Account' }
    const settingsIndex = navItems.findIndex(x => x.path === '/dashboard/settings')
    if (settingsIndex === -1) return [...navItems, adminItem]
    return [...navItems.slice(0, settingsIndex + 1), adminItem, ...navItems.slice(settingsIndex + 1)]
  })()

  const tierColors = { basic: 'rgba(255,255,255,0.45)', pro: '#FF2D78', expert: '#1DB954', elite: '#EAB308' }
  const tierColor = tierColors[tier] ?? 'rgba(255,255,255,0.45)'

  const styles = {
    sidebar: {
      width: collapsed ? '64px' : '240px',
      minHeight: '100vh',
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.03)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width var(--transition-slow)',
      overflow: 'hidden',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      height: '100vh',
    },
    logo: {
      padding: collapsed ? '20px 0' : '24px 20px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: collapsed ? 'center' : 'space-between',
      gap: '10px',
      cursor: 'pointer',
    },
    logoText: {
      fontFamily: 'var(--font-display)',
      fontSize: '18px',
      color: '#ffffff',
      fontWeight: 600,
      letterSpacing: '-0.3px',
      lineHeight: 1.6,
      display: collapsed ? 'none' : 'block',
      whiteSpace: 'nowrap',
    },
    collapseBtn: {
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))',
      border: '1px solid rgba(255,255,255,0.1)',
      borderTop: '1px solid rgba(255,255,255,0.16)',
      color: 'rgba(255,255,255,0.55)',
      cursor: 'pointer',
      padding: '6px 8px',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: 600,
      letterSpacing: '-0.3px',
      lineHeight: 1.6,
      display: 'flex',
      alignItems: 'center',
      transition: 'all 0.2s',
    },
    nav: {
      flex: 1,
      overflowY: 'auto',
      padding: '12px 0',
    },
    sectionLabel: {
      fontSize: '10px',
      fontWeight: 400,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.35)',
      lineHeight: 1.6,
      padding: collapsed ? '16px 0 4px' : '16px 20px 4px',
      textAlign: collapsed ? 'center' : 'left',
      display: 'block',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
    },
    navItem: (active, locked) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: collapsed ? '8px 0' : '8px 20px',
      justifyContent: collapsed ? 'center' : 'flex-start',
      fontSize: 'var(--text-sm)',
      fontWeight: active ? 600 : 400,
      letterSpacing: active ? '-0.3px' : '0',
      lineHeight: 1.6,
      color: locked ? 'rgba(255,255,255,0.35)' : active ? '#ffffff' : 'rgba(255,255,255,0.75)',
      background: active
        ? 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)'
        : 'transparent',
      borderLeft: active ? '2px solid #FF2D78' : '2px solid transparent',
      backdropFilter: active ? 'blur(20px)' : 'none',
      WebkitBackdropFilter: active ? 'blur(20px)' : 'none',
      cursor: locked ? 'not-allowed' : 'pointer',
      transition: 'all var(--transition-fast)',
      textDecoration: 'none',
      width: '100%',
      boxSizing: 'border-box',
      opacity: locked ? 0.5 : 1,
    }),
    icon: { fontSize: '14px', flexShrink: 0, width: '16px', textAlign: 'center', display: collapsed ? 'inline' : 'none' },
    label: { whiteSpace: 'nowrap', display: collapsed ? 'none' : 'block' },
    lockIcon: { marginLeft: 'auto', fontSize: '10px', opacity: 0.5, display: collapsed ? 'none' : 'block' },
    profile: {
      padding: collapsed ? '16px 0' : '16px 20px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      justifyContent: collapsed ? 'center' : 'flex-start',
    },
    avatar: {
      width: '32px',
      height: '32px',
      borderRadius: 'var(--radius-full)',
      background: 'rgba(255,45,120,0.15)',
      border: '1px solid rgba(255,45,120,0.3)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      color: '#FF2D78',
      fontWeight: 600,
      letterSpacing: '-0.3px',
      lineHeight: 1.6,
      flexShrink: 0,
      overflow: 'hidden',
    },
    profileInfo: { display: collapsed ? 'none' : 'block', overflow: 'hidden' },
    profileName: {
      fontSize: '13px',
      fontWeight: 500,
      letterSpacing: '-0.3px',
      lineHeight: 1.6,
      color: '#ffffff',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    profileTier: { fontSize: '11px', color: tierColor, fontWeight: 400, lineHeight: 1.6, textTransform: 'capitalize' },
  }

  let currentSection = null

  return (
    <div
      className={isMobile ? '' : `sidebar-drawer${mobileOpen ? ' open' : ''}`}
      style={isMobile ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        maxWidth: '100%',
        height: '100dvh',
        minHeight: '100dvh',
        zIndex: 1001,
        transition: 'transform 0.25s ease',
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        pointerEvents: mobileOpen ? 'auto' : 'none',
        boxSizing: 'border-box',
      } : undefined}
    >
      <aside style={{ ...styles.sidebar, width: isMobile ? '100%' : styles.sidebar.width, maxWidth: isMobile ? '100%' : undefined, boxSizing: 'border-box' }}>
          <div style={styles.logo} onClick={() => navigate('/')}>
            <span style={styles.logoText}>LensTrybe</span>
            {!isMobile && (
              <button style={styles.collapseBtn} onClick={e => { e.stopPropagation(); setCollapsed(p => !p) }}>
                {collapsed ? '→' : '←'}
              </button>
            )}
          </div>

          <nav style={styles.nav}>
            {navItemsWithAdmin.map((item) => {
              const locked = item.feature ? !hasFeature(item.feature) : false
              const showSection = item.section !== currentSection
              if (showSection) currentSection = item.section

              return (
                <div key={item.path}>
                  {showSection && item.section && (
                    <span style={styles.sectionLabel}>{collapsed ? '·' : item.section}</span>
                  )}
                  {locked ? (
                    <div style={styles.navItem(false, true)}>
                      <span style={styles.icon}>{item.icon}</span>
                      <span style={styles.label}>{item.label}</span>
                      <span style={styles.lockIcon}>🔒</span>
                    </div>
                  ) : (
                    <NavLink to={item.path} style={({ isActive }) => styles.navItem(isActive, false)} onClick={() => onCloseMobile?.()}>
                      <span style={styles.icon}>{item.icon}</span>
                      <span style={styles.label}>{item.label}</span>
                    </NavLink>
                  )}
                </div>
              )
            })}
          </nav>

          {profile && (
            <div style={{ padding: collapsed ? '8px 0' : '8px 12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <NavLink
                to="/the-trybe-edit"
                style={({ isActive }) => ({
                  ...styles.navItem(isActive, false),
                  borderRadius: 'var(--radius-md)',
                  margin: collapsed ? '0 8px' : '0 8px',
                })}
                onClick={() => onCloseMobile?.()}
              >
                <span style={styles.icon}>✎</span>
                <span style={styles.label}>The Trybe Edit</span>
              </NavLink>
            </div>
          )}

          <div style={styles.profile}>
            <div style={styles.avatar}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (profile?.full_name ?? user?.email ?? 'U')[0].toUpperCase()
              }
            </div>
            <div style={styles.profileInfo}>
              <div style={styles.profileName}>{profile?.full_name ?? profile?.business_name ?? user?.email}</div>
              <div style={styles.profileTier}>{tier} plan</div>
            </div>
          </div>
          <div
            onClick={async () => { await supabase.auth.signOut(); onCloseMobile?.(); navigate('/') }}
            style={{
              padding: collapsed ? '12px 0' : '12px 20px',
              display: 'flex', alignItems: 'center', gap: '10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              fontSize: '13px',
              fontWeight: 400,
              lineHeight: 1.6,
              letterSpacing: '-0.3px',
              color: 'rgba(255,255,255,0.45)',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)', borderTop: '1px solid rgba(255,255,255,0.06)',
              transition: 'color var(--transition-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#FF2D78' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
          >
            <span style={{ fontSize: '13px' }}>→</span>
            {!collapsed && <span>Sign Out</span>}
          </div>
      </aside>
    </div>
  )
}
