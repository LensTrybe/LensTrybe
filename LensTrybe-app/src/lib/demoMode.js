// Demo mode: feeds realistic placeholder analytics into every dashboard widget
// WITHOUT touching the database, for marketing screenshots. Fully reversible.
//   Enter:  add ?demo=1 to the dashboard URL
//   Leave:  add ?demo=0  (or clear site data)
// Once entered it persists in localStorage so navigation keeps it on.

export function isDemoMode() {
  try {
    const p = new URLSearchParams(window.location.search)
    if (p.get('demo') === '1') { localStorage.setItem('lt_demo', '1'); return true }
    if (p.get('demo') === '0') { localStorage.removeItem('lt_demo'); return false }
    return localStorage.getItem('lt_demo') === '1'
  } catch { return false }
}

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString()
const dstr = (daysAgo) => iso(daysAgo).slice(0, 10)

const CLIENTS = ['Harper & Jack', 'Willow Studios', 'Coastal Realty', 'Meridian Co', 'The Bloom Co', 'Atlas Media', 'Rosewood Events', 'Bright & Co', 'Jetty Films', 'Nova Group', 'Sunday Lane', 'Fox & Fern']
const SKILLS = ['Photography', 'Videography']
const DISCIPLINES = ['Weddings', 'Portraits', 'Real Estate', 'Corporate', 'Events']
const email = (n) => `${n.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`

// ---- Invoices (Revenue + Cash flow) ----
export function demoInvoices() {
  const rows = []
  let id = 1
  // 7 months of paid work, trending up
  for (let m = 6; m >= 0; m--) {
    const perMonth = 3 + (m % 2)
    for (let i = 0; i < perMonth; i++) {
      const client = CLIENTS[(m * 3 + i) % CLIENTS.length]
      const amount = 900 + (6 - m) * 420 + i * 260
      rows.push({
        id: `inv-${id++}`, client_name: client, client_email: email(client),
        amount, status: 'paid',
        created_at: iso(m * 30 + i * 6 + 2), due_date: dstr(m * 30 + i * 6 - 8),
        skill_type: SKILLS[(m + i) % SKILLS.length], discipline: DISCIPLINES[(m * 2 + i) % DISCIPLINES.length],
      })
    }
  }
  // a few outstanding + overdue (this + last month, unpaid)
  rows.push({ id: `inv-${id++}`, client_name: 'Rosewood Events', client_email: email('Rosewood Events'), amount: 3200, status: 'sent', created_at: iso(9), due_date: dstr(-6), skill_type: 'Photography', discipline: 'Events' })
  rows.push({ id: `inv-${id++}`, client_name: 'Coastal Realty', client_email: email('Coastal Realty'), amount: 1450, status: 'sent', created_at: iso(41), due_date: dstr(11), skill_type: 'Photography', discipline: 'Real Estate' })
  rows.push({ id: `inv-${id++}`, client_name: 'Atlas Media', client_email: email('Atlas Media'), amount: 2600, status: 'sent', created_at: iso(52), due_date: dstr(22), skill_type: 'Videography', discipline: 'Corporate' })
  return rows
}

// ---- Quotes ----
export function demoQuotes() {
  return [
    { id: 'q1', client_name: 'Sunday Lane', client_email: email('Sunday Lane'), amount: 4200, status: 'sent', valid_until: dstr(-14), created_at: iso(9) },
    { id: 'q2', client_name: 'Fox & Fern', client_email: email('Fox & Fern'), amount: 2800, status: 'viewed', valid_until: dstr(-3), created_at: iso(12) },
    { id: 'q3', client_name: 'Nova Group', client_email: email('Nova Group'), amount: 6500, status: 'sent', valid_until: dstr(6), created_at: iso(2) },
    { id: 'q4', client_name: 'The Bloom Co', client_email: email('The Bloom Co'), amount: 3100, status: 'accepted', valid_until: dstr(20), created_at: iso(18) },
    { id: 'q5', client_name: 'Meridian Co', client_email: email('Meridian Co'), amount: 5400, status: 'accepted', valid_until: dstr(30), created_at: iso(26) },
    { id: 'q6', client_name: 'Bright & Co', client_email: email('Bright & Co'), amount: 1900, status: 'declined', valid_until: dstr(10), created_at: iso(33) },
    { id: 'q7', client_name: 'Jetty Films', client_email: email('Jetty Films'), amount: 7200, status: 'accepted', valid_until: dstr(40), created_at: iso(47) },
  ]
}

