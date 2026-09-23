// The whole workspace, one list. Everything on the live sidebar is here under the same names,
// with the three you open most (Today, Threads, Calendar) at the top and nothing nested twice.
export const TOP = [
  ['today', 'Today', 'today'], ['threads', 'Threads', 'chat'], ['bookings', 'Calendar', 'cal'],
  ['projects', 'Projects', 'briefcase'], ['notes', 'Notes', 'note'], ['inventory', 'Inventory', 'box'],
]
export const GROUPS = [
  ['Clients', 'users', [['meetings', 'Meetings', 'cal'], ['clients', 'Contacts', 'book'], ['crm', 'CRM', 'user']]],
  ['Finance', 'receipt', [['money', 'Finance hub', 'chart'], ['invoicing', 'Invoicing', 'dollar'], ['quotes', 'Quotes', 'file'], ['contracts', 'Contracts', 'fileCheck'], ['expenses', 'Expenses', 'card'], ['tax', 'Tax hub', 'percent']]],
  ['Portfolio', 'image', [['brand-kit', 'Brand kit', 'palette'], ['website', 'Website', 'globe'], ['deliver', 'Deliver', 'deliver']]],
  ['Content', 'pen', [['content-calendar', 'Content calendar', 'cal'], ['content-ideas', 'Content ideas', 'spark'], ['performance', 'Performance', 'chart'], ['channels', 'Channels', 'globe']]],
  ['Business', 'briefcase', [['reviews', 'Reviews', 'star'], ['marketplace', 'Marketplace', 'bag'], ['collaborate', 'Collaborate', 'users'], ['team', 'Team', 'users'], ['insights', 'Insights', 'chart']]],
  ['Work', 'clock', [['availability', 'Availability', 'clock'], ['jobs', 'Job board', 'briefcase']]],
  ['Account', 'user', [['profile', 'Edit profile', 'edit'], ['view-profile', 'View profile', 'eye'], ['subscription', 'Subscription', 'card'], ['referrals', 'Referrals', 'gift'], ['founding', 'Founding hub', 'star'], ['settings', 'Settings', 'settings'], ['support', 'Help and support', 'help']]],
]
export const ALL = [...TOP, ...GROUPS.flatMap(g => g[2]), ['lumi', 'Lumi', 'spark']]
// What each page holds, for the ones not built in this pass yet.
export const ABOUT = {
  projects: 'Every job as a project: brief, shot list, dates, files and money in one place.',
  notes: 'Quick notes that attach to a client, a project or nothing at all.',
  inventory: 'Bodies, lenses, lights and drones, with serials, insurance and what is packed for tomorrow.',
  meetings: 'Calls and consults booked from your link, synced to the calendar.',
  crm: 'Every client record, the jobs behind it, and what to do next.',
  invoicing: 'Invoices from quotes, branded, paid by card or transfer, chased on their own.',
  quotes: 'Quotes from your packages that clients accept on their phone.',
  contracts: 'Plain English contracts, e-signed in the thread.',
  expenses: 'Receipts, mileage and gear, tagged for tax as they happen.',
  tax: 'GST, BAS and end of year, from the ledger you already keep.',
  'brand-kit': 'Logo, colours and type, used on every quote, invoice, portal and page.',
  website: 'Your site, built from your profile, on your own domain.',
  'content-calendar': 'What goes out where, and when.',
  'content-ideas': 'Ideas from your recent work, ready to post.',
  reviews: 'Verified reviews, requested three days after delivery.',
  marketplace: 'Sell presets, prints and guides.',
  collaborate: 'Second shooters, editors and pilots you work with.',
  team: 'Seats for your team on Elite.',
  insights: 'Views, enquiries, bookings and where they came from.',
  availability: 'The days you take work, the days you do not, and travel radius.',
  jobs: 'Open briefs from clients looking for someone like you.',
  'view-profile': 'Your public profile, exactly as a client sees it.',
  subscription: 'Your plan, billing and invoices from us.',
  referrals: 'Invite a creative, both of you get a month.',
  founding: 'Your founding code, locked rate and the hundred.',
  settings: 'Account, notifications, calendar sync and integrations.',
  support: 'Answers, and a message to a person when you need one.',
}
