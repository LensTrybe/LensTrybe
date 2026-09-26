// Sample data for Mara's workspace. Every page reads from the store, which starts from this and then
// keeps whatever you do in the browser. Nothing here is real.
import { THREADS, THREAD_DETAIL, ACTIONS, PLANS } from './workspace'

const G = { blue: 'linear-gradient(135deg,#2c3a5e,#7fa8e8)', green: 'linear-gradient(135deg,#1c452f,#7fd0aa)', plum: 'linear-gradient(135deg,#472657,#c6a5e5)', rose: 'linear-gradient(135deg,#3d2450,#d996ba)', teal: 'linear-gradient(135deg,#283047,#9ac4c5)', peach: 'linear-gradient(135deg,#f6ccb0,#efab82)' }

// A year of enquiries and daily visibility, the shape the Supabase tables will hold. Deterministic so the
// Insights page reads the same on every load; Insights also folds in the live threads, ledger and reviews.
const rnd = (() => { let x = 20260922; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648 } })()
const pick = (a, w) => { const r = rnd() * w.reduce((s, x) => s + x, 0); let acc = 0; for (let i = 0; i < a.length; i++) { acc += w[i]; if (r < acc) return a[i] } return a[a.length - 1] }
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
const SRCS = ['Ask bar', 'Your website', 'Google', 'Instagram', 'Referral', 'Passed on', 'Repeat client']
const TYPES = { Wedding: [2600, 4200, 0.19], 'Real estate': [280, 1200, 0.3], Headshots: [280, 620, 0.12], Event: [1200, 3600, 0.13], Brand: [900, 2400, 0.14], Family: [420, 780, 0.12] }
const NAMES = ['Ava M.', 'Noah T.', 'Isla B.', 'Leo K.', 'Mia R.', 'Oscar P.', 'Zoe H.', 'Hugo D.', 'Ruby S.', 'Finn W.', 'Ivy C.', 'Max L.', 'Ella J.', 'Kai N.', 'Chloe F.', 'Archie G.', 'Willow A.', 'Jack V.', 'Sienna O.', 'Harvey E.', 'Bayside Realty', 'Northshore Café', 'Hinterland Homes', 'Sunline Property', 'Coastline Realty', 'Blackwood Events', 'Peak Physio', 'Ridge Legal']
const ENQ = []; let en = 0
for (let m = 0; m < 12; m++) { const y = m < 3 ? 2025 : 2026, mo = (m + 9) % 12; const n = [7, 6, 9, 5, 6, 8, 9, 8, 10, 11, 12, 13][m]
  for (let i = 0; i < n; i++) { const day = 1 + Math.floor(rnd() * 27); if (y === 2026 && mo === 8 && day > 22) continue
    const src = pick(SRCS, [38, 21, 17, 12, 8, 2, 9]); const type = pick(Object.keys(TYPES), [26, 30, 12, 8, 12, 12]); const [lo, hi, m1] = TYPES[type]
    const v = Math.round((lo + rnd() * (hi - lo)) / 10) * 10
    const reply = pick([0.4, 2, 6, 20, 48, 96], src === 'Ask bar' ? [40, 30, 15, 10, 4, 1] : [22, 28, 20, 18, 8, 4])
    const base = { 'Ask bar': 0.46, 'Your website': 0.4, Google: 0.3, Instagram: 0.24, Referral: 0.62, 'Passed on': 0.5, 'Repeat client': 0.82 }[src] * (reply <= 2 ? 1.35 : reply <= 20 ? 1 : 0.6)
    const quoted = rnd() < 0.86; const booked = quoted && rnd() < base; const lead = Math.round(type === 'Wedding' ? 90 + rnd() * 240 : type === 'Real estate' ? 3 + rnd() * 12 : 10 + rnd() * 50)
    const d = new Date(y, mo, day); const job = new Date(d); job.setDate(job.getDate() + lead); if (type === 'Wedding' || (type === 'Family' && rnd() < 0.7)) job.setDate(job.getDate() + ((6 - job.getDay() + 7) % 7)); const done = booked && job <= new Date(2026, 8, 22)
    ENQ.push({ id: 'en' + (++en), d: ymd(d), src, type, v, reply, quoted, st: done ? 'delivered' : booked ? 'booked' : quoted ? 'quoted' : 'enquired', lost: !booked && d < new Date(2026, 7, 20) ? pick(['Price', 'Date taken', 'Went quiet', 'Chose someone else'], [35, 20, 30, 15]) : '', job: ymd(job), who: src === 'Repeat client' ? pick(NAMES.slice(20), [4, 3, 1, 1, 6, 2, 1, 1]) : NAMES[Math.floor(rnd() * 20)], repeat: src === 'Repeat client', reviewed: done && rnd() < 0.55, days: booked ? Math.round(1 + rnd() * 14) : 0, dep: booked && rnd() < 0.9 }) } }
const VIEWS = Array.from({ length: 365 }, (_, i) => { const d = new Date(2025, 8, 23 + i); const w = d.getDay(); const grow = 1 + i / 365 * 1.4; const s = { '2026-09-08': 3, '2026-09-18': 1.8, '2026-06-14': 1.6, '2026-03-02': 1.5 }[ymd(d)] || 1
  return { d: ymd(d), profile: Math.round((14 + (i * 7) % 11 + (w === 0 || w === 6 ? 6 : 0)) * grow * s), site: Math.round((22 + (i * 5) % 17 + (w === 0 ? 8 : 0)) * grow * s), search: Math.round((40 + (i * 3) % 23) * grow), ask: Math.round((2 + (i * 3) % 4) * grow * s / 1.6) } })

