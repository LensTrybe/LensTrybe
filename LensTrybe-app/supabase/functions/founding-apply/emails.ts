// Emails for founding-apply. Pure functions: plain data in, html out.
// The subject is built at the send site in index.ts (it is per recipient and trimmed there).
import { layout, heading, para, strong, esc, link, facts, quote, button } from './email.ts'

const APP = 'https://lenstrybe.com'
const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'

export type Application = {
  name: string
  business: string
  email: string
  portfolio: string      // already tidied to an http(s) URL by tidyLink()
  creativeType: string
  region: string
  note: string
}

// Sent to every admin when a new founding application arrives. Reply-to is the applicant.
export function applicationEmail(a: Application) {
  const shown = a.portfolio.replace(/^https?:\/\//i, '').replace(/\/$/, '')
  return layout({
    preheader: `${a.name} from ${a.business} applied for the founding offer`,
    blocks: [
      heading('Founding offer', 'New founding application'),
      para(`${esc(a.name)} from ${strong(a.business)} wants a founding place.`, { html: true }),
      facts([
        ['Name', a.name],
        ['Business', a.business],
        ['What they do', a.creativeType],
        ['Where', a.region],
      ]),
      para(`Email: ${link(a.email, `mailto:${a.email}`)}<br>Their work: <span style="word-break:break-all;">${link(shown, a.portfolio)}</span>`, { html: true }),
      a.note ? quote(a.note, 'Their note') : '',
      button('Review in LensTrybe HQ', 'https://hq.lenstrybe.com/founding'),
      para('Reply to this email to write to them directly. Invite them from the Applications card, which fills in the invite form with their details.', { small: true }),
    ],
    why: "You're getting this because you're a LensTrybe admin and someone applied for a founding place.",
  })
}

export function previews() {
  const a: Application = {
    name: 'Sam Lee', business: 'Coastline Photo', email: 'sam@coastlinephoto.com.au',
    portfolio: 'https://instagram.com/coastlinephoto', creativeType: 'Wedding photographer', region: 'Noosa Heads, QLD',
    note: "I shoot about 30 weddings a year around the Sunshine Coast.\nKeen to stop paying commission on every booking.",
  }
  const subject = (x: Application) => `Founding application: ${x.name}, ${x.business}`.slice(0, 150)
  const bare: Application = { ...a, creativeType: '', region: '', note: '', portfolio: 'https://coastlinephoto.com.au/' }
  return [
    { id: 'new-application', name: 'New founding application, sent to every admin', audience: 'staff', subject: subject(a), from: FROM_PREVIEW, html: applicationEmail(a) },
    { id: 'new-application-minimal', name: 'New founding application with only the required fields', audience: 'staff', subject: subject(bare), from: FROM_PREVIEW, html: applicationEmail(bare) },
  ]
}
