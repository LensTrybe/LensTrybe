// Emails sent by send-reply-notification, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, button, quote, FROM } from './email.ts'

// To the client: the creative replied in their thread. Reply-to is the creative.
export function replyToClientHtml(d: { businessName: string, clientName: string, message: string, portalUrl: string }) {
  return layout({
    preheader: `${d.businessName} replied to your conversation`,
    blocks: [
      heading('New message', `${d.businessName} sent you a message`),
      d.clientName ? para(`Hi ${d.clientName},`) : '',
      quote(d.message),
      button('Reply in your portal', d.portalUrl),
      para('You can reply straight to this email, or open your portal to see the full conversation.', { small: true }),
    ],
    why: `You got this because ${d.businessName} replied to your conversation on LensTrybe.`,
  })
}

export function previews() {
  return [
    {
      id: 'client', name: 'Creative replied, sent to the client', audience: 'client',
      subject: 'New message from Coastline Photo', from: FROM,
      html: replyToClientHtml({ businessName: 'Coastline Photo', clientName: 'Jo Harper', message: "Hi Jo,\n\nCongratulations! I'm free on Sun 14 Mar 2027. Full-day coverage in Maleny is $1,026.00. Happy to jump on a call this week.\n\nSam", portalUrl: 'https://lenstrybe.com/portal/3f9c2a7e1b' }),
    },
  ]
}
