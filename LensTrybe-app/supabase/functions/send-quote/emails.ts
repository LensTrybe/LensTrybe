// Emails for send-quote. Pure functions: plain data in, { subject, html } out.
import { layout, heading, para, strong, button } from './email.ts'

const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'

export type QuoteEmailData = {
  business: string      // business name shown in the body (falls back to 'Your creative')
  subjectName: string   // business name for the subject, already made plain (falls back to 'Your Creative')
  amount: string        // formatted amount, e.g. 'AUD 1,026.00'
  docUrl: string        // link to the quote page
}

export function quoteEmail(d: QuoteEmailData): { subject: string, html: string } {
  const subject = `Quote from ${d.subjectName} - ${d.amount}`
  const html = layout({
    preheader: `${d.business} has sent you a quote for ${d.amount}.`,
    blocks: [
      heading('New quote', 'You have a new quote'),
      para(`${strong(d.business)} has sent you a quote for ${strong(d.amount)}.`, { html: true }),
      button('View your quote', d.docUrl),
      para('Open it any time with the button above. You can save a PDF copy from there. You can accept or decline it from your client portal.', { small: true }),
    ],
    why: `You're getting this because ${d.business} sent you a quote through LensTrybe.`,
  })
  return { subject, html }
}

export function previews() {
  const m = quoteEmail({
    business: 'Coastline Photo',
    subjectName: 'Coastline Photo',
    amount: 'AUD 1,026.00',
    docUrl: 'https://lenstrybe.com/doc/quote/3a9d7c21-8e4f-4b62-a1d0-5c7e9f2b6d34',
  })
  return [{ id: 'quote', name: 'Quote sent to a client', audience: 'client', subject: m.subject, from: FROM_PREVIEW, html: m.html }]
}