export const SEED = {
  threads: THREADS.map(t => ({ ...t, line: (THREAD_DETAIL[t.id] || {}).line || [{ sys: 'Thread opened' }, { lumi: t.next }], job: (THREAD_DETAIL[t.id] || {}).job || [['Package', t.j], ['Date', t.d]], docs: (THREAD_DETAIL[t.id] || {}).docs || [], s: (THREAD_DETAIL[t.id] || {}).s || t.j + ' · ' + t.d })),
  actions: ACTIONS,
  // time is HH:MM, dur is minutes or 'day', end is the last day of a multi-day booking, rep repeats it
  events: [
    { id: 'e1', d: '2026-09-12', k: 'd', n: 'Marcus P. · headshots', s: 'Delivered, review posted', time: '09:30', dur: 60, where: 'Studio', v: 380, t: 'marcus' },
    { id: 'e2', d: '2026-09-22', k: 'b', n: 'Coastline Realty · 3 listings', s: '10:00 · Noosa Heads · leave by 9:20', time: '10:00', dur: 180, where: 'Noosa Heads', addr: '14 Hastings St, Noosa Heads', v: 1026, t: 'coastline', rep: 'monthly', until: '2027-03-31' },
    { id: 'e3', d: '2026-09-26', k: 'x', n: 'Day off' },
    { id: 'e4', d: '2026-10-03', k: 'p', n: 'Northshore Café · brand shoot', s: 'Pencilled until the quote is accepted', hold: '2026-09-29', time: '08:00', dur: 240, where: 'Northshore Café', addr: 'Gympie Tce, Noosaville', v: 1800, t: 'northshore' },
    { id: 'e5', d: '2026-10-17', k: 'b', n: 'Ana and Tom · album shoot', s: 'Sunshine Beach · 2 hours', time: '16:00', dur: 120, where: 'Sunshine Beach', v: 640, t: 'ana' },
    { id: 'e6', d: '2026-10-24', k: 'x', n: 'Editing' }, { id: 'e7', d: '2026-11-03', k: 'x', n: 'Away', end: '2026-11-04' },
    { id: 'e9', d: '2026-11-07', k: 'b', n: 'Harper and Leo · wedding', s: 'Maleny Manor · full day · Sam second shooter', time: '09:30', dur: 'day', where: 'Maleny Manor', addr: '12 Ridge Rd, Maleny', v: 3200, t: 'harper', with: [{ em: 'sam@reidphoto.com' }] },
    { id: 'e10', d: '2026-11-08', k: 'b', n: 'Harper and Leo · day 2', s: 'Brunch and portraits', time: '10:00', dur: 120, where: 'Maleny Manor', v: 0, t: 'harper' },
    { id: 'e11', d: '2026-11-14', k: 'p', n: 'Coastline Realty · 3 listings', s: 'Pencilled until the quote is accepted', hold: '2026-09-26', time: '10:00', dur: 180, where: 'Noosa Heads', v: 1026, t: 'coastline' },
    { id: 'e12', d: '2026-11-21', k: 'b', n: 'Jess and Kai · elopement', s: 'Sunshine Beach · deposit due 24 Oct', time: '05:30', dur: 180, where: 'Sunshine Beach', v: 1400, t: 'jess' },
    { id: 'e13', d: '2026-11-28', k: 'b', n: 'Blackwood Events · conference', s: 'Conference · Brisbane · two days', time: '08:00', dur: 'day', end: '2026-11-29', where: 'Brisbane Convention Centre', addr: 'Merivale St, South Brisbane', v: 3600, t: 'blackwood', with: [{ em: 'priya@blackwoodevents.com' }] },
  ],
  ledger: [
    { id: 'INV-0221', k: 'inv', who: 'Blackwood Events', d: 'Deposit, conference', date: '2026-09-21', st: 'ok', stt: 'Paid', v: 1080, t: 'blackwood' },
    { id: 'Q-0418', k: 'q', who: 'Coastline Realty', d: '3 listings, bundle', date: '2026-09-20', st: 'viewed', stt: 'Viewed ×2', v: 1026, t: 'coastline' },
    { id: 'EXP-0092', k: 'exp', who: 'Sandisk 256GB ×2', d: 'Cards · JB Hi-Fi', date: '2026-09-19', st: 'grey', stt: 'Logged', v: -178, cat: 'Gear', gst: true, ded: true, pay: 'Card', proj: 'harper' },
    { id: 'Q-0419', k: 'q', who: 'Northshore Café', d: 'Brand shoot, menu', date: '2026-09-18', st: 'sent', stt: 'Sent', v: 1800, t: 'northshore' },
    { id: 'EXP-0091', k: 'exp', who: 'Fuel', d: 'Noosa to Maleny return · 128 km', date: '2026-09-15', st: 'grey', stt: 'Logged', v: -64, cat: 'Travel', gst: true, ded: true, pay: 'Card', proj: 'harper' },
    { id: 'INV-0218', k: 'inv', who: 'Ana and Tom', d: 'Album', date: '2026-09-12', st: 'ok', stt: 'Paid', v: 640, t: 'ana' },
    { id: 'EXP-0088', k: 'exp', who: 'Sam Reid · Second shooter', d: 'Ana and Tom · 8 Aug', date: '2026-08-22', st: 'grey', stt: 'Paid', v: -650, cat: 'Crew', gst: false, ded: true, pay: 'Transfer', proj: 'ana', cj: 'cj4' },
    { id: 'EXP-0087', k: 'exp', who: 'Ellie Chen · Editor', d: 'Ana and Tom · cull and colour', date: '2026-08-22', st: 'grey', stt: 'Paid', v: -175, cat: 'Crew', gst: false, ded: true, pay: 'Transfer', proj: 'ana', cj: 'cj5' },
    { id: 'EXP-0090', k: 'exp', who: 'Adobe Creative Cloud', d: 'Monthly', date: '2026-09-10', st: 'grey', stt: 'Logged', v: -87, cat: 'Software', gst: true, ded: true, pay: 'Direct debit', proj: '' },
    { id: 'INV-0217', k: 'inv', who: 'Marcus P.', d: 'Headshots', date: '2026-09-09', st: 'ok', stt: 'Paid', v: 380, t: 'marcus' },
    { id: 'C-0421', k: 'c', who: 'Blackwood Events', d: 'Event template, 2 days', date: '2026-09-21', st: 'grey', stt: 'Draft', v: 3600, t: 'blackwood' },
    { id: 'C-0412', k: 'c', who: 'Harper and Leo', d: '12 clauses, plain English', date: '2026-08-07', st: 'pink', stt: 'Signed', v: 3200, t: 'harper' },
    { id: 'INV-0220', k: 'inv', who: 'Harper and Leo', d: 'Balance · reminder 31 Oct', date: '2026-11-07', st: 'sent', stt: 'Scheduled', v: 2240, t: 'harper' },
    { id: 'INV-0219', k: 'inv', who: 'Harper and Leo', d: 'Deposit', date: '2026-08-07', st: 'ok', stt: 'Paid', v: 960, t: 'harper' },
    { id: 'C-0415', k: 'c', who: 'Jess and Kai', d: 'Elopement template', date: '2026-08-30', st: 'pink', stt: 'Signed', v: 1400, t: 'jess' },
    { id: 'C-0409', k: 'c', who: 'Coastline Realty', d: 'Agency terms, their paper', date: '2026-07-14', st: 'pink', stt: 'Signed', v: 0, t: 'coastline', up: { name: 'Coastline-Realty-supplier-agreement.pdf', size: 184320, type: 'application/pdf' } },
    { id: 'INV-0216', k: 'inv', who: 'Coastline Realty', d: '4 listings, August', date: '2026-08-28', st: 'ok', stt: 'Paid', v: 1520, t: 'coastline' },
  ],
  people: [
    { id: 'harper', n: 'Harper Ellis', co: 'Harper and Leo', t: 'Wedding · Maleny', kind: 'Wedding', j: 1, v: 3200, l: '2026-11-07', tags: ['Wedding', 'Referral: Ana'], g: G.blue, em: 'harper.ellis@gmail.com', ph: '0412 884 210', social: { ig: '@harperandleo' }, notes: 'Wants sunset portraits at 5:40. Mum is the emotional one, keep tissues. Sam is second shooter.', jobs: [['Wedding, full day', '7 Nov 2026', 3200, 'Booked']] },
    { id: 'coastline', n: 'Coastline Realty', co: 'Dean Marsh', t: 'Agency · Noosa Heads', kind: 'Real estate', j: 5, v: 6420, l: '2026-09-22', tags: ['Real estate', 'Monthly'], g: G.green, em: 'dean@coastlinerealty.com.au', ph: '07 5447 1200', social: { ig: '@coastlinerealty', web: 'coastlinerealty.com.au' }, notes: 'Three to four listings a month. Likes twilight exteriors. Pays within a week when invoiced from the thread.', jobs: [['3 listings', '22 Sep 2026', 1026, 'Today'], ['3 listings', '14 Nov 2026', 1026, 'Pencilled'], ['4 listings', '28 Aug 2026', 1520, 'Paid'], ['2 listings', '19 Jul 2026', 720, 'Paid'], ['4 listings', '12 Jun 2026', 1520, 'Paid']] },
    { id: 'blackwood', n: 'Blackwood Events', co: 'Priya Nair', t: 'Events · Brisbane', kind: 'Event', j: 2, v: 5100, l: '2026-11-28', tags: ['Conference', 'Pays late'], g: G.plum, em: 'priya@blackwoodevents.com', ph: '0433 019 664', notes: 'Two day conference every November. Chased twice last year, paid on day 9. Lumi chases from day 3 now.', jobs: [['Conference, 2 days', '28 Nov 2026', 3600, 'Deposit paid'], ['Awards night', '14 Nov 2025', 1500, 'Paid']] },
    { id: 'ana', n: 'Ana and Tom', co: 'Ana Ferreira', t: 'Wedding · Sunshine Beach', kind: 'Wedding', j: 2, v: 3540, l: '2026-09-12', tags: ['Wedding', 'Album'], g: G.rose, em: 'ana.ferreira@outlook.com', ph: '0401 553 778', notes: 'Referred Harper. Album selection call today at 2:30. Would love a first anniversary session.', jobs: [['Album', '12 Sep 2026', 640, 'Paid'], ['Wedding, full day', '8 Aug 2026', 2900, 'Delivered']] },
    { id: 'ruby', n: 'Ruby and Sol', co: 'Ruby Tan', t: 'Enquiry · Mar 2027', kind: 'Wedding', j: 0, v: 0, l: '2026-09-22', tags: ['Wedding', 'New'], g: G.teal, em: 'rubytan@me.com', ph: '', notes: 'Found you on LensTrybe. Loves the Maleny work. 13 March 2027, probably.', jobs: [] },
    { id: 'northshore', n: 'Northshore Café', co: 'Leo Brandt', t: 'Hospitality · Noosa', kind: 'Brand', j: 0, v: 0, l: '2026-09-18', tags: ['Brand', 'Menu'], g: G.peach, em: 'hello@northshorecafe.com.au', ph: '07 5449 8811', notes: 'New menu launches October. Quote sent 18 Sep, valid nine days.', jobs: [] },
    { id: 'jess', n: 'Jess and Kai', co: 'Jess Morgan', t: 'Elopement · Sunshine Beach', kind: 'Wedding', j: 1, v: 1400, l: '2026-11-21', tags: ['Elopement'], g: G.rose, em: 'jessmorgan@gmail.com', ph: '0422 907 315', notes: 'Just the two of them plus a celebrant. Deposit due 24 Oct.', jobs: [['Elopement', '21 Nov 2026', 1400, 'Signed']] },
    { id: 'marcus', n: 'Marcus P.', co: 'Marcus Petrou', t: 'Headshots · Brisbane', kind: 'Headshots', j: 1, v: 380, l: '2026-09-09', tags: ['Headshots', 'Review posted'], g: G.green, em: 'm.petrou@gmail.com', ph: '', notes: 'LinkedIn headshots. Left a five star review. Works at a firm of forty, could refer.', jobs: [['Headshots', '9 Sep 2026', 380, 'Paid']] },
  ],
  // Pipeline stages are the creative's own: rename, recolour, reorder, add, delete. Seeded once.
  stages: [
    { id: 'enq', n: 'New enquiry', c: 'grey' }, { id: 'quote', n: 'Quote sent', c: 'blue' }, { id: 'booked', n: 'Booked', c: 'mint' },
    { id: 'prog', n: 'In progress', c: 'amber' }, { id: 'deliv', n: 'Delivered', c: 'plum' }, { id: 'done', n: 'Complete', c: 'green' },
  ],
  // Checklists a project starts from. Shot lists, packing, admin; the creative saves their own.
  checklistTemplates: [
    { id: 'wed', n: 'Wedding day', items: ['Getting ready · both', 'First look', 'Ceremony, wide and tight', 'Family groups', 'Sunset portraits', 'Reception, first dance', 'Speeches'] },
    { id: 're', n: 'Real estate listing', items: ['Exterior, front', 'Living areas', 'Kitchen', 'Every bedroom', 'Bathrooms', 'Outdoor and pool', 'Twilight exterior'] },
    { id: 'evt', n: 'Corporate event', items: ['Venue and signage before doors', 'Keynote', 'Breakouts', 'Sponsor wall, every logo', 'Networking, candid', 'Headshot booth'] },
    { id: 'admin', n: 'Before the shoot', items: ['Contract signed', 'Deposit paid', 'Call sheet sent', 'Batteries charged, cards formatted', 'Route and parking checked'] },
  ],
  // A project is the job as a job: stage, brief, checklists, crew, gear, files, and everything the
  // thread, ledger, calendar and galleries know about it. t is the thread (and client) it belongs to.
  projects: [
    { id: 'harper', n: 'Harper and Leo · wedding', c: 'Harper Ellis', d: '2026-11-07', at: 'Maleny Manor', k: 'live', stage: 'booked', type: 'Wedding', src: 'Referral · Ana', v: 3200, paid: 960, m: 'golden', s: 3, t: 'harper', crew: ['Sam · second shooter'], gear: [1, 2, 3, 4, 11], brief: 'Full day, 90 guests. Ceremony 2:00 on the lawn, sunset portraits 5:40 on the ridge. Documentary style, minimal posing. Harper\'s mum is the emotional one.', lists: [{ id: 'l1', n: 'Shot list', items: [['Getting ready · both', 0], ['First look on the ridge', 0], ['Ceremony, wide and tight', 0], ['Family groups (list from Harper)', 0], ['Sunset portraits, 5:40', 0], ['Reception, first dance', 0]] }, { id: 'l2', n: 'Before the day', items: [['Contract signed', 1], ['Deposit paid', 1], ['Call sheet sent', 0], ['Sam confirmed', 1]] }], tasks: [['Send call sheet Thursday', 0, '2026-11-05'], ['Family groups list from Harper', 0, '2026-10-30'], ['Sensor clean on the R5', 0, '2026-11-03']], files: [['Run sheet', 'PDF · from Harper'], ['Family groups', 'Notes · 8 groups'], ['Sneak peek', '20 photos · sent']], log: [['Today, 8:01', 'Harper opened the sneak peek'], ['7 Aug', 'Deposit paid · INV-0219'], ['7 Aug', 'Contract signed · C-0412'], ['6 Oct 2025', 'Enquiry via LensTrybe']] },
    { id: 'coastline', n: 'Coastline Realty · 3 listings', c: 'Dean Marsh', d: '2026-09-22', at: 'Noosa Heads', k: 'live', stage: 'prog', type: 'Real estate', src: 'Repeat client', v: 1026, paid: 0, m: 'cool', s: 5, t: 'coastline', crew: [], gear: [1, 6, 9], brief: 'Three listings back to back from 10:00. Twilight exterior on the Hastings Street one if the sky plays.', lists: [{ id: 'l1', n: 'Listings', items: [['14 Hastings St · 25 frames', 1], ['2/8 Noosa Pde · 18 frames', 1], ['31 Park Rd · 22 frames + twilight', 0]] }], tasks: [['Deliver by Thursday', 0, '2026-09-24'], ['Invoice on delivery', 0, '2026-09-24']], files: [['Addresses and keys', 'Note'], ['August delivery', 'Gallery · 96 photos']], log: [['Today, 10:00', 'Shoot day'], ['20 Sep', 'Quote Q-0418 viewed twice'], ['Sun', 'Dean asked for three listings']] },
    { id: 'blackwood', n: 'Blackwood Events · conference', c: 'Priya Nair', d: '2026-11-28', at: 'Brisbane Convention Centre', k: 'live', stage: 'booked', type: 'Event', src: 'Repeat client', v: 3600, paid: 1080, m: 'night', s: 21, t: 'blackwood', crew: [], gear: [1, 2, 3, 7, 10], brief: 'Two days, 200 people. Keynotes, breakouts, sponsor wall, headshot booth on day two.', lists: [{ id: 'l1', n: 'Coverage', items: [['Keynote, day 1', 0], ['Breakouts · 6 rooms', 0], ['Sponsor wall, every logo', 0], ['Headshot booth, day 2', 0], ['Networking drinks', 0]] }], tasks: [['Send contract C-0421', 0, '2026-09-24'], ['Run sheet from Priya', 0, '2026-10-15'], ['Book Tane for the film', 0, '2026-10-01']], files: [['Contract', 'Draft · C-0421'], ['Run sheet', 'Waiting on Priya']], log: [['Today, 6:52', 'Deposit paid · INV-0221'], ['Today, 6:53', 'Priya asked for the contract'], ['1 Sep', 'Booked, two days']] },
    { id: 'jess', n: 'Jess and Kai · elopement', c: 'Jess Morgan', d: '2026-11-21', at: 'Sunshine Beach', k: 'live', stage: 'booked', type: 'Elopement', src: 'Google', v: 1400, paid: 0, m: 'dusk', s: 17, t: 'jess', crew: [], gear: [1, 5], brief: 'Just the two of them plus a celebrant. Sunrise on the beach, breakfast after.', lists: [{ id: 'l1', n: 'Shot list', items: [['Sunrise vows', 0], ['Beach portraits', 0], ['Breakfast, candid', 0]] }], tasks: [['Deposit due 24 Oct', 0, '2026-10-24']], files: [['Contract', 'Signed · C-0415']], log: [['30 Aug', 'Contract signed · C-0415'], ['4 Sep', 'Booked on the call']] },
    { id: 'northshore', n: 'Northshore Café · brand shoot', c: 'Leo Brandt', d: '2026-10-03', at: 'Northshore Café', k: 'live', stage: 'quote', type: 'Brand', src: 'Instagram', v: 1800, paid: 0, m: 'rose', s: 25, t: 'northshore', crew: ['Tane · film, if quoted'], gear: [], brief: 'New menu and the room. Half day, natural light, a short film if the quote allows.', lists: [], tasks: [['Chase the quote Friday', 0, '2026-09-25']], files: [], log: [['18 Sep', 'Quote Q-0419 sent'], ['17 Sep', 'Discovery call with Leo']] },
    { id: 'ruby', n: 'Ruby and Sol · wedding', c: 'Ruby Tan', d: '2027-03-13', at: 'Maleny', k: 'live', stage: 'enq', type: 'Wedding', src: 'LensTrybe', v: 3200, paid: 0, m: 'cool', s: 29, t: 'ruby', crew: [], gear: [], brief: '', lists: [], tasks: [['Reply with the quote', 0, '2026-09-23']], files: [], log: [['Today, 6:41', 'Enquiry via LensTrybe']] },
    { id: 'ana', n: 'Ana and Tom · wedding', c: 'Ana Ferreira', d: '2026-08-08', at: 'Sunshine Beach', k: 'done', stage: 'done', type: 'Wedding', src: 'Google', v: 2900, paid: 2900, m: 'rose', s: 9, t: 'ana', crew: [], gear: [], brief: 'Delivered. Album in proof.', lists: [{ id: 'l1', n: 'Shot list', items: [['Everything', 1]] }], tasks: [['Album order to the lab', 1, '2026-09-13']], files: [['Gallery', '388 photos · 1 film'], ['Album proof', 'Approved 12 Sep']], log: [['12 Sep', 'Album proof approved'], ['22 Aug', 'Delivered · 388 photos, 1 film'], ['8 Aug', 'Shoot day']] },
    { id: 'marcus', n: 'Marcus P. · headshots', c: 'Marcus Petrou', d: '2026-09-09', at: 'Studio', k: 'done', stage: 'done', type: 'Headshots', src: 'Google', v: 380, paid: 380, m: 'forest', s: 13, t: 'marcus', crew: [], gear: [], brief: 'Delivered. Review posted.', lists: [{ id: 'l1', n: 'Frames', items: [['24 frames', 1]] }], tasks: [], files: [['Gallery', '24 photos']], log: [['12 Sep', 'Five star review'], ['9 Sep', 'Delivered · 24 photos']] },
  ],
  notes: [
    { id: 1, t: 'Harper and Leo · family groups', on: 'Harper and Leo', to: '/app/thread/harper', w: 'Today, 8:20', body: 'Eight groups, Harper is sending names. Grandparents first (Leo\'s nan uses a walker). Do the big group on the lawn before drinks. Mum is the emotional one, keep tissues.' },
    { id: 2, t: 'Coastline · keys and access', on: 'Coastline Realty', to: '/app/thread/coastline', w: 'Yesterday', body: '14 Hastings: lockbox 4471, code changes weekly.\n2/8 Noosa Pde: tenant home, knock.\n31 Park Rd: vacant, key under the pot (Dean says). Twilight here if the sky plays.' },
    { id: 3, t: 'Christmas minis idea', on: '', to: '', w: 'Sunday', body: '23 Nov to 6 Dec. 20 minute sessions, 5 a day, $250. Sunrise at Noosa Main Beach or the Maleny paddock. Lumi has six families from last year lined up.' },
    { id: 4, t: 'Gear to service', on: '', to: '', w: 'Last week', body: 'R5 sensor clean before Harper. 70-200 focus ring sticky, book in. Order two more 256 cards (done).' },
    { id: 5, t: 'Blackwood · headshot booth', on: 'Blackwood Events', to: '/app/thread/blackwood', w: '12 Sep', body: 'Day two, 10 to 3. Grey backdrop, two lights, 60 people at 3 min each. Priya wants same day web-size for LinkedIn.' },
  ],
  // Gear categories are the creative's own. Add, rename, remove; the list and the forms follow.
  // Contract templates: plain English, the creative's own. Parties and the job sit above the clauses, so the
  // text stays generic: "the Photographer" and "the Client".
  contractTemplates: [
    { id: 'tpl-wedding', n: 'Wedding · 12 clauses', title: 'Wedding photography agreement', sub: 'Full day, plain English, the one most couples sign in under two minutes.', clauses: [
      ['The day', 'The Photographer will photograph the wedding on the date and at the locations shown above, for the hours shown. Extra hours on the day are charged at the hourly rate in the quote and invoiced after.'],
      ['What you get', 'A private online gallery of edited, high resolution photographs within eight weeks of the wedding. The number of photographs depends on the day; a full day is usually 500 to 800. A sneak peek of at least ten images arrives within a week.'],
      ['Payment', 'The deposit shown above books the date and is not refundable. The balance is due seven days before the wedding. Nothing is delivered until the balance is paid.'],
      ['If plans change', 'You can move the date once at no charge if the Photographer is free on the new date. If not, the deposit is kept and the balance is not owed. If you cancel, the deposit is kept; cancellations inside 30 days of the wedding owe the full balance.'],
      ['If the Photographer cannot make it', 'In the rare event of serious illness or emergency, the Photographer will find a replacement of similar style and experience at no extra cost, or refund everything paid.'],
      ['Your photos, your use', 'You receive a personal use licence: print, share, post and make albums as you like. Please credit the Photographer where it is easy to. Selling the photographs or licensing them to a business needs a separate commercial licence.'],
      ['The Photographer\'s use', 'The Photographer keeps copyright and may use the photographs for their portfolio, website, social media and competitions. Say in writing before the wedding if you would rather they were kept private and we will agree what is off limits.'],
      ['Style and creative control', 'You booked the Photographer for their style. Editing, colour and selection are theirs to decide, and raw files are not supplied.'],
      ['Meals and breaks', 'For bookings over six hours, please provide a meal for the Photographer and any second shooter at the same time guests eat.'],
      ['Other people with cameras', 'Guests are welcome to take photographs, but the Photographer needs a clear view for the ceremony and formal portraits. Please ask the celebrant to mention an unplugged ceremony if you would like one.'],
      ['Backups and the unexpected', 'Every image is written to two cards in camera and backed up the same night. If images are lost through equipment failure beyond the Photographer\'s control, liability is limited to a refund of the fee for the part of the day affected.'],
      ['The boring but important bit', 'This agreement is governed by the laws of Queensland. Anything not covered here is settled by a chat first, in good faith.'],
    ] },
    { id: 'tpl-event', n: 'Event · 2 days', title: 'Event photography agreement', sub: 'Multi-day events, conferences and launches.', clauses: [
      ['Coverage', 'The Photographer will cover the event on the dates, at the venue and for the hours shown above. A run sheet from the Client at least three days before helps make sure nothing is missed.'],
      ['Delivery', 'A gallery of edited images arrives within ten business days. Same-day highlights for social media can be arranged at the rate in the quote.'],
      ['Payment', 'The deposit shown above confirms the booking. The balance is due seven days after the final day of the event.'],
      ['Changes and cancellation', 'Dates can be moved once at no charge, subject to availability. Cancellation inside 14 days of the event owes 50% of the balance; inside 7 days owes it in full.'],
      ['Licence', 'The Client receives a licence to use the images for internal communications, social media, press and the event\'s own marketing. Use in paid advertising needs to be agreed separately.'],
      ['Access and safety', 'The Client arranges access passes, parking and a safe working environment. The Photographer follows all reasonable venue instructions.'],
      ['Governing law', 'Queensland law applies. Disputes are talked through first, in good faith.'],
    ] },
    { id: 'tpl-elope', n: 'Elopement', title: 'Elopement photography agreement', sub: 'Short and sweet, for small ceremonies and adventure sessions.', clauses: [
      ['The session', 'The Photographer will photograph the elopement at the time, date and location shown above, for up to the hours shown.'],
      ['What you get', 'A private gallery of edited images within four weeks. A sneak peek arrives within three days.'],
      ['Payment', 'The deposit shown above holds the date. The balance is due seven days before.'],
      ['Weather and locations', 'Outdoor plans can change with the weather. We will agree a backup location or move the session to the next day the Photographer is free, at no charge.'],
      ['Your use, my use', 'You receive a personal use licence. The Photographer keeps copyright and may share the images in their portfolio unless you ask in writing that they stay private.'],
      ['Cancellation', 'The deposit is not refundable. Cancellation inside 14 days owes the full balance.'],
    ] },
    { id: 'tpl-brand', n: 'Brand and commercial', title: 'Commercial photography agreement', sub: 'Product, brand and campaign work with a defined licence.', clauses: [
      ['The brief', 'The Photographer will produce the images described above, following the brief agreed in writing before the shoot. Changes to the brief after the shoot are a new job.'],
      ['Delivery', 'Edited images are delivered within ten business days of the shoot. One round of reasonable revisions to the edit is included.'],
      ['Payment', 'The deposit shown above confirms the booking. The balance is due within 14 days of delivery. Images may not be published until the balance is paid.'],
      ['Licence', 'On full payment the Client receives a licence to use the images for the purposes, territories and term set out in the quote. Copyright stays with the Photographer. Extending the licence is by agreement.'],
      ['Usage credit', 'Where practical, please credit the Photographer in editorial and social use.'],
      ['Cancellation', 'Cancellation inside 7 days of the shoot owes 50% of the fee; inside 48 hours owes it in full. Costs already incurred (studio, props, crew) are reimbursed at cost.'],
      ['Liability', 'The Photographer\'s liability is limited to the fee paid for the job.'],
      ['Governing law', 'Queensland law applies.'],
    ] },
    { id: 'tpl-re', n: 'Real estate, ongoing', title: 'Real estate photography agreement', sub: 'Standing terms for an agency, listing by listing.', clauses: [
      ['The arrangement', 'The Photographer will photograph listings for the Client on request, at the per-listing rates in the quote. Each request is confirmed by message and appears on the shared calendar.'],
      ['Turnaround', 'Edited images are delivered by 9 am the next business day. Twilight and drone add-ons are delivered within two business days.'],
      ['Payment', 'Listings are invoiced weekly and due within 7 days.'],
      ['Preparation and access', 'The Client makes sure the property is styled and ready at the booked time. If a shoot cannot go ahead on arrival, a call-out fee of 50% applies.'],
      ['Licence', 'Images are licensed to the Client for marketing the listed property. Use for other purposes, or by third parties, needs a separate licence.'],
      ['Ending the arrangement', 'Either side can end this arrangement with 14 days notice. Work already booked is still completed and paid for.'],
    ] },
  ],
  // Expense categories: the creative's own, each with a colour for the money-went bars
  expCats: [['Gear', 'blue'], ['Software', 'plum'], ['Travel', 'amber'], ['Home office', 'green'], ['Marketing', 'rose'], ['Education', 'mint'], ['Insurance', 'blue'], ['Props and wardrobe', 'rose'], ['Contractors', 'amber'], ['Crew', 'plum'], ['Fees', 'grey'], ['Phone and internet', 'plum'], ['Other', 'grey']],
  gearCats: ['Bodies', 'Lenses', 'Lights', 'Drones', 'Audio', 'Support', 'Cards'],
  gear: [
    { id: 1, n: 'Canon R5', c: 'Bodies', sn: '013021004471', v: 5800, ins: 1, svc: '2026-10-30', note: 'Sensor clean before Harper. 41,200 shutter count.', kit: 1 },
    { id: 2, n: 'Canon R6 Mk II', c: 'Bodies', sn: '073034001185', v: 3900, ins: 1, svc: '2027-02-01', note: 'Second body. Sam uses this on weddings.', kit: 1 },
    { id: 3, n: 'RF 24-70 f/2.8', c: 'Lenses', sn: '9310002187', v: 3600, ins: 1, svc: '', note: '', kit: 1 },
    { id: 4, n: 'RF 70-200 f/2.8', c: 'Lenses', sn: '8420001093', v: 4200, ins: 1, svc: '2026-09-30', note: 'Focus ring sticky. Book in after Coastline.', kit: 1 },
    { id: 5, n: 'RF 50 f/1.2', c: 'Lenses', sn: '7710004421', v: 3500, ins: 1, svc: '', note: '', kit: 0 },
    { id: 6, n: 'RF 15-35 f/2.8', c: 'Lenses', sn: '6620003356', v: 3400, ins: 1, svc: '', note: 'Real estate interiors.', kit: 1 },
    { id: 7, n: 'Godox AD200 Pro ×2', c: 'Lights', sn: 'AD2-88142 / 88151', v: 1100, ins: 1, svc: '', note: '', kit: 0 },
    { id: 8, n: 'Godox V1', c: 'Lights', sn: 'V1-20034', v: 420, ins: 0, svc: '', note: 'Not on the policy yet.', kit: 0 },
    { id: 9, n: 'DJI Mini 4 Pro', c: 'Drones', sn: '1581F5X', v: 1600, ins: 1, svc: '', note: 'Sub-250g. CASA registered. Twilight exteriors.', kit: 1 },
    { id: 10, n: 'Rode Wireless Pro', c: 'Audio', sn: 'RWP-44120', v: 650, ins: 1, svc: '', note: 'Brand films and interviews.', kit: 0 },
    { id: 11, n: 'Peak Design tripod', c: 'Support', sn: '', v: 900, ins: 1, svc: '', note: '', kit: 1 },
    { id: 12, n: 'Sandisk 256GB ×6', c: 'Cards', sn: '', v: 540, ins: 0, svc: '', note: 'Two new, 19 Sep. Format after every delivery.', kit: 1 },
  ],
  galleries: [
    { id: 'harper', n: 'Harper and Leo', d: 'Wedding · Maleny Manor', k: 'live', files: 412, films: 2, gb: 18.4, p: 72, m: 'golden', s: 3, opened: 14, dl: 0, exp: 88, link: 'harperandleo.lenstrybe.com', t: 'harper', log: [['Today, 8:01', 'Harper opened the sneak peek'], ['Today, 7:30', 'Sneak peek sent · 20 photos'], ['Yesterday', 'Upload 72% · 298 of 412 photos'], ['7 Nov', 'Gallery created from the thread']] },
    { id: 'ana', n: 'Ana and Tom', d: 'Wedding · album proof', k: 'done', files: 388, films: 1, gb: 12.1, p: 100, m: 'rose', s: 9, opened: 31, dl: 2, exp: 41, link: 'anaandtom.lenstrybe.com', t: 'ana', log: [['12 Sep', 'Album proof approved'], ['2 Sep', 'Downloaded, full resolution'], ['22 Aug', 'Delivered · 388 photos, 1 film'], ['8 Aug', 'Gallery created from the thread']] },
    { id: 'coastline', n: 'Coastline Realty · August', d: '4 listings · 96 photos', k: 'done', files: 96, films: 0, gb: 2.3, p: 100, m: 'cool', s: 5, opened: 6, dl: 2, exp: 12, link: 'coastline-aug.lenstrybe.com', t: 'coastline', log: [['30 Aug', 'Downloaded twice, web size'], ['29 Aug', 'Delivered · 96 photos'], ['28 Aug', 'Gallery created']] },
    { id: 'marcus', n: 'Marcus P. headshots', d: '24 photos', k: 'done', files: 24, films: 0, gb: .6, p: 100, m: 'forest', s: 13, opened: 3, dl: 1, exp: 74, link: 'marcus-p.lenstrybe.com', t: 'marcus', log: [['12 Sep', 'Review posted, five stars'], ['10 Sep', 'Downloaded'], ['9 Sep', 'Delivered · 24 photos']] },
    { id: 'jess', n: 'Jess and Kai', d: 'Elopement · 21 Nov', k: 'wait', files: 0, films: 0, gb: 0, p: 0, m: 'dusk', s: 17, opened: 0, dl: 0, exp: 0, link: 'jessandkai.lenstrybe.com', t: 'jess', log: [['Ready', 'Gallery link reserved. Opens when you upload.']] },
    { id: 'northshore', n: 'Northshore Café', d: 'Brand shoot · quote open', k: 'wait', files: 0, films: 0, gb: 0, p: 0, m: 'night', s: 21, opened: 0, dl: 0, exp: 0, link: 'northshore.lenstrybe.com', t: 'northshore', log: [['Ready', 'Gallery link reserved. Opens when you upload.']] },
  ],
  meetings: [
    { id: 1, who: 'Ana and Tom', t: 'album', when: '2026-09-23T14:30', how: 'Video', st: 'today', th: 'ana', prep: 'Album proof approved 12 Sep. They want two extra spreads of the speeches. Ana mentioned a first anniversary session, worth raising.', g: G.rose },
    { id: 2, who: 'Ruby and Sol', t: 'disc', when: '2026-09-24T17:00', how: 'Video', st: 'up', th: 'ruby', prep: 'New enquiry from Monday. 13 March 2027 at Maleny, probably. Quote drafted at $3,200 Full day, not sent. They loved the Maleny work, so lead with that.', g: G.teal },
    { id: 3, who: 'Priya Nair · Blackwood', t: 'plan', when: '2026-09-29T10:00', how: 'Phone', st: 'up', th: 'blackwood', prep: 'Two day conference, 28 to 29 Nov. Still waiting on the run sheet. Contract C-0421 is drafted and unsent, get it across before the call.', g: G.plum },
    { id: 4, who: 'Harper Ellis', t: 'plan', when: '2026-10-15T18:00', how: 'Video', st: 'up', th: 'harper', prep: 'Final run through three weeks out. Family groups list, sunset timing 5:40, Sam confirmed.', g: G.blue },
    { id: 5, who: 'Leo Brandt · Northshore', t: 'disc', when: '2026-09-17T11:00', how: 'Phone', st: 'done', th: 'northshore', prep: 'Menu launch in October. Quote Q-0419 sent the day after, valid nine days.', g: G.peach },
    { id: 6, who: 'Marcus Petrou', t: 'disc', when: '2026-09-02T09:30', how: 'Phone', st: 'done', th: 'marcus', prep: 'Headshots, booked on the call.', g: G.green },
  ],
  meetingTypes: [
    { id: 'disc', n: 'Discovery call', m: 20, d: 'For new enquiries. Video or phone.', on: 1 },
    { id: 'plan', n: 'Planning session', m: 45, d: 'Run sheet, family groups, timings.', on: 1 },
    { id: 'album', n: 'Album selection', m: 30, d: 'Pick the spreads together on a shared screen.', on: 1 },
    { id: 'studio', n: 'Studio visit', m: 30, d: 'In person, Noosaville.', on: 0 },
  ],
  posts: [
    { id: 1, d: '2026-09-21', ch: ['ig', 'fb'], t: 'Marcus · headshots', body: 'Three frames from Marcus\'s LinkedIn set. Grey backdrop, one light, done in twenty minutes.', st: 'posted', s: 13, m: 'forest', time: '19:30', kind: 'carousel', stats: '412 reach · 38 likes · 2 saves', pub: { ig: { id: '17895695668004550', url: 'https://instagram.com/p/C9xK2' }, fb: { id: '10158_4421', url: 'https://facebook.com/maraokafor/posts/4421' } }, metrics: { ig: { reach: 412, imp: 530, likes: 38, comments: 4, saves: 2, shares: 1, clicks: 3 }, fb: { reach: 140, imp: 160, likes: 9, comments: 1, saves: 0, shares: 2, clicks: 1 } } },
    { id: 2, d: '2026-09-23', ch: ['ig'], t: 'Coastline · twilight', body: 'Tonight\'s twilight exterior at Park Rd, if the sky plays. Story first, feed tomorrow.', st: 'today', s: 5, m: 'cool', stats: '' },
    { id: 3, d: '2026-09-24', ch: ['ig', 'fb', 'gm'], t: 'Harper and Leo · sneak peek', body: 'Six from the sneak peek, with Harper\'s permission. "The sneak peek made my mum cry."', st: 'draft', s: 3, m: 'golden', stats: '' },
    { id: 4, d: '2026-09-26', ch: ['tt'], t: 'Behind the bag', body: '30 seconds: what\'s in the bag for a wedding day. R5, R6, 24-70, 70-200, 50, way too many cards.', st: 'draft', s: 17, m: 'dusk', stats: '' },
    { id: 5, d: '2026-09-27', ch: ['ig', 'fb'], t: 'Ana and Tom · album', body: 'The album arrived. Ten spreads, linen cover, Ana picked the speeches for the middle.', st: 'scheduled', s: 9, m: 'rose', stats: '' },
    { id: 6, d: '2026-09-29', ch: ['li'], t: 'Blackwood · last year', body: 'Conference season is here. Last year\'s Blackwood awards night, before this year\'s two-day run.', st: 'idea', s: 21, m: 'night', stats: '' },
    { id: 8, d: '2026-09-18', ch: ['ig'], t: 'Jess and Kai · elopement', body: 'Two people, one beach, no guest list. Jess and Kai at Sunshine Beach, 5:40 pm.', st: 'posted', s: 21, m: 'golden', time: '19:30', kind: 'reel', stats: '2,140 reach · 186 likes · 41 saves', pub: { ig: { id: '17895695668004551', url: 'https://instagram.com/reel/C9wA1' } }, metrics: { ig: { reach: 2140, imp: 2880, likes: 186, comments: 22, saves: 41, shares: 19, clicks: 14 } } },
    { id: 9, d: '2026-09-15', ch: ['ig', 'fb'], t: 'Coastline · 12 Park Rd', body: 'Twilight at 12 Park Rd for Coastline. On the market Thursday.', st: 'posted', s: 5, m: 'cool', time: '18:00', kind: 'image', stats: '380 reach · 24 likes', pub: { ig: { id: '17895695668004552', url: 'https://instagram.com/p/C9vB2' }, fb: { id: '10158_4418', url: 'https://facebook.com/maraokafor/posts/4418' } }, metrics: { ig: { reach: 380, imp: 455, likes: 24, comments: 2, saves: 3, shares: 0, clicks: 6 }, fb: { reach: 210, imp: 250, likes: 11, comments: 0, saves: 0, shares: 4, clicks: 9 } } },
    { id: 10, d: '2026-09-11', ch: ['ig', 'fb', 'li'], t: 'Ana and Tom · the speeches', body: 'The speeches spread. Nobody was looking at the camera and that is the point.', st: 'posted', s: 9, m: 'rose', time: '19:30', kind: 'carousel', stats: '1,620 reach · 142 likes · 28 saves', pub: { ig: { id: '17895695668004553', url: 'https://instagram.com/p/C9uC3' }, fb: { id: '10158_4410', url: 'https://facebook.com/maraokafor/posts/4410' }, li: { id: 'urn:li:share:7241', url: 'https://linkedin.com/feed/update/urn:li:share:7241' } }, metrics: { ig: { reach: 1620, imp: 2010, likes: 142, comments: 17, saves: 28, shares: 9, clicks: 11 }, fb: { reach: 320, imp: 390, likes: 26, comments: 3, saves: 0, shares: 6, clicks: 4 }, li: { reach: 210, imp: 240, likes: 14, comments: 2, saves: 0, shares: 1, clicks: 5 } } },
    { id: 11, d: '2026-09-08', ch: ['tt'], t: 'Sorting 3,000 photos', body: 'How I cull a wedding in an evening. Sped up, obviously.', st: 'posted', s: 17, m: 'dusk', time: '20:00', kind: 'video', stats: '4,900 views · 310 likes', pub: {}, metrics: { tt: { reach: 4900, imp: 5600, likes: 310, comments: 41, saves: 66, shares: 52, clicks: 0 } } },
    { id: 12, d: '2026-09-04', ch: ['ig'], t: 'Golden hour, Coolum', body: 'Ten minutes of light and then it was gone. Worth the drive.', st: 'posted', s: 25, m: 'golden', time: '19:30', kind: 'image', stats: '690 reach · 71 likes · 9 saves', pub: { ig: { id: '17895695668004554', url: 'https://instagram.com/p/C9tD4' } }, metrics: { ig: { reach: 690, imp: 820, likes: 71, comments: 6, saves: 9, shares: 3, clicks: 2 } } },
    { id: 13, d: '2026-08-30', ch: ['ig', 'fb'], t: 'Blackwood · awards night', body: 'Four hundred people, one sponsor wall, a lot of confetti. Blackwood Events, Friday.', st: 'posted', s: 29, m: 'night', time: '12:00', kind: 'carousel', stats: '540 reach · 44 likes', pub: { ig: { id: '17895695668004555', url: 'https://instagram.com/p/C9sE5' }, fb: { id: '10158_4390', url: 'https://facebook.com/maraokafor/posts/4390' } }, metrics: { ig: { reach: 540, imp: 660, likes: 44, comments: 5, saves: 4, shares: 2, clicks: 1 }, fb: { reach: 290, imp: 330, likes: 22, comments: 2, saves: 0, shares: 3, clicks: 2 } } },
    { id: 14, d: '2026-08-26', ch: ['ig'], t: 'Behind the scenes · Maleny', body: 'What a first look looks like from where I stand.', st: 'posted', s: 3, m: 'forest', time: '19:30', kind: 'reel', stats: '1,180 reach · 96 likes · 17 saves', pub: { ig: { id: '17895695668004556', url: 'https://instagram.com/reel/C9rF6' } }, metrics: { ig: { reach: 1180, imp: 1500, likes: 96, comments: 9, saves: 17, shares: 12, clicks: 7 } } },
    { id: 7, d: '2026-10-01', ch: ['ig', 'gm'], t: 'Christmas minis · announce', body: '23 Nov to 6 Dec. Twenty minute sessions, sunrise at Main Beach or the Maleny paddock. Six spots a day.', st: 'idea', s: 25, m: 'golden', stats: '' },
  ],
  // Connected channels: what the OAuth dance leaves behind. Token expiry drives the "reconnect" nudges.
  channels: [
    { id: 'ig', n: 'Instagram', handle: '@maraokafor', on: 1, kind: 'Creator account', since: '2026-03-02', exp: '2026-11-20', followers: 4120, grow: 86, scopes: ['publish', 'insights', 'comments'] },
    { id: 'fb', n: 'Facebook', handle: 'Mara Okafor Photography', on: 1, kind: 'Page', since: '2026-03-02', exp: '2026-11-20', followers: 1860, grow: 12, scopes: ['publish', 'insights'] },
    { id: 'tt', n: 'TikTok', handle: '', on: 0, kind: 'Creator', since: '', exp: '', followers: 0, grow: 0, scopes: [] },
    { id: 'li', n: 'LinkedIn', handle: 'Mara Okafor', on: 1, kind: 'Personal profile', since: '2026-05-14', exp: '2026-09-28', followers: 640, grow: 9, scopes: ['publish'] },
    { id: 'gm', n: 'Google Business', handle: 'Mara Okafor Photography · Noosaville', on: 1, kind: 'Business profile', since: '2026-03-02', exp: '', followers: 0, grow: 0, scopes: ['publish', 'reviews'] },
  ],
  // Daily reach per channel for the last 30 days, the shape the insights endpoints hand back
  insights: Array.from({ length: 30 }, (_, i) => { const d = new Date(2026, 7, 25 + i); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); const w = d.getDay(); const base = 120 + ((i * 37) % 90); const spike = { '2026-09-18': 1900, '2026-09-11': 1300, '2026-09-15': 260, '2026-09-04': 520, '2026-08-30': 380, '2026-08-26': 900, '2026-09-08': 3800, '2026-09-21': 300 }[k] || 0; return { d: k, ig: base + spike + (w === 4 || w === 6 ? 60 : 0), fb: 40 + ((i * 13) % 50) + (spike > 300 ? Math.round(spike / 6) : 0), li: 12 + ((i * 7) % 20), tt: k === '2026-09-08' ? 3800 : k > '2026-09-08' && k < '2026-09-14' ? 400 - (i % 5) * 60 : 0, follows: 1 + ((i * 11) % 7) + (spike > 1000 ? 12 : 0), profile: 8 + ((i * 5) % 14) + (spike > 1000 ? 30 : 0) } }),
  // Marketplace: gear listed by creatives on LensTrybe, to buy, sell or swap. 'me' is the signed-in creative.
  enquiries: ENQ, views: VIEWS,
  listings: [
    { id: 'L1', t: 'Sony A7 III body', cat: 'Camera bodies', cond: 'Good', p: 1150, loc: 'Maleny, QLD', d: 'Second body for the last three seasons, 62k shutter count, two batteries and the charger. Small mark on the base plate from a tripod, nothing on the sensor.', swap: 1, seller: { id: 'beck', n: 'Beck Halloran', c: 'Maleny', r: 5.0, rv: 14 }, st: 'live', posted: '2026-09-19', views: 84, saves: 6, s: 13, m: 'dusk' },
    { id: 'L2', t: 'Sigma 35mm f/1.4 Art · Sony E', cat: 'Lenses', cond: 'Like new', p: 780, loc: 'Sunshine Beach, QLD', d: 'Bought for a documentary job, used twice. Box, hood, caps. Moving to a 24-70 so this can go.', swap: 1, seller: { id: 'lena', n: 'Lena Hoang', c: 'Sunshine Beach', r: 4.9, rv: 52 }, st: 'live', posted: '2026-09-21', views: 41, saves: 9, s: 29, m: 'cool' },
    { id: 'L3', t: 'Godox AD200 Pro ×2 with trigger', cat: 'Lighting', cond: 'Good', p: 520, loc: 'Gold Coast, QLD', d: 'Two heads, the XPro-S trigger, bare bulb and fresnel heads, four batteries. Real estate kit that I have replaced with the AD300s.', swap: 0, seller: { id: 'ellie', n: 'Ellie Sørensen', c: 'Gold Coast', r: 4.8, rv: 61 }, st: 'live', posted: '2026-09-15', views: 120, saves: 11, s: 5, m: 'golden' },
    { id: 'L4', t: 'DJI Mini 4 Pro · Fly More', cat: 'Drones', cond: 'Like new', p: 1290, loc: 'Brisbane, QLD', d: 'Fly More combo, three batteries, ND set, under 20 hours. Selling because the job needs a Mavic now.', swap: 1, seller: { id: 'tane', n: 'Tane Whitfield', c: 'Fortitude Valley', r: 5.0, rv: 22 }, st: 'live', posted: '2026-09-22', views: 22, saves: 3, s: 11, m: 'night' },
    { id: 'L5', t: 'Rode Wireless GO II', cat: 'Audio', cond: 'Good', p: 280, loc: 'West End, QLD', d: 'Dual channel set, both transmitters, lav mics, case. Works perfectly, foam on one windshield is tired.', swap: 0, seller: { id: 'ari', n: 'Ari Castellano', c: 'West End', r: 4.8, rv: 29 }, st: 'live', posted: '2026-09-10', views: 66, saves: 4, s: 23, m: 'rose' },
    { id: 'L6', t: 'Peak Design Everyday Backpack 30L', cat: 'Bags and tripods', cond: 'Fair', p: 190, loc: 'Brisbane, QLD', d: 'Charcoal, three years old, zips and buckles all fine, some fading on the base.', swap: 1, seller: { id: 'jono', n: 'Jono Reyes', c: 'Brisbane', r: 4.9, rv: 47 }, st: 'live', posted: '2026-09-08', views: 38, saves: 2, s: 17, m: 'forest' },
    { id: 'L7', t: 'Mac Studio M2 Max 32GB · 1TB', cat: 'Editing hardware', cond: 'Like new', p: 2900, loc: 'Maroochydore, QLD', d: 'Edit machine, boxed, AppleCare to March 2027. Upgrading to the M4.', swap: 0, seller: { id: 'priya', n: 'Priya Nair', c: 'Maroochydore', r: 4.7, rv: 19 }, st: 'live', posted: '2026-09-20', views: 97, saves: 14, s: 9, m: 'cool' },
    { id: 'L8', t: 'Canon RF 85mm f/2 Macro', cat: 'Lenses', cond: 'Good', p: 640, loc: 'Noosaville, QLD', d: 'My portrait lens for two seasons. Clean glass, hood and caps, no box. Open to a swap for a 35.', swap: 1, seller: { id: 'me', n: 'Mara Okafor', c: 'Noosaville', r: 4.9, rv: 39 }, st: 'live', posted: '2026-09-17', views: 54, saves: 7, s: 3, m: 'golden', gearId: 5 },
    { id: 'L9', t: 'Manfrotto 055 tripod with ball head', cat: 'Bags and tripods', cond: 'Good', p: 220, loc: 'Noosaville, QLD', d: 'Aluminium 055, 496RC2 head. Heavy but rock solid.', swap: 0, seller: { id: 'me', n: 'Mara Okafor', c: 'Noosaville', r: 4.9, rv: 39 }, st: 'sold', posted: '2026-08-12', sold: '2026-08-30', soldTo: 'Lena Hoang', views: 130, saves: 9, s: 7, m: 'dusk' },
  ],
  savedListings: ['L2', 'L4'],
  // Conversations on listings: buyer and seller, kept apart from client threads
  offers: [
    { id: 'o1', l: 'L8', from: 'Lena Hoang', kind: 'msg', text: 'Hi Mara, is the 85 still available? Could do $600 cash Thursday.', at: '2026-09-22', mine: 0 },
    { id: 'o2', l: 'L8', from: 'Mara Okafor', kind: 'msg', text: 'Still here. $620 and it is yours, I can meet in Noosa.', at: '2026-09-22', mine: 1 },
  ],
  ideas: [
    { id: 1, k: 'gallery', t: 'Harper and Leo · the ridge at 5:40', why: 'Sneak peek delivered this morning, Harper said yes to sharing.', cap: 'The ridge at Maleny Manor, 5:40 on a Saturday. Harper and Leo, and the light that made her mum cry.', ch: ['ig', 'fb'], s: 3, m: 'golden', best: 'Thu 7:30 pm', bd: '2026-09-24' },
    { id: 2, k: 'review', t: 'Marcus · five stars', why: 'Review posted Saturday. Reviews with a photo get 3× the saves.', cap: '"Twenty minutes, one light, and I finally have a LinkedIn photo I don\'t hate." Thanks Marcus.', ch: ['li', 'ig'], s: 13, m: 'forest', best: 'Tue 8:00 am', bd: '2026-09-29' },
    { id: 3, k: 'gap', t: 'Christmas minis · 23 Nov to 6 Dec', why: 'Fortnight is empty. Last year it was four family sessions.', cap: 'Christmas minis are back. Twenty minutes, sunrise at Main Beach or the Maleny paddock, six a day, 23 Nov to 6 Dec. Six families have first dibs.', ch: ['ig', 'fb', 'gm'], s: 25, m: 'golden', best: 'Sun 6:00 pm', bd: '2026-09-27' },
    { id: 4, k: 'gallery', t: 'Coastline · twilight, Park Rd', why: 'Shot tonight if the sky plays. Real estate posts bring agency enquiries.', cap: 'Twilight at Park Rd for Coastline Realty. Three listings, one golden ten minutes.', ch: ['ig', 'li'], s: 5, m: 'cool', best: 'Wed 7:00 pm', bd: '2026-09-30' },
    { id: 5, k: 'behind', t: 'What\'s in the bag', why: 'Behind-the-scenes gets your most comments. You haven\'t posted one since July.', cap: 'Wedding day bag: R5, R6, 24-70, 70-200, the 50 for the ridge, and six cards because I\'ve been burned once.', ch: ['tt', 'ig'], s: 17, m: 'dusk', best: 'Sat 10:00 am', bd: '2026-10-03' },
    { id: 6, k: 'gallery', t: 'Ana and Tom · the album', why: 'Album approved 12 Sep. Album posts sell albums.', cap: 'Ten spreads, linen cover, the speeches in the middle. Ana and Tom\'s album is home.', ch: ['ig', 'fb'], s: 9, m: 'rose', best: 'Sun 7:30 pm', bd: '2026-10-04' },
    { id: 7, k: 'season', t: 'Conference season', why: 'Blackwood in nine weeks. Corporate posts on LinkedIn brought two enquiries last spring.', cap: 'Conference season is nearly here. Two days, two hundred people, one headshot booth. If your event needs covering, now is the time.', ch: ['li'], s: 21, m: 'night', best: 'Tue 8:00 am', bd: '2026-10-06' },
    { id: 8, k: 'behind', t: 'Why I shoot documentary', why: 'Your most-read About line. A short reel of it does well.', cap: 'I don\'t pose people. I wait. Here\'s thirty seconds on why.', ch: ['tt', 'ig'], s: 29, m: 'dusk', best: 'Fri 6:30 pm', bd: '2026-10-02' },
  ],
  reviews: [
    { id: 1, who: 'Marcus Petrou', job: 'Headshots', d: '12 Sep', n: 5, t: 'Twenty minutes, one light, and I finally have a LinkedIn photo I don\'t hate. Mara made it painless.', reply: '', src: 'LensTrybe', g: G.green, date: '2026-09-12', t2: 'marcus', st: 'public', featured: 0 },
    { id: 2, who: 'Ana Ferreira', job: 'Wedding', d: '28 Aug', n: 5, t: 'Mara was everywhere and nowhere. We didn\'t notice her all day and then the photos arrived and she\'d seen everything.', reply: 'Thank you Ana. The speeches spread is my favourite too.', src: 'LensTrybe', g: G.rose, date: '2026-08-28', t2: 'ana', st: 'public', featured: 1 },
    { id: 3, who: 'Dean Marsh · Coastline', job: 'Real estate', d: '30 Aug', n: 5, t: 'Fast, consistent, and the twilight shots sell the listing before the open home. Monthly now.', reply: '', src: 'Google', g: G.green, date: '2026-08-30', t2: 'coastline', st: 'public', featured: 1 },
    { id: 4, who: 'Priya Nair · Blackwood', job: 'Awards night', d: '20 Nov 2025', n: 4, t: 'Great coverage of the night. Would have loved the sponsor wall a touch earlier, but the galleries were fast and the team loved them.', reply: 'Noted for this year, Priya. Sponsor wall first thing.', src: 'LensTrybe', g: G.plum, date: '2025-11-20', t2: 'blackwood', st: 'public', featured: 0 },
    { id: 5, who: 'Jess Morgan', job: 'Enquiry', d: '4 Sep', n: 5, t: 'Replied in an hour with a quote that made sense. Booked.', reply: '', src: 'Google', g: G.rose, date: '2026-09-04', t2: 'jess', st: 'public', featured: 0 },
    { id: 6, who: 'Tom and Ana\'s parents', job: 'Wedding', d: '2 Sep', n: 5, t: 'We were the ones crying at the sneak peek. Thank you for seeing our kids the way we do.', reply: '', src: 'Imported', g: G.blue, date: '2026-09-02', st: 'public', featured: 0, imported: 1, note: 'From a card they sent' },
    { id: 7, who: 'Ruby Chen', job: 'Elopement', d: '20 Sep', n: 3, t: 'Photos are lovely but the gallery took longer than we expected and a few of the family shots were missed.', reply: '', src: 'LensTrybe', g: G.plum, date: '2026-09-20', t2: 'ruby', st: 'private', featured: 0 },
  ],
  // Review requests: who was asked, when, and whether it turned into a review
  reviewRequests: [
    { id: 'rq1', t: 'marcus', who: 'Marcus Petrou', sent: '2026-09-09', st: 'done', rid: 1 },
    { id: 'rq2', t: 'ana', who: 'Ana Ferreira', sent: '2026-08-25', st: 'done', rid: 2 },
    { id: 'rq3', t: 'ruby', who: 'Ruby Chen', sent: '2026-09-17', st: 'done', rid: 7 },
    { id: 'rq4', t: 'coastline', who: 'Coastline Realty', sent: '2026-09-15', reminded: '2026-09-22', st: 'sent' },
    { id: 'rq5', t: 'jess', who: 'Jess and Kai', sent: '2026-09-19', st: 'sent' },
  ],
  items: [
    { id: 1, n: 'Sunshine Coast preset pack', k: 'Presets', p: 39, sold: 84, s: 3, m: 'golden', on: 1 },
    { id: 2, n: 'The ridge · fine art print', k: 'Prints', p: 180, sold: 6, s: 9, m: 'rose', on: 1 },
    { id: 3, n: 'Real estate twilight guide', k: 'Guides', p: 29, sold: 41, s: 5, m: 'cool', on: 1 },
    { id: 4, n: 'Wedding day timeline template', k: 'Guides', p: 0, sold: 212, s: 17, m: 'dusk', on: 1 },
    { id: 5, n: 'Maleny paddock · print', k: 'Prints', p: 140, sold: 0, s: 13, m: 'forest', on: 0 },
  ],
  crew: [
    { id: 1, n: 'Sam Reid', r: 'Second shooter', c: 'Maleny', rate: '$650 / day', em: 'sam@samreid.photo', ph: '0411 220 118', jobs: 14, g: G.blue, since: '2024-03-02' },
    { id: 2, n: 'Tane Walker', r: 'Videographer', c: 'Noosa', rate: '$1,200 / day', em: 'tane@tanewalker.film', ph: '', jobs: 3, g: G.green, since: '2025-11-14' },
    { id: 3, n: 'Ellie Chen', r: 'Editor · culling and colour', c: 'Remote', rate: '$0.45 / image', em: 'ellie@edits.co', ph: '', jobs: 22, g: G.plum, since: '2024-06-20' },
    { id: 4, n: 'Jono Blake', r: 'Drone pilot', c: 'Sunshine Coast', rate: '$400 / half day', em: 'jono@skyline.au', ph: '0400 555 019', jobs: 5, g: G.peach, since: '2025-02-09' },
  ],
  // Crew bookings: who is on which job, and where the ask is up to. Status: asked, confirmed, declined, done.
  crewJobs: [
    { id: 'cj1', crew: 1, proj: 'harper', d: '2026-11-07', role: 'Second shooter', fee: 650, st: 'confirmed', asked: '2026-08-12', replied: '2026-08-12' },
    { id: 'cj2', crew: 3, proj: 'coastline', d: '2026-09-22', role: 'Cull and colour · 3 listings', fee: 90, st: 'confirmed', asked: '2026-09-20', replied: '2026-09-20' },
    { id: 'cj3', crew: 2, proj: 'northshore', d: '2026-10-03', role: 'Short film, if the quote lands', fee: 1200, st: 'asked', asked: '2026-09-18' },
    { id: 'cj4', crew: 1, proj: 'ana', d: '2026-08-08', role: 'Second shooter', fee: 650, st: 'done', asked: '2026-06-01', replied: '2026-06-02', paid: '2026-08-22' },
    { id: 'cj5', crew: 3, proj: 'ana', d: '2026-08-09', role: 'Cull and colour · 388', fee: 175, st: 'done', asked: '2026-08-08', replied: '2026-08-08', paid: '2026-08-22' },
    { id: 'cj6', crew: 1, proj: 'blackwood', d: '2025-11-28', role: 'Second shooter · day 2', fee: 650, st: 'done', asked: '2025-10-01', replied: '2025-10-01', paid: '2025-12-05' },
  ],
  crewMsgs: [
    { id: 'cm1', crew: 1, from: 'Sam Reid', text: 'Locked in for the 7th. Want me on the groom prep from 11?', at: '2026-09-20', mine: 0 },
    { id: 'cm2', crew: 1, from: 'Mara Okafor', text: 'Yes please. Call sheet comes Thursday.', at: '2026-09-20', mine: 1 },
    { id: 'cm3', crew: 2, from: 'Mara Okafor', text: 'Northshore might come with a short film. Would 3 Oct work if it does?', at: '2026-09-18', mine: 1 },
  ],
  passed: [
    { id: 1, from: 'Beck Lawson', j: 'Wedding · Montville · Sat 10 Oct', w: 'Beck is double booked. Full day, $3,000 budget.', g: G.rose, d: '2026-10-10', v: 3000, at: '2026-09-21' },
    { id: 2, from: 'Lena Hart', j: 'Brand shoot · Brisbane · flexible', w: 'Lena is on leave. Café launch, $1,500.', g: G.teal, d: '', v: 1500, at: '2026-09-19' },
    { id: 3, from: 'Mara Okafor', to: 'Beck Lawson', j: 'Elopement · Noosa · Sat 3 Oct', w: 'Double booked with Coastline. Two hours at sunrise, $1,200.', g: G.blue, d: '2026-10-03', v: 1200, at: '2026-09-15', out: 1, st: 'taken' },
  ],
  team: [
    { id: 1, n: 'Mara Okafor', r: 'Owner', em: 'mara@maraokafor.com', sees: 'Everything', g: G.blue, st: 'You', last: '2026-09-22' },
    { id: 2, n: 'Sam Reid', r: 'Second shooter', em: 'sam@samreid.photo', sees: 'Threads and calendar for jobs they are on', g: G.green, st: 'Active', last: '2026-09-21', joined: '2024-03-02' },
    { id: 3, n: 'Ellie Chen', r: 'Editor', em: 'ellie@edits.co', sees: 'Deliver only', g: G.plum, st: 'Active', last: '2026-09-22', joined: '2024-06-20' },
    { id: 4, n: 'Priya Desai', r: 'Accountant', em: 'priya@ledgerandco.au', sees: 'Finance and Tax hub, read only', g: G.teal, st: 'Invited', invited: '2026-09-19' },
  ],
  // Job board. Clients post from lenstrybe.com/jobs; creatives pass on what they cannot take. Each one
  // carries the poster, the brief, the budget, the date (or a window), where, and the replies so far.
  jobs: [
    { id: 'j1', t: 'Wedding photographer, Montville', k: 'Wedding', ct: ['Photographer'], loc: 'Montville, QLD', state: 'QLD', km: 38, d: '2026-10-10', b: 3000, hrs: 'Full day', w: 'Full day, 80 guests, documentary style. Ceremony at 2:30 in the garden, reception in the barn. We want the real day, not posed. Beck was booked but is now double booked and passed this on.', by: 'Beck Lawson', kind: 'creative', posted: '2026-09-22', expires: '2026-10-08', replies: 1, g: G.rose, st: 'open', verified: 1, prior: 0, apps: [] },
    { id: 'j2', t: 'Brand shoot for a new café menu', k: 'Brand', ct: ['Photographer', 'Videographer'], loc: 'Brisbane, QLD', state: 'QLD', km: 140, d: '', flex: 'Mid October, weekday', b: 1500, hrs: 'Half day', w: 'New café on James St. Menu shots of about 20 dishes, the room, the team, and a few short clips for Instagram. Natural light in the mornings is best.', by: 'Northshore Café', kind: 'client', posted: '2026-09-21', expires: '2026-10-21', replies: 4, g: G.peach, st: 'open', verified: 1, prior: 1, apps: [] },
    { id: 'j3', t: 'Six listings, Sunshine Beach, ongoing', k: 'Real estate', ct: ['Photographer'], loc: 'Sunshine Beach, QLD', state: 'QLD', km: 9, d: '', flex: 'This month, then monthly', b: 2400, hrs: '6 × 2 hours', w: 'Agency wants a regular. Six listings this month, twilight on two of them, floorplans not needed. If it works, three to four a month after that.', by: 'Sunline Property', kind: 'client', posted: '2026-09-21', expires: '2026-10-21', replies: 2, g: G.green, st: 'open', verified: 1, prior: 3, apps: [] },
    { id: 'j4', t: 'Team headshots, 40 people', k: 'Headshots', ct: ['Photographer'], loc: 'Maroochydore, QLD', state: 'QLD', km: 24, d: '2026-10-16', b: 1800, hrs: 'Office day', w: 'Office day, grey backdrop, same-day web sizes. Forty people in slots of ten minutes, a room is set aside. LinkedIn crops plus one wider for the website.', by: 'Peak Physio', kind: 'client', posted: '2026-09-19', expires: '2026-10-19', replies: 3, g: G.blue, st: 'open', verified: 1, prior: 0, apps: [] },
    { id: 'j5', t: 'Elopement at sunrise, Byron', k: 'Wedding', ct: ['Photographer'], loc: 'Byron Bay, NSW', state: 'NSW', km: 230, d: '2026-11-20', b: 1600, hrs: '3 hours', w: 'Sunrise, two people, a celebrant and a dog. Cape Byron then breakfast. Two hours of shooting, we would love the gallery within a fortnight.', by: 'Isla and Finn', kind: 'client', posted: '2026-09-18', expires: '2026-10-18', replies: 6, g: G.teal, st: 'open', verified: 1, prior: 0, apps: [] },
    { id: 'j6', t: 'Conference, two days, Brisbane', k: 'Event', ct: ['Photographer', 'Videographer'], loc: 'Brisbane, QLD', state: 'QLD', km: 140, d: '2026-11-28', b: 3600, hrs: '2 days', w: 'Two hundred delegates, keynotes, breakouts and a dinner. Stills both days and a two-minute highlights film by the Monday after.', by: 'Blackwood Events', kind: 'client', posted: '2026-09-15', expires: '2026-10-15', replies: 5, g: G.plum, st: 'open', verified: 1, prior: 2, apps: [], my: { price: 3800, incl: 'Two days on site, 400 edited stills within 5 days, 2 min highlights film', msg: 'Hi Priya, two days in Brisbane works and the dates are open. Quote attached, film included.', st: 'shortlisted', at: '2026-09-16' } },
    { id: 'j7', t: 'Family session on the beach', k: 'Family', ct: ['Photographer'], loc: 'Noosa Heads, QLD', state: 'QLD', km: 6, d: '2026-10-03', b: 450, hrs: '1 hour', w: 'Grandparents visiting from Perth, three generations, golden hour at Little Cove. Relaxed, nothing posed, twenty edited photos is plenty.', by: 'Ava M.', kind: 'client', posted: '2026-09-22', expires: '2026-10-22', replies: 0, g: G.rose, st: 'open', verified: 0, prior: 0, apps: [] },
    { id: 'j8', t: 'Brand film for a surf school', k: 'Brand', ct: ['Videographer'], loc: 'Coolum Beach, QLD', state: 'QLD', km: 22, d: '', flex: 'Any weekday in October', b: 2200, hrs: 'Half day', w: 'Ninety-second brand film for the website plus five vertical cuts. Drone would be a bonus. Early morning for the light and the swell.', by: 'Coolum Surf School', kind: 'client', posted: '2026-09-20', expires: '2026-10-20', replies: 2, g: G.teal, st: 'open', verified: 1, prior: 0, apps: [] },
    { id: 'j9', t: 'Product photos, 60 SKUs', k: 'Brand', ct: ['Photographer'], loc: 'Gold Coast, QLD', state: 'QLD', km: 210, d: '', flex: 'Before 15 October', b: 1200, hrs: '1 day', w: 'Skincare range, white background, three angles each, plus a few lifestyle shots. Products can be posted to you if you have a studio.', by: 'Ridge Botanicals', kind: 'client', posted: '2026-09-12', expires: '2026-09-27', replies: 7, g: G.peach, st: 'open', verified: 1, prior: 1, apps: [] },
    { id: 'j10', t: 'Real estate video, hinterland acreage', k: 'Real estate', ct: ['Videographer'], loc: 'Maleny, QLD', state: 'QLD', km: 40, d: '2026-09-30', b: 900, hrs: '3 hours', w: 'Ten-acre property, drone plus walkthrough, agent to camera for the intro. Twilight if the weather plays.', by: 'Hinterland Homes', kind: 'client', posted: '2026-09-14', expires: '2026-10-14', replies: 3, g: G.green, st: 'filled', verified: 1, prior: 4, apps: [], my: { price: 950, incl: 'Drone, walkthrough, agent intro, 90 s cut plus 30 s vertical', msg: 'Hi Dean, Maleny is close and the 30th is free.', st: 'lost', at: '2026-09-14' } },
    { id: 'j11', t: 'Headshots for a law firm, 12 people', k: 'Headshots', ct: ['Photographer'], loc: 'Noosaville, QLD', state: 'QLD', km: 2, d: '2026-09-25', b: 700, hrs: '2 hours', w: 'Twelve partners and staff, in their boardroom, consistent look for the website.', by: 'Ridge Legal', kind: 'client', posted: '2026-09-10', expires: '2026-10-10', replies: 2, g: G.blue, st: 'filled', verified: 1, prior: 1, apps: [], my: { price: 720, incl: '2 hours on site, 12 × 2 retouched, web and print sizes within 3 days', msg: 'Hi, Noosaville is home and the 25th is open.', st: 'won', at: '2026-09-10' } },
  ],
  referrals: [
    { id: 1, n: 'Sam Reid', s: 'Joined Pro · Jul', st: 'ok', l: 'Month credited', g: G.blue }, { id: 2, n: 'Tane Walker', s: 'Joined Expert · Aug', st: 'ok', l: 'Month credited', g: G.green }, { id: 3, n: 'Ellie Chen', s: 'Joined Pro · Sep', st: 'ok', l: 'Month credited', g: G.plum }, { id: 4, n: 'Beck Lawson', s: 'On Basic since Aug', st: 'viewed', l: 'Waiting', g: G.rose }, { id: 5, n: 'Lena Hart', s: 'Invited 12 Sep', st: 'grey', l: 'Not yet', g: G.teal }, { id: 6, n: 'jono@…', s: 'Invited 2 Sep', st: 'grey', l: 'Not yet', g: G.peach },
  ],
  pages: [
    { id: 'home', n: 'Home', on: 1, h: 'Weddings and real estate, told straight.', p: 'Sunshine Coast photographer. Documentary weddings, twilight listings, and the odd headshot.', secs: [['Hero', 1], ['Recent work', 1], ['Three things clients say', 1], ['Ask in one sentence', 1]] },
    { id: 'work', n: 'Work', on: 1, h: 'Recent work', p: 'A few from this year. The rest is in the galleries.', secs: [['Weddings', 1], ['Real estate', 1], ['Brand and headshots', 1]] },
    { id: 'about', n: 'About', on: 1, h: 'Hi, I\'m Mara.', p: 'Eight years, four hundred weddings, one camera bag that is always too heavy.', secs: [['Portrait and story', 1], ['How I work', 1], ['Gear, for the nerds', 0]] },
    { id: 'pricing', n: 'Pricing', on: 1, h: 'Straight prices.', p: 'Three packages, GST included, no surprises at the end.', secs: [['Packages', 1], ['What is included', 1], ['Questions', 1]] },
    { id: 'contact', n: 'Contact', on: 1, h: 'Say what you need.', p: 'One sentence is enough. I reply within a day.', secs: [['Ask bar', 1], ['Booking link', 1], ['Where I work', 1]] },
  ],
  brand: { name: 'Mara Okafor Photography', tag: 'Weddings and real estate, Sunshine Coast', accent: '#8DF3D6', head: 'Instrument Serif', body: 'Inter', foot: 'Thank you for your business', phone: 1, site: 1, abn: 1, gst: 1, pay: 1, terms: 'Deposit 30% to lock the date. Balance seven days before.', lic: 'Personal use. Commercial licence on request.', wm: 1, paper: 'white', layout: 'classic', radius: 12, look: 'coastal', wmMode: 'text', wmPos: 'br', wmSize: 2, wmOpacity: 0.4, voice: { tone: ['Warm', 'Casual'], greet: 'Hi', signoff: 'Mara x', banned: 'Kindly, Please be advised, ASAP' }, over: { inv: {}, q: {}, c: {} }, everywhere: 1 },
  brandHistory: [],
  profile: { n: 'Mara Okafor', h: 'Weddings and real estate, told straight.', bio: 'Eight years, four hundred weddings, one camera bag that is always too heavy. Documentary weddings, twilight listings, and the odd headshot, from Noosaville across the Sunshine Coast.', kinds: ['Weddings', 'Real estate', 'Events', 'Brand', 'Headshots'], from: '3,200', city: 'Noosaville, QLD', ig: '@maraokafor', disc: 'Photographer', web: 'maraokafor.com', avatar: 'seed', shots: [0, 1, 2, 3, 4, 5, 6, 7], tog: { enquiry: 1, price: 1, avail: 1, book: 0, badge: 1 }, strength: 90 },
  avail: { days: [0, 1, 1, 1, 1, 1, 1], kinds: { Weddings: 1, 'Real estate': 1, Events: 1, Brand: 1, Headshots: 1, Family: 0 }, radius: 150, lead: 3, max: 2,
    hours: { start: '08:00', end: '18:00', evenings: 1 }, lengths: { Weddings: 'day', 'Real estate': 120, Events: 480, Brand: 240, Headshots: 120, Family: 60 },
    buffers: { rest: 1, gap: 60, travel: 1 },
    away: [{ id: 'aw1', from: '2026-12-23', to: '2027-01-04', w: 'Christmas' }, { id: 'aw2', from: '2027-02-14', to: '2027-02-21', w: 'Bali' }],
    seasons: [{ id: 'se1', n: 'Wedding season', from: '2026-10-01', to: '2026-12-20', kinds: ['Weddings', 'Events', 'Real estate'], lead: 21, closed: 0 }],
    pub: { show: 1, n: 3, instant: ['Headshots', 'Real estate'] },
    auto: { hold: 1, gap: 1, sat: 0 }, touched: 1 },
  setup: { hidden: 0 },
  waitlist: [{ id: 'w1', d: '2026-11-14', who: 'Jess and Kai', em: 'jess.kai@gmail.com', kind: 'Wedding', at: '2026-09-18' }, { id: 'w2', d: '2026-10-10', who: 'Bayside Realty', em: 'ops@baysiderealty.com.au', kind: 'Real estate', at: '2026-09-21' }],
  settings: { email: 'mara@maraokafor.com', phone: '0412 000 000', biz: 'Mara Okafor Photography', abn: '51 824 753 556', roles: { ss: 1, ed: 1, sm: 0, acc: 1 }, notif: { enq: 1, pay: 1, lumi: 1, week: 1, mkt: 0 }, ints: { 'Google Calendar': 1, Xero: 1, Stripe: 1, Instagram: 1, TikTok: 0, Dropbox: 0 } },
  plan: { name: 'Expert', annual: false, founding: 1, since: '2026-09-21' },
  packages: [['Elopement', 1400, '3 hours · 120 photos'], ['Full day', 3200, '10 hours · 400+ photos'], ['Weekend', 4900, '2 days · second shooter']],
  site: { live: true, domain: 'maraokafor.lenstrybe.com' },
  reviewRules: { ask3: 1, again: 1, site: 1, share: 0, priv: 1 },
  tickets: [],
  counters: { job: 11, inv: 222, q: 420, c: 422, exp: 93, note: 6, proj: 9, ev: 15, meet: 7, post: 14, review: 7, rq: 5, listing: 9, offer: 2, cj: 6, cm: 3, crew: 4, team: 4, passed: 3, gear: 13 },
}
export { PLANS }

