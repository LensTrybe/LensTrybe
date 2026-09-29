// Emails for respond-quote. Pure functions: plain data in, { subject, html } out.
import { layout, heading, para, facts, button } from './email.ts'

const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'

export type QuoteResponseData = {
  clientName: string        // client name, or 'Your client'
  accepted: boolean
  quoteId: string           // the quote's id
  amount: string | null     // formatted amount, or null when the quote has none
}

// Sent to the creative when a client accepts or declines their quote.
export function quoteResponseEmail(d: QuoteResponseData): { subject: string, html: string } {
  const { clientName, accepted } = d
  const subject = accepted ? `${clientName} accepted your quote` : `${clientName} declined your quote`
  const html = layout({
    preheader: subject,
    blocks: [
      heading(accepted ? 'Quote accepted' : 'Quote declined', subject),
      para(accepted ? 'Nice work. You can move ahead when you are ready.' : `${clientName} has declined this quote. You may want to follow up with them.`),
      facts([
        ['Quote', `#${String(d.quoteId).slice(0, 8).toUpperCase()}`],
        ['Amount', d.amount],
        ['Response', accepted ? 'Accepted' : 'Declined'],
      ]),
      button('View in your dashboard', 'https://lenstrybe.com/dashboard/finance/quotes'),
      para('Tip: you can reply directly to this email to reach the client.', { small: true }),
    ],
    why: "You're getting this because a client responded to a quote you sent on LensTrybe.",
  })
  return { subject, html }
}

export function previews() {
  const base = { clientName: 'Jo Harper', quoteId: '3a9d7c21-8e4f-4b62-a1d0-5c7e9f2b6d34', amount: '$1,026.00' }
  return [
    { id: 'accepted', name: 'Client accepted a quote (to the creative)', accepted: true },
    { id: 'declined', name: 'Client declined a quote (to the creative)', accepted: false },
  ].map((p) => {
    const m = quoteResponseEmail({ ...base, accepted: p.accepted })
    return { id: p.id, name: p.name, audience: 'creative', subject: m.subject, from: FROM_PREVIEW, html: m.html }
  })
}
