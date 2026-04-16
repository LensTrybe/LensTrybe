import { useMemo } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import useAuthUser from '../hooks/useAuthUser'
import { useSubscription } from '../hooks/useSubscription'
import './DashboardLayout.css'

const navSections = [
  {
    title: '',
    links: [
      { label: 'Dashboard', to: '/dashboard' },
    ],
  },
  {
    title: 'PROFILE',
    links: [{ label: 'Edit Profile', to: '/dashboard/profile/edit-profile' }],
  },
  {
    title: 'MY WORK',
      links: [
      { label: 'My Bookings', to: '/dashboard/my-work/my-bookings' },
      { label: 'Booking Requests', to: '/dashboard/my-work/booking-requests' },
      { label: 'Availability', to: '/dashboard/my-work/availability' },
      { label: 'Jobs', to: '/dashboard/my-work/jobs' },
    ],
  },
  {
    title: 'CLIENTS',
    links: [
      { label: 'Messages', to: '/dashboard/clients/messages' },
      { label: 'CRM', to: '/dashboard/clients/crm' },
      { label: 'Client Portals', to: '/dashboard/clients/client-portals' },
    ],
  },
  {
    title: 'FINANCE',
    links: [
      { label: 'Invoicing', to: '/dashboard/finance/invoicing' },
      { label: 'Quotes', to: '/dashboard/finance/quotes' },
      { label: 'Contracts', to: '/dashboard/finance/contracts' },
    ],
  },
  {
    title: 'PORTFOLIO AND DESIGN',
    links: [
      { label: 'Portfolio', to: '/dashboard/portfolio-design/portfolio' },
      { label: 'Brand Kit', to: '/dashboard/portfolio-design/brand-kit' },
      {
        label: 'Portfolio Website',
        to: '/dashboard/portfolio-design/portfolio-website',
      },
      { label: 'Deliver', to: '/dashboard/portfolio-design/deliver' },
    ],
  },
  {
    title: 'BUSINESS',
    links: [
      { label: 'Reviews', to: '/dashboard/business/reviews' },
      { label: 'Marketplace', to: '/dashboard/business/marketplace' },
      { label: 'Team', to: '/dashboard/business/team' },
    ],
  },
]

/** Sidebar item → `features` key from tierFeatures (Expert+ unlocks these vs Basic/Pro). */
const LINK_FEATURE_KEY = {
  '/dashboard': 'hasInsights',
  '/dashboard/finance/contracts': 'hasContracts',
  '/dashboard/clients/crm': 'hasCRM',
  '/dashboard/clients/client-portals': 'hasClientPortal',
  '/dashboard/portfolio-design/brand-kit': 'hasBrandKit',
  '/dashboard/portfolio-design/portfolio-website': 'hasPortfolioWebsite',
  '/dashboard/portfolio-design/deliver': 'hasDeliver',
  '/dashboard/business/team': 'hasTeam',
}

function DashboardLayout() {
  const { user } = useAuthUser()
  const { features, loading: tierLoading } = useSubscription()

  const navSectionsResolved = useMemo(() => {
    const viewTo = user?.id ? `/profile/${user.id}` : null
    return navSections.map((section) => {
      if (section.title !== 'PROFILE') return section
      return {
        ...section,
        links: [
          ...section.links,
          ...(viewTo ? [{ label: 'View profile', to: viewTo }] : []),
        ],
      }
    })
  }, [user?.id])

  const signOut = async () => {
    if (!supabase) {
      return
    }
    await supabase.auth.signOut()
  }

  const navLocked = (to) => {
    if (tierLoading) return false
    const key = LINK_FEATURE_KEY[to]
    if (!key) return false
    return !features[key]
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-brand">LensTrybe</div>
        <nav className="dashboard-sidebar-nav" aria-label="Dashboard">
          {navSectionsResolved.map((section) => (
            <section key={section.title}>
              <h3 className="dashboard-sidebar-heading">{section.title}</h3>
              <ul className="dashboard-sidebar-list">
                {section.links.map((link) => {
                  const locked = navLocked(link.to)
                  return (
                    <li key={`${link.to}-${link.label}`}>
                      <NavLink
                        to={link.to}
                        className={({ isActive }) =>
                          isActive
                            ? 'dashboard-nav-link dashboard-nav-link--active'
                            : 'dashboard-nav-link'
                        }
                        aria-label={locked ? `${link.label} (upgrade required)` : undefined}
                      >
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            width: '100%',
                          }}
                        >
                          <span>{link.label}</span>
                          {locked ? <Lock size={14} strokeWidth={2} aria-hidden /> : null}
                        </span>
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </nav>
        <div className="dashboard-sidebar-footer">
          <button type="button" className="dashboard-sidebar-signout" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </aside>
      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  )
}

export default DashboardLayout