// Live mode starts here: no sample records at all, only the reference lists a workspace needs
// (pipeline stages, templates, categories, meeting types, the brand defaults). Everything else is
// hydrated from the project (threads, ledger, events) or filled in by the creative.
const EMPTY = ['threads', 'actions', 'events', 'ledger', 'people', 'projects', 'notes', 'gear', 'galleries', 'meetings', 'posts', 'insights', 'enquiries', 'listings', 'savedListings', 'offers', 'ideas', 'reviews', 'reviewRequests', 'items', 'crew', 'crewJobs', 'crewMsgs', 'passed', 'team', 'jobs', 'referrals', 'pages', 'brandHistory', 'waitlist', 'tickets', 'packages']
export const LIVE_SEED = (() => {
  const s = JSON.parse(JSON.stringify(SEED))
  for (const k of EMPTY) s[k] = []
  s.profile = { ...s.profile, n: '', h: '', bio: '', kinds: [], from: '', city: '', ig: '', web: '', ph: '', disc: '', avatar: '', shots: [], film: '', strength: 0 }
  s.brand = { ...s.brand, name: '', tag: '', logo: '', logoLight: '', mark: '', look: '', voice: { tone: ['Warm'], greet: 'Hi', signoff: '', banned: '' }, over: {} }
  s.settings = { ...s.settings, email: '', phone: '', biz: '', abn: '', addr: '', ints: Object.fromEntries(Object.keys(s.settings.ints || {}).map(k => [k, 0])) }
  s.plan = { name: 'Basic', annual: false, founding: 0, since: '' }
  s.site = { live: false, domain: '' }
  // a new account works every day, takes everything, no notice rules, nothing away: the creative sets their own
  s.avail = { ...s.avail, days: [1, 1, 1, 1, 1, 1, 1], kinds: { Weddings: 1, 'Real estate': 1, Events: 1, Brand: 1, Headshots: 1, Family: 1 }, lead: 0, max: 0, buffers: { rest: 0, gap: 0, travel: 0 }, away: [], seasons: [], pub: { show: 1, n: 3, instant: [] }, auto: { hold: 0, gap: 0, sat: 0 }, touched: 0 }
  s.channels = (s.channels || []).map(c => ({ ...c, on: 0, followers: 0, grow: 0 }))
  s.setup = { hidden: 0 }
  s.counters = {}
  return s
})()
