// Sample workspace data for Mara's account. Nothing here is real.
export const STAGES = ['Enquiry', 'Quote', 'Accepted', 'Signed', 'Deposit', 'Shoot day', 'Deliver', 'Review']
export const THREADS = [
  { id: 'ruby', n: 'Ruby and Sol', j: 'Wedding · Maleny', d: 'Mar 2027', stage: 0, next: 'Reply. Lumi has a draft.', v: 3200, need: true, g: 'linear-gradient(135deg,#283047,#9ac4c5)' },
  { id: 'coastline', n: 'Coastline Realty', j: '3 listings · Noosa Heads', d: 'Sat 14 Nov', stage: 1, next: 'Quote viewed twice. Nudge?', v: 1026, need: true, g: 'linear-gradient(135deg,#2c3a5e,#7fa8e8)' },
  { id: 'blackwood', n: 'Blackwood Events', j: 'Conference, 2 days · Brisbane', d: '28 to 29 Nov', stage: 4, next: 'Send contract', v: 3600, need: true, g: 'linear-gradient(135deg,#1c452f,#7fd0aa)' },
  { id: 'harper', n: 'Harper and Leo', j: 'Wedding · Maleny Manor', d: 'Sat 7 Nov', stage: 5, next: 'Call sheet Thursday', v: 3200, g: 'linear-gradient(135deg,#2c3a5e,#7fa8e8)' },
  { id: 'jess', n: 'Jess and Kai', j: 'Elopement · Sunshine Beach', d: 'Sat 21 Nov', stage: 3, next: 'Deposit due 24 Oct', v: 1400, g: 'linear-gradient(135deg,#3d2450,#d996ba)' },
  { id: 'northshore', n: 'Northshore Café', j: 'Brand shoot · menu', d: 'TBC', stage: 1, next: 'Quote sent, valid 9 days', v: 1800, g: 'linear-gradient(135deg,#f6ccb0,#efab82)' },
  { id: 'ana', n: 'Ana and Tom', j: 'Wedding · album', d: 'Delivered', stage: 6, next: 'Album selection call today', v: 2900, g: 'linear-gradient(135deg,#472657,#c6a5e5)' },
  { id: 'marcus', n: 'Marcus P.', j: 'Headshots', d: 'Delivered', stage: 7, next: 'Review requested', v: 380, g: 'linear-gradient(135deg,#1c452f,#7fd0aa)' },
]
export const THREAD_DETAIL = {
  harper: { n: 'Harper and Leo', s: 'Wedding · Sat 7 Nov · Maleny Manor · full day', stage: 5, job: [['Package', 'Full day, 10 hours'], ['Total', '$3,200'], ['Deposit', '$960 · paid'], ['Balance', '$2,240 · 7 Nov'], ['Second shooter', 'Sam'], ['Client link', 'harperandleo.lenstrybe.com']], docs: [['Quote #Q-0412', 'ok', 'Accepted'], ['Contract #C-0412', 'pink', 'Signed'], ['INV-0219 deposit', 'ok', 'Paid'], ['INV-0220 balance', 'sent', 'Scheduled']],
    line: [{ them: "Hi Mara, we're getting married at Maleny Manor on Sat 7 Nov. Full day, about 90 guests. Are you free?", w: '6 Oct, 9:12 am' }, { lumi: '7 Nov was open. I drafted a reply and a Full day quote from your package.' }, { me: "Hi Harper! Yes, the 7th is open and I'd love to. Full day is $3,200, quote attached.", w: '6 Oct, 9:14 am' }, { doc: 'Quote #Q-0412 · Full day', d: '$3,200 incl. GST', st: 'ok', stt: 'Accepted' }, { sys: 'Accepted 7 Oct, 8:05 pm · contract sent automatically' }, { doc: 'Contract #C-0412', d: '12 clauses, plain English', st: 'pink', stt: 'Signed' }, { doc: 'INV-0219 · Deposit', d: '$960 · Visa ···· 6411', st: 'ok', stt: 'Paid' }, { sys: 'Date locked on LensTrybe and Google calendars' }, { them: 'The sneak peek made my mum cry. Thank you!!', w: 'Today, 8:01 am' }, { lumi: 'Call sheet is ready for Thursday: arrive 9:30, ceremony 2:00, sunset portraits 5:40. Sam is confirmed as second shooter.', acts: ['Send call sheet', 'Edit'] }] },
  ruby: { n: 'Ruby and Sol', s: 'Wedding · March 2027 · Maleny · enquiry', stage: 0, job: [['Package', 'Not yet'], ['Date', '13 Mar 2027 (open)'], ['Client link', 'Not yet']], docs: [], line: [{ them: "Hi Mara! We found you on LensTrybe and love your Maleny work. We're planning March 2027, probably the 13th. Are you around?", w: 'Today, 6:41 am' }, { lumi: '13 March 2027 is open. Drafted a reply and a Full day quote at $3,200 with your travel note. Nothing sent yet.', acts: ['Send reply and quote', 'Edit', 'Discard'] }] },
  coastline: { n: 'Coastline Realty', s: '3 listings · Sat 14 Nov · Noosa Heads', stage: 1, job: [['Package', '3 listings, bundle'], ['Quote', '$1,026'], ['Date', '14 Nov (pencilled)']], docs: [['Quote #Q-0418', 'viewed', 'Viewed ×2']], line: [{ them: 'Can you do three listings on the 14th? Same as August.', w: 'Sun, 4:12 pm' }, { doc: 'Quote #Q-0418 · 3 listings', d: '$1,026 incl. GST · bundle discount', st: 'viewed', stt: 'Viewed ×2' }, { lumi: 'Viewed twice, no reply for 36 hours. A friendly nudge in your words is ready.', acts: ['Send nudge', 'Wait'] }] },
  blackwood: { n: 'Blackwood Events', s: 'Conference, 2 days · 28 to 29 Nov · Brisbane', stage: 4, job: [['Package', 'Conference, 2 days'], ['Total', '$3,600'], ['Deposit', '$1,080 · paid'], ['Balance', '$2,520 · 21 Nov']], docs: [['Quote #Q-0415', 'ok', 'Accepted'], ['INV-0221 deposit', 'ok', 'Paid'], ['Contract #C-0421', 'grey', 'Draft']], line: [{ doc: 'INV-0221 · Deposit', d: '$1,080 · paid 6:52 am', st: 'ok', stt: 'Paid' }, { sys: 'Chased on day 3 and day 6 by Lumi, in your words' }, { them: 'Sorry for the delay, paid now. Can you send the contract?', w: 'Today, 6:53 am' }, { lumi: 'Contract #C-0421 is drafted from your event template with both days and the 200 person clause.', acts: ['Send contract', 'Edit'] }] },
}
export const LEDGER = [
  { k: 'inv', n: 'INV-0221 · Blackwood Events', d: 'Deposit · paid 6:52 am', date: '21 Sep', st: 'ok', stt: 'Paid', v: 1080 },
  { k: 'q', n: 'Q-0418 · Coastline Realty', d: '3 listings, bundle', date: '20 Sep', st: 'viewed', stt: 'Viewed', v: 1026 },
  { k: 'q', n: 'Q-0419 · Northshore Café', d: 'Brand shoot, menu', date: '18 Sep', st: 'sent', stt: 'Sent', v: 1800 },
  { k: 'inv', n: 'INV-0220 · Harper and Leo', d: 'Balance · scheduled 31 Oct', date: '7 Nov', st: 'grey', stt: 'Scheduled', v: 2240 },
  { k: 'c', n: 'C-0421 · Blackwood Events', d: 'Event template, 2 days', date: 'Draft', st: 'grey', stt: 'Draft', v: 3600 },
  { k: 'inv', n: 'INV-0218 · Ana and Tom', d: 'Album, paid', date: '12 Sep', st: 'ok', stt: 'Paid', v: 640 },
  { k: 'inv', n: 'INV-0217 · Marcus P.', d: 'Headshots, paid', date: '9 Sep', st: 'ok', stt: 'Paid', v: 380 },
]
export const GALLERIES = [
  { n: 'Harper and Leo', d: '412 photos · 2 films · 18.4 GB', p: 72, m: 'golden', s: 3, x: 'Expires in 88 days · opened 14×' },
  { n: 'Ana and Tom', d: '388 photos · album proof', p: 100, m: 'rose', s: 9, x: 'Delivered · downloaded' },
  { n: 'Coastline Realty · August', d: '4 listings · 96 photos', p: 100, m: 'cool', s: 5, x: 'Delivered · 2 downloads' },
  { n: 'Marcus P. headshots', d: '24 photos', p: 100, m: 'forest', s: 13, x: 'Delivered · review posted' },
  { n: 'Jess and Kai', d: 'Not yet', p: 0, m: 'dusk', s: 17, x: 'Shoot 21 Nov' },
  { n: 'Northshore Café', d: 'Not yet', p: 0, m: 'night', s: 21, x: 'Quote open' },
]
export const CLIENTS = [
  { n: 'Harper Ellis', t: 'Wedding · Maleny', j: 1, v: 3200, l: 'Nov 2026', tags: ['Wedding', 'Referral: Ana'], g: 'linear-gradient(135deg,#2c3a5e,#7fa8e8)' },
  { n: 'Coastline Realty', t: 'Agency · Noosa Heads', j: 5, v: 6420, l: 'Aug 2026', tags: ['Real estate', 'Monthly'], g: 'linear-gradient(135deg,#1c452f,#7fd0aa)' },
  { n: 'Blackwood Events', t: 'Events · Brisbane', j: 2, v: 5100, l: 'Nov 2026', tags: ['Conference', 'Pays late'], g: 'linear-gradient(135deg,#472657,#c6a5e5)' },
  { n: 'Ana and Tom', t: 'Wedding · Sunshine Beach', j: 1, v: 2900, l: 'Aug 2026', tags: ['Wedding', 'Album'], g: 'linear-gradient(135deg,#3d2450,#d996ba)' },
  { n: 'Ruby and Sol', t: 'Enquiry · Mar 2027', j: 0, v: 0, l: 'Today', tags: ['Wedding', 'New'], g: 'linear-gradient(135deg,#283047,#9ac4c5)' },
  { n: 'Northshore Café', t: 'Hospitality · Noosa', j: 0, v: 0, l: 'Quoted', tags: ['Brand', 'Menu'], g: 'linear-gradient(135deg,#f6ccb0,#efab82)' },
]
export const ACTIONS = [
  { id: 1, t: '23:40', b: 'Held 14 Nov for Coastline Realty', p: 'They asked in a message. Pencilled, not confirmed.', y: 'Keep', n: 'Release' },
  { id: 2, t: '01:15', b: 'Quote #Q-0418 viewed twice, no reply', p: 'Coastline, three listings at $1,026. A friendly nudge in your words is ready.', y: 'Send nudge', n: 'Wait' },
  { id: 3, t: '06:30', b: 'Nudged Blackwood, invoice 6 days late', p: 'Your words, friendly. They paid at 6:52.', done: true },
  { id: 4, t: '06:45', b: 'Drafted a reply to Ruby and Sol', p: 'March 2027 is open. Quoted Full day at $3,200 with the travel note.', y: 'Send', n: 'Edit' },
  { id: 5, t: '06:50', b: 'Found a gap: 23 Nov to 6 Dec', p: 'Last year: four family sessions. Offer drafted, six families lined up.', y: 'Post it', n: 'Not now' },
]
export const DIALS = [
  ['Reply to new enquiries', 'In your words, from your rates and calendar', 1], ['Hold a date when asked', 'Pencils it in, never confirms', 0], ['Chase overdue invoices', 'Friendly at 3 days, firmer at 10', 0], ['Send quotes', 'Drafts from packages, you tap send', 1], ['Post offers to fill gaps', 'Only to past clients, never public', 1], ['Request reviews after delivery', 'Three days after the gallery opens', 0],
]
export const PLANS = [
  { n: 'Basic', d: 'Get found. Public profile, five photos, three bookings a month.', m: 'Free', a: 'Free', free: 'Forever', cta: 'Get started' },
  { n: 'Pro', d: 'Look the part. Portfolio video, your own page, CRM for 25 clients, Lumi lite.', m: '$24.99', a: '$20.83', free: '3 months free', cta: 'Start Pro' },
  { n: 'Expert', d: 'Run the whole business. Unlimited bookings, quotes, contracts, branded portals, five page site, Lumi unlimited.', m: '$74.99', a: '$62.49', free: '3 months free', cta: 'Start Expert', hot: true },
  { n: 'Elite', d: 'Studios. Team of five, your own domain, 200GB delivery, Elite spotlight on the homepage.', m: '$149.99', a: '$124.99', free: '3 months free', cta: 'Start Elite' },
]
