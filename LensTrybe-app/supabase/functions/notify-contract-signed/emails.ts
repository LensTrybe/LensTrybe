// Emails for notify-contract-signed. Pure functions: plain data in, { subject, html } out.
import { layout, heading, para, facts, button } from './email.ts'

const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'

export type ContractSignedData = {
  clientName: string            // plain client name, or 'Your client'
  clientEmail?: string | null
  title?: string | null         // contract title
  signedAt: string              // formatted date and time
}

// Sent to the creative when their client signs a contract.
export function contractSignedEmail(d: ContractSignedData): { subject: string, html: string } {
  const subject = `${d.clientName} signed your contract`
  const html = layout({
    preheader: `${d.clientName} has signed "${d.title || 'your contract'}"`,
    blocks: [
      heading('Contract signed', `${d.clientName} signed your contract`),
      para('Good news, your contract has been signed and is now locked in.'),
      facts([
        ['Contract', d.title || 'Contract'],
        ['Signed by', `${d.clientName}${d.clientEmail ? ` · ${d.clientEmail}` : ''}`],
        ['Signed at', d.signedAt],
      ]),
      button('View in your dashboard', 'https://lenstrybe.com/dashboard/finance/contracts'),
    ],
    why: "You're getting this because a client signed a contract you sent on LensTrybe.",
  })
  return { subject, html }
}

export function previews() {
  const m = contractSignedEmail({ clientName: 'Jo Harper', clientEmail: 'jo.harper@gmail.com', title: 'Wedding photography agreement, Maleny', signedAt: '29 Sept 2026, 7:42 pm AEST' })
  return [{ id: 'signed', name: 'Client signed a contract (to the creative)', audience: 'creative', subject: m.subject, from: FROM_PREVIEW, html: m.html }]
}