// ---- Bookings ----
export function demoBookings() {
  const services = ['Wedding day', 'Portrait session', 'Real estate shoot', 'Corporate headshots', 'Event coverage', 'Brand shoot']
  const rows = []
  let id = 1
  for (let m = 6; m >= 0; m--) {
    const perMonth = 2 + (m % 3)
    for (let i = 0; i < perMonth; i++) {
      const client = CLIENTS[(m * 2 + i) % CLIENTS.length]
      rows.push({
        id: `bk-${id++}`, client_name: client, client_email: email(client),
        service: services[(m + i) % services.length],
        status: m === 0 && i === 0 ? 'pending' : 'confirmed',
        booking_date: dstr(m * 30 + i * 7 - 12), created_at: iso(m * 30 + i * 7 + 1),
      })
    }
  }
  return rows
}

// ---- Message threads ----
export function demoThreadsAll() {
  const rows = []
  for (let m = 6; m >= 0; m--) {
    const perMonth = 4 + (m % 3)
    for (let i = 0; i < perMonth; i++) rows.push({ id: `th-${m}-${i}`, created_at: iso(m * 30 + i * 4 + 1) })
  }
  return rows
}
export function demoThreadsUnread() {
  return [
    { id: 'u1', client_name: 'Sunday Lane', nickname: null, subject: 'Wedding in November — availability?', unread_count: 2, last_message_at: iso(0.1) },
    { id: 'u2', client_name: 'Atlas Media', nickname: null, subject: 'Corporate headshots for 12 staff', unread_count: 1, last_message_at: iso(0.3) },
    { id: 'u3', client_name: 'Fox & Fern', nickname: null, subject: 'Brand shoot quote', unread_count: 3, last_message_at: iso(1.2) },
    { id: 'u4', client_name: 'Nova Group', nickname: null, subject: 'Event coverage — Dec 6', unread_count: 1, last_message_at: iso(2.1) },
  ]
}
export function demoReplyUsage() { return { used: 0, maxAllowed: 0, unlimited: true, rpcMissing: false } }

// ---- Reviews ----
export function demoReviews() {
  const names = ['Harper M.', 'Jack T.', 'Priya S.', 'Liam O.', 'Chloe R.', 'Daniel K.', 'Aisha N.', 'Tom W.', 'Grace L.', 'Ben C.', 'Mia D.', 'Noah P.', 'Ella F.', 'Ryan H.']
  return names.map((n, i) => ({ rating: i % 7 === 0 ? 4 : 5, created_at: iso(i * 12 + 3), client_name: n, reviewer_name: n }))
}

// ---- Deliverables ----
export function demoDeliverables() {
  return [
    { id: 'd1', client_name: 'Harper & Jack', title: 'Wedding gallery — full edit', due_date: dstr(-2), status: 'editing', created_at: iso(6), delivered_at: null },
    { id: 'd2', client_name: 'Coastal Realty', title: '24 Marine Pde listing photos', due_date: dstr(1), status: 'editing', created_at: iso(3), delivered_at: null },
    { id: 'd3', client_name: 'Atlas Media', title: 'Corporate headshots — retouched', due_date: dstr(3), status: 'ready', created_at: iso(4), delivered_at: null },
    { id: 'd4', client_name: 'The Bloom Co', title: 'Brand shoot selects', due_date: dstr(5), status: 'ready', created_at: iso(5), delivered_at: null },
    { id: 'd5', client_name: 'Nova Group', title: 'Event highlights reel', due_date: dstr(9), status: 'delivered', created_at: iso(20), delivered_at: iso(8) },
    { id: 'd6', client_name: 'Meridian Co', title: 'Portrait session gallery', due_date: dstr(14), status: 'delivered', created_at: iso(24), delivered_at: iso(13) },
  ]
}

