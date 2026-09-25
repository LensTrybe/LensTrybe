// The one profile checklist, used by Today, Edit profile and Insights. Same items and the same
// counting as the live site's profileCompleteness.js, plus packages and availability, which the
// ask bar and Lumi need before they can quote or hold a date.
const has = v => v != null && String(v).trim() !== ''
export const BIO_MIN = 80, PORTFOLIO_MIN = 8

export function completeness(s) {
  const p = s.profile || {}, b = s.brand || {}, st = s.settings || {}, A = s.avail || {}
  const shots = (p.shots || []).length
  const items = [
    { key: 'photo', label: 'Add a profile photo', hint: 'Appear in search and on the home page', to: '/app/profile', done: has(p.avatar) },
    { key: 'name', label: 'Add your business name', hint: 'How clients find you', to: '/app/brand-kit', done: has(b.name) },
    { key: 'tagline', label: 'Write a tagline', hint: 'One line that sells you', to: '/app/profile', done: has(p.h) },
    { key: 'bio', label: 'Write your bio', hint: 'At least ' + BIO_MIN + ' characters', to: '/app/profile', done: has(p.bio) && p.bio.trim().length >= BIO_MIN },
    { key: 'contact', label: 'Add contact details', hint: 'Phone or website', to: '/app/profile', done: has(p.ph) || has(st.phone) || has(p.web) },
    { key: 'skills', label: 'Choose your skills', hint: 'Photographer, videographer or both', to: '/app/profile', done: has(p.disc) },
    { key: 'specialties', label: 'Add your specialties', hint: 'What you shoot', to: '/app/profile', done: (p.kinds || []).length > 0 },
    { key: 'location', label: 'Set your location', hint: 'Suburb and state', to: '/app/profile', done: has(p.city) },
    { key: 'social', label: 'Link a social account', hint: 'Instagram, TikTok and more', to: '/app/channels', done: has(p.ig) || (s.channels || []).some(c => c.on) },
    { key: 'portfolio', label: 'Upload ' + PORTFOLIO_MIN + '+ portfolio pieces', hint: shots + ' added so far', to: '/app/profile', done: shots >= PORTFOLIO_MIN },
    { key: 'packages', label: 'Set your packages', hint: 'Lumi quotes from these', to: '/app/profile', done: (s.packages || []).some(x => Number(x[1]) > 0) },
    { key: 'availability', label: 'Set your availability', hint: 'Days, radius, buffers', to: '/app/availability', done: !!A.touched },
  ]
  const done = items.filter(i => i.done).length
  return { items, total: items.length, done, pct: Math.round(done / items.length * 100), remaining: items.length - done, complete: done === items.length }
}
