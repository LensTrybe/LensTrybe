import { NavLink, Outlet } from 'react-router-dom'

export default function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-brand">LensTrybe</span>
        <nav className="app-nav" aria-label="Main">
          <NavLink to="/" end className="app-nav-link">
            Home
          </NavLink>
          <NavLink to="/about" className="app-nav-link">
            About
          </NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
