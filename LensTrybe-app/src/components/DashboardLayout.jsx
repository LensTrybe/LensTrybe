import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Settings', path: '/settings' },
]

function DashboardLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="brand">LensTrybe</h1>
        <p className="sidebar-caption">Dashboard Starter</p>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link-active' : 'nav-link'
              }
              to={item.path}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

export default DashboardLayout
