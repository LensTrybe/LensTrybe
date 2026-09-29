// Emails for send-invoice. Pure functions: plain data in, { subject, html } out.
import { layout, heading, para, strong, button } from './email.ts'

const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'

export type InvoiceEmailData = {
  business: string      // business name shown in the body (falls back to 'Your creative')
  subjectName: string   // business name for the subject, already made plain (falls back to 'Your Creative')
  amount: string        // formatted amount, e.g. 'AUD 1,026.00'
  docUrl: string        // link to the invoice page
}

export function invoiceEmail(d: InvoiceEmailData): { subject: string, html: string } {
  const subject = `Invoice from ${d.subjectName} - ${d.amount}`
  const html = layout({
    preheader: `${d.business} has sent you an invoice for ${d.amount}.`,
    blocks: [
      heading('New invoice', 'You have a new invoice'),
      para(`${strong(d.business)} has sent you an invoice for ${strong(d.amount)}.`, { html: true }),
      button('View your invoice', d.docUrl),
      para('Open it any time with the button above. You can save a PDF copy from there.', { small: true }),
    ],
    why: `You're getting this because ${d.business} sent you an invoice through LensTrybe.`,
  })
  return { subject, html }
}

export function previews() {
  const m = invoiceEmail({
    business: 'Coastline Photo',
    subjectName: 'Coastline Photo',
    amount: 'AUD 1,026.00',
    docUrl: 'https://lenstrybe.com/doc/invoice/6f1c2a9e-4b7d-4e21-9a3c-0d5e8b7f2a11',
  })
  return [{ id: 'invoice', name: 'Invoice sent to a client', audience: 'client', subject: m.subject, from: FROM_PREVIEW, html: m.html }]
}
