// Emails sent by send-enquiry, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, strong, link, button, facts, quote, esc, FROM } from './email.ts'

// To the creative: a new enquiry has arrived. Reply-to is the client.
export function enquiryToCreativeHtml(d: { clientName: string, clientEmail: string, subjectText: string, firstMessage: string, dashboardUrl: string }) {
  const mailto = `mailto:${encodeURIComponent(d.clientEmail).replace(/%40/g, '@')}`
  return layout({
    preheader: `${d.clientName} wants to work with you`,
    blocks: [
      heading('New enquiry', `${d.clientName} wants to work with you`),
      para('A new enquiry just landed in your inbox.'),
      para(`From ${strong(d.clientName)}${d.clientEmail ? ` &middot; ${link(d.clientEmail, mailto)}` : ''}`, { html: true }),
      facts([['Subject', d.subjectText]]),
      d.firstMessage ? quote(d.firstMessage, 'Message') : '',
      button('Reply in your dashboard', d.dashboardUrl),
      para('Tip: you can reply directly to this email and it will reach the client.', { small: true }),
    ],
    why: 'You got this because a client sent you an enquiry on LensTrybe.',
  })
}

// To the client: their enquiry was received, with their portal link.
export function enquiryToClientHtml(d: { greetName: string, businessName: string, portalUrl: string }) {
  return layout({
    preheader: `${d.businessName} has received your enquiry`,
    blocks: [
      heading('Enquiry received', 'Your enquiry has been received'),
      para(`${d.greetName ? `Hi ${esc(d.greetName)}, t` : 'T'}hanks for reaching out to ${strong(d.businessName)}. They&#39;ll be in touch soon.`, { html: true }),
      para(`You can track your conversation and view anything ${strong(d.businessName)} shares with you through your personal client portal below.`, { html: true }),
      button('Open my portal', d.portalUrl),
    ],
    why: "Keep this email. It contains your unique portal link. If you didn't make this enquiry, you can ignore this email.",
  })
}

export function previews() {
  return [
    {
      id: 'creative', name: 'New enquiry, sent to the creative', audience: 'creative',
      subject: 'New enquiry from Jo Harper', from: FROM,
      html: enquiryToCreativeHtml({ clientName: 'Jo Harper', clientEmail: 'jo.harper@gmail.com', subjectText: 'Wedding in Maleny, Sun 14 Mar 2027', firstMessage: "Hi Sam,\n\nWe're getting married in Maleny on Sunday 14 March 2027 and love your work. Are you free, and what would full-day coverage cost?\n\nThanks, Jo", dashboardUrl: 'https://lenstrybe.com/dashboard/clients/messages' }),
    },
    {
      id: 'client', name: 'Enquiry received, sent to the client', audience: 'client',
      subject: 'Your enquiry to Coastline Photo has been received', from: FROM,
      html: enquiryToClientHtml({ greetName: 'Jo Harper', businessName: 'Coastline Photo', portalUrl: 'https://lenstrybe.com/portal/3f9c2a7e1b' }),
    },
  ]
}
