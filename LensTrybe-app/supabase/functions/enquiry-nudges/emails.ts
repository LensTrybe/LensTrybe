// Emails sent by enquiry-nudges, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, strong, button, FROM, REPLY_TO } from './email.ts'

// To the creative, once per thread: a client enquiry has had no reply for 24 hours or more.
export function nudgeEmail(businessName: string, clientName: string, subject: string, waitedLabel: string, messagesUrl: string) {
  const who = clientName || 'A client'
  return layout({
    preheader: `${who} is still waiting to hear back from you`,
    blocks: [
      heading('Waiting on you', `${who} is still waiting`),
      para(`No reply yet after ${waitedLabel}`),
      para(`Hi ${businessName || 'there'},`),
      para(`${strong(who)} got in touch${subject ? ` about ${strong(subject)}` : ''} and has not heard back yet.`, { html: true }),
      para('Even a quick note saying you are on a job and will come back to them keeps the enquiry alive. Clients who get nothing back usually go elsewhere.'),
      button('Reply now', messagesUrl),
    ],
    why: 'You are getting this once for this enquiry, not every day.',
  })
}

export function previews() {
  return [
    {
      id: 'nudge', name: 'Unanswered enquiry reminder, sent to the creative after 24 hours', audience: 'creative',
      subject: 'Jo Harper is still waiting on your reply', from: FROM, replyTo: REPLY_TO,
      html: nudgeEmail('Coastline Photo', 'Jo Harper', 'Wedding in Maleny, Sun 14 Mar 2027', '2 days', 'https://lenstrybe.com/dashboard/clients/messages'),
    },
  ]
}
