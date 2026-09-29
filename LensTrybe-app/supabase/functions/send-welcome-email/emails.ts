// Emails sent by send-welcome-email, in the LensTrybe "Night" design (see email.ts).
// One welcome per account: founding creative, client, or creative.
import { layout, heading, para, strong, list, notice, button, esc, FROM } from './email.ts'

// Title and one line under it, with the original emoji in front.
const feature = (emoji: string, title: string, sub: string) => `${emoji} ${strong(title)}<br>${esc(sub)}`

// Creatives only show in Find a Creative once their profile has a photo, a tagline and a
// creative type, so this sits above the tour.
const listingCallout = () => notice(
  `${strong('First things first: you are not in Find a Creative yet')}<br>Clients can only find you once your profile has a photo, a tagline and at least one creative type. That is the whole list, and it takes about two minutes. Your own profile link works in the meantime.`,
  'green', { html: true },
)

const WHY = 'You got this because you just created a LensTrybe account.'

export function foundingWelcomeEmail(name: string) {
  return {
    subject: "You're a LensTrybe founding creative",
    html: layout({
      preheader: "Welcome, founding creative: here's exactly what to do next",
      blocks: [
        heading('Founding creative', `Welcome, ${name}. You're a founding creative.`),
        para("You've been hand-picked as one of the first creatives on LensTrybe. Here's what you get, and the three simple things we ask in return to keep your founding deal."),
        listingCallout(),
        list([
          feature('&#127775;', '12 months free Trybe Complete', 'The full Trybe Complete plan free for 12 months, then $49/mo locked in for life.'),
          feature('&#128081;', 'A permanent founding badge', 'Shown on your profile so clients know you were one of the originals.'),
          feature('&#128176;', 'Zero commission, always', 'Keep 100% of what you earn.'),
        ], { html: true, title: 'What you get' }),
        list([
          feature('&#9989;', 'A finished profile within 7 days', 'Beyond the photo, tagline and creative type above, fill out your bio, rates and portfolio so clients see a complete, credible profile.'),
          feature('&#128188;', 'Run your next 3 real jobs through LensTrybe', 'Send a quote, have the client accept it, then invoice and mark it paid.'),
          feature('&#128172;', 'Share one piece of feedback a month', 'Tell us what to build next, right from your Founding Hub.'),
        ], { html: true, title: 'What we ask, to keep your deal' }),
        button('Open your Founding Hub', 'https://lenstrybe.com/dashboard/founding'),
        para("Track all three at any time in your Founding Hub. Questions? Just reply to this email and we'll help.", { small: true }),
      ],
      why: WHY,
    }),
  }
}

export function clientWelcomeEmail(name: string) {
  return {
    subject: 'Welcome to LensTrybe!',
    html: layout({
      preheader: "Welcome to LensTrybe: find and book Australia's best creatives",
      blocks: [
        heading('Welcome', `Welcome, ${name}!`),
        para("You've just joined LensTrybe, the home of Australia's best photographers, videographers and visual creatives."),
        list([
          feature('&#128269;', 'Discover creatives', 'Browse portfolios and find the right creative for your shoot'),
          feature('&#128172;', 'Enquire and message', 'Reach out directly and chat with creatives in one place'),
          feature('&#128193;', 'Your client portal', 'Track conversations, quotes, contracts and delivered files'),
        ], { html: true, title: "Here's what you can do" }),
        button('Find a creative', 'https://lenstrybe.com/creatives'),
        para("Questions? Just reply to this email and we'll help.", { small: true }),
      ],
      why: WHY,
    }),
  }
}

export function creativeWelcomeEmail(name: string) {
  return {
    subject: 'Welcome to LensTrybe!',
    html: layout({
      preheader: 'Welcome to LensTrybe: your creative business, all in one place',
      blocks: [
        heading('Welcome', `Welcome, ${name}!`),
        para("You've just joined LensTrybe, the platform built to help Australian creatives run their business, showcase their work, and connect with clients."),
        listingCallout(),
        list([
          feature('&#128248;', 'Your portfolio website', 'Showcase your work with a stunning branded profile site'),
          feature('&#128176;', 'Invoicing and quotes', 'Send professional invoices and quotes to clients'),
          feature('&#128221;', 'Contracts', 'Create and send contracts for e-signature'),
          feature('&#128172;', 'Client messaging', 'Two-way messaging with your clients and other creatives'),
          feature('&#128230;', 'File delivery', 'Deliver photos and files with secure download links'),
        ], { html: true, title: "Here's what you can do" }),
        button('Finish your profile', 'https://lenstrybe.com/dashboard/profile/edit-profile'),
        para("Questions? Just reply to this email and we'll help.", { small: true }),
      ],
      why: WHY,
    }),
  }
}

export function previews() {
  const f = foundingWelcomeEmail('Coastline Photo')
  const c = clientWelcomeEmail('Jo Harper')
  const k = creativeWelcomeEmail('Sam Lee')
  return [
    { id: 'founding', name: 'Welcome for a founding creative', audience: 'creative', subject: f.subject, from: FROM, html: f.html },
    { id: 'client', name: 'Welcome for a new client', audience: 'client', subject: c.subject, from: FROM, html: c.html },
    { id: 'creative', name: 'Welcome for a new creative', audience: 'creative', subject: k.subject, from: FROM, html: k.html },
  ]
}
