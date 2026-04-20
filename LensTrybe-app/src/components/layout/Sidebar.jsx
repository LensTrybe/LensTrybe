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

  const sections = [...new Set(nav.map(n => n.section))]

  const tierColors = { basic: 'var(--text-muted)', pro: 'var(--pink)', expert: 'var(--green)', elite: '#EAB308' }
  const tierColor = tierColors[tier] ?? 'var(--text-muted)'

  const styles = {
    sidebar: {
      width: collapsed ? '64px' : '240px',
      minHeight: '100vh',
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-default)',
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
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: collapsed ? 'center' : 'space-between',
      gap: '10px',
      cursor: 'pointer',
    },
    logoText: {
      fontFamily: 'var(--font-display)',
      fontSize: '18px',
      color: 'var(--text-primary)',
      fontWeight: 400,
      display: collapsed ? 'none' : 'block',
      whiteSpace: 'nowrap',
    },
    collapseBtn: {
      background: 'none',
      border: 'none',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: 'var(--radius-sm)',
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center',
    },
    nav: {
      flex: 1,
      overflowY: 'auto',
      padding: '12px 0',
    },
    sectionLabel: {
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#39ff14',
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
      color: locked ? 'var(--text-muted)' : active ? 'var(--text-primary)' : 'var(--text-secondary)',
      background: active ? 'var(--bg-subtle)' : 'transparent',
      borderLeft: active ? '2px solid var(--pink)' : '2px solid transparent',
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
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      justifyContent: collapsed ? 'center' : 'flex-start',
    },
    avatar: {
      width: '32px',
      height: '32px',
      borderRadius: 'var(--radius-full)',
      background: 'var(--pink-dim)',
      border: '1px solid var(--pink)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      color: 'var(--pink)',
      fontWeight: 600,
      flexShrink: 0,
      overflow: 'hidden',
    },
    profileInfo: { display: collapsed ? 'none' : 'block', overflow: 'hidden' },
    profileName: { fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    profileTier: { fontSize: '11px', color: tierColor, fontWeight: 500, textTransform: 'capitalize' },
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
            {nav.map((item, i) => {
              const locked = item.feature ? !hasFeature(item.feature) : false
              const showSection = item.section !== currentSection
              if (showSection) currentSection = item.section

              return (
                <div key={i}>
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
            <div style={{ padding: collapsed ? '8px 0' : '8px 12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
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
              fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', borderTop: '1px solid var(--border-subtle)',
              transition: 'color var(--transition-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <span style={{ fontSize: '13px' }}>→</span>
            {!collapsed && <span>Sign Out</span>}
          </div>
      </aside>
    </div>
  )
}