// ---- Search visibility ----
export function demoProfileViews() {
  const sources = ['search', 'search', 'explore', 'profile', 'direct']
  const rows = []
  for (let day = 0; day < 84; day++) {
    // more recent days busier
    const n = 1 + Math.round((84 - day) / 22) + (day % 3 === 0 ? 1 : 0)
    for (let i = 0; i < n; i++) rows.push({ created_at: iso(day + i * 0.01), source: sources[(day + i) % sources.length] })
  }
  return rows
}
export function demoSearchImpressions() {
  const rows = []
  for (let day = 0; day < 84; day++) {
    const n = 4 + Math.round((84 - day) / 10)
    for (let i = 0; i < n; i++) rows.push({ created_at: iso(day + i * 0.005) })
  }
  return rows
}
export function demoVisibilityStanding() { return { skill: 'Photography', state: 'QLD', rank: 3, total: 47 } }

// ---- Profile strength ----
export function demoProfile() {
  return {
    business_name: 'Golden Hour Studio', tagline: "Brisbane's storytelling wedding & brand photographer",
    bio: 'We capture warm, timeless imagery for weddings, brands and families across South East Queensland. Ten years behind the lens and every gallery delivered with care.',
    phone: '0400 000 000', website: 'goldenhourstudio.com.au', avatar_url: 'demo',
    city: 'Brisbane', state: 'QLD', skill_types: ['Photography', 'Videography'], specialties: ['Weddings', 'Portraits', 'Brand'],
    instagram_url: 'https://instagram.com/demo', tiktok_url: null, linkedin_url: 'https://linkedin.com/in/demo', facebook_url: null, twitter_url: null,
  }
}
export const demoPortfolioCount = 9

// ---- To-dos ----
export function demoTasks(kind) {
  if (kind === 'daily') return [
    { id: 't1', title: 'Cull Harper & Jack wedding', done: false, kind }, { id: 't2', title: 'Send Coastal Realty invoice', done: false, kind },
    { id: 't3', title: 'Reply to Fox & Fern enquiry', done: false, kind }, { id: 't4', title: 'Back up Saturday shoot', done: true, kind }, { id: 't5', title: 'Charge camera batteries', done: true, kind },
  ]
  return [
    { id: 'w1', title: 'Edit Nova Group highlights reel', done: false, kind }, { id: 'w2', title: 'Plan November content', done: false, kind },
    { id: 'w3', title: 'Update pricing guide', done: true, kind }, { id: 'w4', title: 'Order new prints', done: true, kind }, { id: 'w5', title: 'Confirm December bookings', done: true, kind },
  ]
}

// ---- Calendar / Upcoming events ----
export function demoEvents() {
  const c1 = '#1DB954', c2 = '#FF2D78', c3 = '#38bdf8', c4 = '#a855f7'
  return [
    { id: 'e1', title: 'Harper & Jack wedding', event_date: dstr(-1), start_time: '13:00', end_time: '21:00', all_day: false, location: 'Maleny', color: c2, notes: '', invitees: [] },
    { id: 'e2', title: 'Coastal Realty shoot', event_date: dstr(-2), start_time: '09:00', end_time: '11:00', all_day: false, location: '24 Marine Pde', color: c3, notes: '', invitees: [] },
    { id: 'e3', title: 'Atlas Media headshots', event_date: dstr(-3), start_time: '10:00', end_time: '13:00', all_day: false, location: 'Studio', color: c1, notes: '', invitees: [] },
    { id: 'e4', title: 'The Bloom Co brand shoot', event_date: dstr(-4), start_time: '08:30', end_time: '12:30', all_day: false, location: 'West End', color: c4, notes: '', invitees: [] },
    { id: 'e5', title: 'Consult — Sunday Lane', event_date: dstr(-5), start_time: '15:00', end_time: '15:45', all_day: false, location: 'Zoom', color: c3, notes: '', invitees: [] },
    { id: 'e6', title: 'Portrait session', event_date: dstr(-6), start_time: '16:30', end_time: '18:00', all_day: false, location: 'New Farm Park', color: c2, notes: '', invitees: [] },
  ]
}
