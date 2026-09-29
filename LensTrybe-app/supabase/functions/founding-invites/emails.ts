// Emails for founding-invites. Pure functions: plain data in, subject or html out.
//
// These are marketing emails from Michael (Spam Act 2003): every one carries the section 17
// sender line and, whenever there is a token, a working section 18 unsubscribe link. The
// List-Unsubscribe headers are added by sendEmail in index.ts.
import { layout, heading, para, strong, link, button, code, list, quote, signoff } from './email.ts'

const SITE = 'https://lenstrybe.com'
const FROM_PREVIEW = 'Michael from LensTrybe <noreply@mail.lenstrybe.com>'

// Section 17 of the Spam Act: every commercial message must accurately identify who sent it
// and how to reach them.
export const SENDER_LINE = 'LensTrybe, Brisbane, Queensland, Australia. Reply to this email or write to connect@lenstrybe.com.'

const FOOTER_NOTE = "You're getting this because Michael invited you personally to join LensTrybe as a founding creative, at a business address published on your own website. If it's not for you, no need to do anything. The code simply expires."

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' })
}

function inviteLink(c: string) {
  return `${SITE}/join/creative?code=${encodeURIComponent(c)}`
}

// Footer: why they got it, who sent it, and the unsubscribe link (layout adds the link after
// the question). Without a token (never on a real send) there is no link to offer.
function shell(blocks: string[], preheader: string, unsubUrl: string | null) {
  return layout({
    preheader,
    blocks,
    why: `${FOOTER_NOTE} ${SENDER_LINE}${unsubUrl ? ' Would you rather not hear from us?' : ''}`,
    unsubscribe: unsubUrl,
  })
}

function codeBox(c: string, expiresIso: string) {
  return code(c, 'Your personal code', `Works once, just for you. Expires ${fmtDate(expiresIso)}.`)
}

const signOff = () => [
  para('Any questions at all, just reply to this email. It comes straight to me.'),
  signoff('Michael', 'Founder, LensTrybe'),
]

export function inviteEmail(first: string, c: string, expiresIso: string, note: string, unsubUrl: string | null) {
  const name = first || 'there'
  return shell([
    heading('Founding creative invite', `Hi ${name}, I'd love you on board`),
    note ? quote(note) : '',
    para("I'm building LensTrybe: a home for Australian photographers and videographers where you keep everything you earn. No commission on your jobs, ever."),
    para("I'm hand-picking creatives for the founding 100, and I'd like you to be one of them. The places go to the first 100 who use their code."),
    list([
      `Our ${strong('Trybe Complete plan free for 12 months')} from the day you join (normally $74.99 a month), or 6 months if the 100 places have already gone`,
      `Then ${strong('$49 a month, or $588 a year, locked in for life')}`,
      'A Founding Creative badge on your profile, for the first 100 to claim a place',
      'A direct line to me, and a real say in what we build next',
    ], { html: true, title: 'What you get' }),
    list([
      'Get your profile 100% complete within 7 days of joining',
      'Run your next 3 real client jobs through LensTrybe within 6 months',
      'Share a little feedback each month. A sentence or two is plenty.',
    ], { title: 'What I ask in return' }),
    codeBox(c, expiresIso),
    button('Claim my founding place', inviteLink(c)),
    para(`The button takes you to sign up with your code already filled in. Just tap ${strong('Apply')} and follow the steps. You'll add a card at the end, but you won't be charged anything during your free period, and you can cancel any time.`, { html: true, small: true }),
    para(`The full details are in the ${link('Founding Creative Agreement', `${SITE}/founding-agreement`)}.`, { html: true, small: true }),
    ...signOff(),
  ], inviteSubject(first), unsubUrl)
}

export function reminderEmail(first: string, c: string, expiresIso: string, left: number | null, unsubUrl: string | null) {
  const name = first || 'there'
  return shell([
    heading('Your founding place', `Hi ${name}, your place is still here`),
    para('Just a quick nudge in case my last email got buried. Your founding invite is still open: Trybe Complete free, then $49 a month locked in for life, and no commission on your jobs, ever. Places go to the first 100 to use a code, so the sooner you claim it the better.'),
    para(`Your code expires on ${strong(fmtDate(expiresIso))}. After that the place goes to the next creative on my list.`, { html: true }),
    left !== null && left <= 40 ? para(`For what it's worth, ${strong(`${left} of the 100 places are left`)}.`, { html: true }) : '',
    codeBox(c, expiresIso),
    button('Claim my founding place', inviteLink(c)),
    para(`Tap the button, then ${strong('Apply')} next to your code. Everything's in the ${link('Founding Creative Agreement', `${SITE}/founding-agreement`)}.`, { html: true, small: true }),
    ...signOff(),
  ], reminderSubject(first, left), unsubUrl)
}

export function inviteSubject(first: string) {
  return first ? `${first}, I'd like you in LensTrybe's founding 100` : "An invitation to LensTrybe's founding 100"
}
export function reminderSubject(first: string, left: number | null) {
  const scarce = left !== null && left <= 40 ? `, ${left} places left` : ''
  return first ? `${first}, your founding place is still open${scarce}` : `Your founding place is still open${scarce}`
}

export function previews() {
  const unsub = `${SITE}/unsubscribe/00000000-0000-0000-0000-000000000000`
  const expires = '2026-10-13T09:00:00.000Z'
  const note = "Loved your Maleny wedding set on Instagram, Sam.\nThe light in that barn was something else."
  return [
    { id: 'invite', name: 'Founding invite from Michael, with a personal note', audience: 'creative', subject: inviteSubject('Sam'), from: FROM_PREVIEW, html: inviteEmail('Sam', 'SAM-7K2Q', expires, note, unsub) },
    { id: 'invite-nonote', name: 'Founding invite from Michael, no note', audience: 'creative', subject: inviteSubject('Sam'), from: FROM_PREVIEW, html: inviteEmail('Sam', 'SAM-7K2Q', expires, '', unsub) },
    { id: 'reminder', name: 'Founding invite reminder, 7 days left on the code', audience: 'creative', subject: reminderSubject('Sam', 62), from: FROM_PREVIEW, html: reminderEmail('Sam', 'SAM-7K2Q', expires, 62, unsub) },
    { id: 'reminder-scarce', name: 'Founding invite reminder when 40 or fewer places are left', audience: 'creative', subject: reminderSubject('Sam', 18), from: FROM_PREVIEW, html: reminderEmail('Sam', 'SAM-7K2Q', expires, 18, unsub) },
  ]
}
