import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import './DashboardLayout.css'

const navSections = [
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
      { label: 'Insights', to: '/dashboard/business/insights' },
      { label: 'Reviews', to: '/dashboard/business/reviews' },
      { label: 'Marketplace', to: '/dashboard/business/marketplace' },
      { label: 'Team', to: '/dashboard/business/team' },
    ],
  },
]

function DashboardLayout() {
  const signOut = async () => {
    if (!supabase) {
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
        <div className="dashboard-sidebar__header">
          <h2 className="dashboard-sidebar__brand">LensTrybe Dashboard</h2>
          <button type="button" className="dashboard-sidebar__signout" onClick={signOut}>
            Sign out
          </button>
        </div>
        <nav className="dashboard-sidebar__nav">
          {navSections.map((section) => (
            <section key={section.title} className="dashboard-sidebar__section">
              <h3 className="dashboard-sidebar__section-title">{section.title}</h3>
              <ul className="dashboard-sidebar__list">
                {section.links.map((link) => (
                  <li key={link.to} className="dashboard-sidebar__item">
                    <NavLink
                      to={link.to}
                      className={({ isActive }) =>
                        isActive
                          ? 'dashboard-sidebar__link dashboard-sidebar__link--active'
                          : 'dashboard-sidebar__link'
                      }
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </aside>
      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  )
}

export default DashboardLayout
