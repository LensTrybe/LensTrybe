// Emails sent by waitlist-signup, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, link, notice, facts, signoff } from './email.ts'

const IG = 'https://instagram.com/lenstrybe'

// To the person who joined. Marketing consent is part of joining, so it carries the
// unsubscribe link (and a List-Unsubscribe header, set in index.ts) when there is one.
// live: whether launch (1 October 2026, AEST) has passed. This email goes out either side of
// launch. Before 1 October it reaches people joining from the coming soon page, after it, people
// in states we have not opened in yet. Telling the first group we are already live was simply
// untrue, so the copy reads the clock (index.ts passes Date.now() >= LAUNCH).
export function waitlistConfirmationHtml(opts: { audience: string; refLink: string; unsubscribeUrl: string | null; live: boolean }) {
  const { audience, refLink, unsubscribeUrl, live } = opts
  const where = live
    ? `LensTrybe is live across South East Queensland and rolling out across Australia city by city.`
    : `LensTrybe opens on 1 October, starting in South East Queensland and rolling out across Australia city by city.`
  const body = audience === 'client'
    ? `${where} We'll let you know the moment you can book creatives in your area.`
    : `${where} We'll let you know the moment we open in your area. Your first three months are free, and there are no commissions, ever. You keep 100% of what you earn.`
  return layout({
    blocks: [
      heading(live ? 'Live in South East Queensland' : 'Opening 1 October 2026', "You're on the list."),
      para(body),
      audience === 'creative'
        ? notice(`Want to help bring LensTrybe to your city sooner? Share your link.<br>${link(refLink, refLink)}`, 'green', { html: true })
        : '',
      para(`Follow ${link('@LensTrybe', IG)} to keep up with our progress.`, { html: true }),
      signoff('The LensTrybe Team'),
    ],
    why: `You got this because you joined the LensTrybe waitlist. No spam.${unsubscribeUrl ? '' : ' Unsubscribe any time.'}`,
    unsubscribe: unsubscribeUrl,
  })
}

// To connect@lenstrybe.com, reply-to the person who joined.
export function waitlistNotifyHtml(opts: { email: string; audience: string; creativeType: string | null; city: string | null; state: string | null; referredBy: string | null }) {
  const { email, audience, creativeType, city, state, referredBy } = opts
  const loc = [city, state].filter(Boolean).join(', ')
  return layout({
    blocks: [
      heading('Waitlist', 'New waitlist signup'),
      facts([
        ['Email', email],
        ['Type', audience === 'creative' ? 'Creative' : 'Hiring / client'],
        ['Discipline', creativeType],
        ['Location', loc],
        ['Referred by', referredBy],
      ]),
    ],
    why: 'You got this because someone joined the LensTrybe waitlist.',
  })
}

export function previews() {
  const refLink = 'https://lenstrybe.com/?ref=K7M2QXP'
  const unsub = 'https://lenstrybe.com/unsubscribe/5b1e7c2a-9d34-4f8e-a6b0-2c3d4e5f6a7b'
  const from = 'LensTrybe <noreply@mail.lenstrybe.com>'
  const subject = "You're on the LensTrybe list"
  return [
    { id: 'creative-before-launch', name: 'Waitlist confirmation for a creative, before launch', audience: 'creative', subject, from, html: waitlistConfirmationHtml({ audience: 'creative', refLink, unsubscribeUrl: unsub, live: false }) },
    { id: 'creative-after-launch', name: 'Waitlist confirmation for a creative, after launch', audience: 'creative', subject, from, html: waitlistConfirmationHtml({ audience: 'creative', refLink, unsubscribeUrl: unsub, live: true }) },
    { id: 'client-before-launch', name: 'Waitlist confirmation for a client, before launch', audience: 'client', subject, from, html: waitlistConfirmationHtml({ audience: 'client', refLink, unsubscribeUrl: unsub, live: false }) },
    { id: 'client-after-launch', name: 'Waitlist confirmation for a client, after launch', audience: 'client', subject, from, html: waitlistConfirmationHtml({ audience: 'client', refLink, unsubscribeUrl: unsub, live: true }) },
    { id: 'creative-no-unsub', name: 'Waitlist confirmation when the address had already unsubscribed (no link)', audience: 'creative', subject, from, html: waitlistConfirmationHtml({ audience: 'creative', refLink, unsubscribeUrl: null, live: true }) },
    {
      id: 'notify', name: 'New waitlist signup, sent to connect@lenstrybe.com', audience: 'staff',
      subject: 'New waitlist signup: creative (Noosa Heads)', from: 'LensTrybe Waitlist <noreply@mail.lenstrybe.com>',
      html: waitlistNotifyHtml({ email: 'sam@coastlinephoto.com.au', audience: 'creative', creativeType: 'Wedding photographer', city: 'Noosa Heads', state: 'QLD', referredBy: 'K7M2QXP' }),
    },
  ]
}
