import { Link } from 'react-router-dom'

// The blog's three pills (4 Oct 2026). Real links, so Google reads each as a page of its own;
// the current one carries aria-current. On /blog itself none is selected.
const PILLS = [['clients', 'For clients', '/blog/clients'], ['creatives', 'For creatives', '/blog/creatives'], ['edit', 'The Trybe Edit', '/blog/edit']]

export default function BlogPills({ on }) {
  return (
    <nav className="bpills" aria-label="Blog sections">
      {PILLS.map(([k, label, to]) => <Link key={k} to={to} className={'chip' + (on === k ? ' on' : '')} aria-current={on === k ? 'page' : undefined}>{label}</Link>)}
    </nav>
  )
}
