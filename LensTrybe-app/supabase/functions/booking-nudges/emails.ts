// Emails sent by booking-nudges, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, strong, button, FROM, REPLY_TO } from './email.ts'

// To the client, once: their booking request has had no reply for 72 hours.
export function nudgeEmail(clientName: string, businessName: string, dateLabel: string, browseUrl: string) {
  return layout({
    blocks: [
      heading('Still waiting to hear back', `Hi ${clientName || 'there'}, no reply yet`),
      para(`${strong(businessName || 'The creative')} has not responded to your booking request for ${strong(dateLabel)} yet. They may simply be busy shooting, and your request is still open.`, { html: true }),
      para('If your date is coming up, it is worth having a second option lined up. There are other creatives on LensTrybe who may be free.'),
      button('Find another creative', browseUrl),
    ],
    why: 'Sent by LensTrybe because you made a booking request that has not had a reply yet.',
  })
}

export function previews() {
  return [
    {
      id: 'nudge', name: 'Booking request still unanswered after 72 hours, sent to the client', audience: 'client',
      subject: 'No reply yet from Coastline Photo', from: FROM, replyTo: REPLY_TO,
      html: nudgeEmail('Jo Harper', 'Coastline Photo', 'Sunday 14 March', 'https://lenstrybe.com/creatives'),
    },
  ]
}
