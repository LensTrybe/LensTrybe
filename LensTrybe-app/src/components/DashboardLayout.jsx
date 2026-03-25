import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

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
    <div>
      <aside>
        <h2>LensTrybe Dashboard</h2>
        <button type="button" onClick={signOut}>
          Sign Out
        </button>
        <nav>
          {navSections.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              <ul>
                {section.links.map((link) => (
                  <li key={link.to}>
                    <NavLink to={link.to}>{link.label}</NavLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default DashboardLayout
