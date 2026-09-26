import { NavLink } from 'react-router-dom'

// Calendar and Availability are one place with two tabs: the bookings, and the rules that decide
// which days clients can ask for.
export default function CalTabs() {
  return <div className="tfilt seg3 caltabs" role="tablist">
    <NavLink to="/app/bookings" end className={({ isActive }) => isActive ? 'on' : ''} role="tab">Calendar</NavLink>
    <NavLink to="/app/availability" className={({ isActive }) => isActive ? 'on' : ''} role="tab">Availability</NavLink>
  </div>
}
