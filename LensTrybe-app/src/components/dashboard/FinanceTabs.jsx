import { Link, useLocation } from 'react-router-dom'

// Sub-navigation shared across the Finance hub so Overview, Expenses, Invoices,
// Quotes, Contracts and Tax feel like one connected workspace. Render inside a
// .ltf wrapper so the .ftab styles from financeStyles apply (light + dark).

const I = {
  overview: <><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /></>,
  expenses: <><rect x="2" y="6" width="20" height="13" rx="2.5" /><path d="M2 10h20" /><path d="M6 15h4" /></>,
  invoices: <><path d="M6 2h9l5 5v15H6z" /><path d="M15 2v5h5" /><path d="M9 13h6M9 17h6M9 9h2" /></>,
  quotes: <><path d="M8 2h8l4 4v16H4V4z" fill="none" /><path d="M8 10h8M8 14h5" /><circle cx="12" cy="6" r="0.5" /></>,
  contracts: <><path d="M6 2h9l5 5v15H6z" /><path d="M15 2v5h5" /><path d="m9 15 2 2 4-4" /></>,
  tax: <><circle cx="12" cy="12" r="9" /><path d="M8.5 15.5 15.5 8.5" /><circle cx="9" cy="9" r="1.3" /><circle cx="15" cy="15" r="1.3" /></>,
}

const TABS = [
  { key: 'overview', label: 'Overview', to: '/dashboard/finance/overview' },
  { key: 'expenses', label: 'Expenses', to: '/dashboard/finance/expenses' },
  { key: 'tax', label: 'Tax Hub', to: '/dashboard/finance/tax' },
]

export default function FinanceTabs({ active }) {
  const { pathname } = useLocation()
  return (
    <div className="ftabs">
      {TABS.map((t) => {
        const on = active ? active === t.key : (pathname === t.to || pathname.startsWith(t.to + '/'))
        return (
          <Link key={t.key} to={t.to} className={'ftab' + (on ? ' on' : '')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{I[t.key]}</svg>
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
