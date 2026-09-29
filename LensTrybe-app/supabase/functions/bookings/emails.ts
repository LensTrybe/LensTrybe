// Emails sent by bookings, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, button, facts, quote, FROM } from './email.ts'

// The booking details every email shows. when is whenText() from index.ts.
export type Details = { when: string, service?: string | null, location?: string | null }

const details = (b: Details, extra: [string, unknown][] = []) =>
  facts([['When', b.when], ['Service', b.service || ''], ['Location', b.location || ''], ...extra])

// Something a person wrote, under its label (message, note, reason). Nothing when empty.
const written = (label: string, text: string) => text ? quote(text, label) : ''

// request: to the creative. Reply-to is the client.
export function requestToCreativeHtml(d: Details & { clientName: string, clientEmail: string, phone: string, message: string, url: string }) {
  return layout({
    preheader: `${d.clientName} wants to book you for ${d.when}`,
    blocks: [
      heading('Booking request', `${d.clientName} wants to book you`),
      para('Accept or decline the request from your dashboard. The client is notified either way.'),
      details(d, [['Client', d.clientName], ['Email', d.clientEmail], ['Phone', d.phone]]),
      written('Message', d.message),
      button('Review the request', d.url),
      para('You can reply directly to this email to reach the client.', { small: true }),
    ],
    why: 'You got this because a client sent you a booking request on LensTrybe.',
  })
}

// request: to the client, confirming it was sent. Reply-to is the creative.
export function requestToClientHtml(d: Details & { creativeName: string, url: string }) {
  return layout({
    preheader: `${d.creativeName} will reply soon`,
    blocks: [
      heading('Request sent', 'Your booking request is on its way'),
      para(`${d.creativeName} will accept or decline it soon. We'll email you as soon as they reply. Nothing is booked until they accept.`),
      details(d),
      button('View your bookings', d.url),
    ],
    why: `You got this because you sent ${d.creativeName} a booking request on LensTrybe.`,
  })
}

// create (with notifyClient): to the client. The button only shows when they have a LensTrybe account.
export function createdToClientHtml(d: Details & { creativeName: string, clientName: string, url?: string }) {
  return layout({
    preheader: `Confirmed for ${d.when}`,
    blocks: [
      heading('Booking confirmed', `You're booked with ${d.creativeName}`),
      para(`Hi ${d.clientName}, ${d.creativeName} has confirmed your booking. Reply to this email if anything needs to change.`),
      details(d),
      d.url ? button('View your bookings', d.url) : '',
    ],
    why: `You got this because ${d.creativeName} booked you in through LensTrybe.`,
  })
}

// respond: to the client, accepted or declined.
export function responseToClientHtml(d: Details & { accept: boolean, creativeName: string, note: string, url: string }) {
  return layout({
    preheader: d.when,
    blocks: [
      heading(d.accept ? 'Booking confirmed' : 'Booking declined', d.accept ? `You're booked with ${d.creativeName}` : `${d.creativeName} can't take this booking`),
      para(d.accept
        ? `Great news. ${d.creativeName} has accepted your booking request. Reply to this email to sort out the details.`
        : `Sorry, ${d.creativeName} isn't able to take this booking. You're welcome to request another date or find another creative on LensTrybe.`),
      details(d),
      written('Note from the creative', d.note),
      button(d.accept ? 'View your bookings' : 'Find a creative', d.url),
    ],
    why: `You got this because you sent ${d.creativeName} a booking request on LensTrybe.`,
  })
}

// reschedule (with notifyClient): to the client. previously is the old time, only when it moved.
export function rescheduleToClientHtml(d: Details & { creativeName: string, moved: boolean, previously: string, note: string, url?: string }) {
  return layout({
    preheader: d.when,
    blocks: [
      heading('Booking updated', d.moved ? 'Your booking has a new time' : 'Your booking details have changed'),
      para(`${d.creativeName} has updated your booking. Here are the latest details. Reply to this email if it doesn't suit.`),
      details(d, [['Previously', d.moved ? d.previously : '']]),
      written('Note from the creative', d.note),
      d.url ? button('View your bookings', d.url) : '',
    ],
    why: `You got this because you have a booking with ${d.creativeName} on LensTrybe.`,
  })
}

// cancel by the creative: to the client.
export function creativeCancelledHtml(d: Details & { creativeName: string, reason: string, url: string }) {
  return layout({
    preheader: d.when,
    blocks: [
      heading('Booking cancelled', `${d.creativeName} has cancelled your booking`),
      para('Sorry for the change of plans. Reply to this email if you have any questions, or find another creative on LensTrybe.'),
      details(d),
      written('Reason', d.reason),
      button('Find a creative', d.url),
    ],
    why: `You got this because you had a booking with ${d.creativeName} on LensTrybe.`,
  })
}

// cancel by the client: to the creative. wasRequest: they withdrew a request not yet answered.
export function clientCancelledHtml(d: Details & { who: string, wasRequest: boolean, reason: string, url: string }) {
  return layout({
    preheader: d.when,
    blocks: [
      heading('Booking cancelled', d.wasRequest ? `${d.who} withdrew their request` : `${d.who} cancelled their booking`),
      para(d.wasRequest ? 'No action needed.' : 'That time is free again on your calendar.'),
      details(d),
      written('Reason', d.reason),
      button('Open bookings', d.url),
    ],
    why: 'You got this because a client changed a booking with you on LensTrybe.',
  })
}

export function previews() {
  const b: Details = { when: 'Sunday, 14 March 2027, 1:00pm to 9:00pm', service: 'Wedding photography', location: 'Maleny Manor, Maleny QLD' }
  const creativeUrl = 'https://lenstrybe.com/dashboard/my-work/my-bookings?booking=7c1e9a52'
  const clientUrl = 'https://lenstrybe.com/client-dashboard?view=bookings&booking=7c1e9a52'
  return [
    { id: 'request-creative', name: 'New booking request, sent to the creative', audience: 'creative', subject: 'New booking request from Jo Harper', from: FROM,
      html: requestToCreativeHtml({ ...b, clientName: 'Jo Harper', clientEmail: 'jo.harper@gmail.com', phone: '0412 345 678', message: "Hi Sam,\nCeremony at 2pm, reception until 9pm. Can you cover both?\nJo", url: creativeUrl }) },
    { id: 'request-client', name: 'Booking request sent, confirmation to the client', audience: 'client', subject: 'Your booking request to Coastline Photo has been sent', from: FROM,
      html: requestToClientHtml({ ...b, creativeName: 'Coastline Photo', url: clientUrl }) },
    { id: 'created-client', name: 'Creative added a confirmed booking, sent to the client', audience: 'client', subject: 'Your booking with Coastline Photo is confirmed', from: FROM,
      html: createdToClientHtml({ ...b, creativeName: 'Coastline Photo', clientName: 'Jo Harper', url: clientUrl }) },
    { id: 'accepted-client', name: 'Booking request accepted, sent to the client', audience: 'client', subject: 'Coastline Photo accepted your booking', from: FROM,
      html: responseToClientHtml({ ...b, accept: true, creativeName: 'Coastline Photo', note: "Can't wait! I'll send a questionnaire closer to the day.", url: clientUrl }) },
    { id: 'declined-client', name: 'Booking request declined, sent to the client', audience: 'client', subject: "Coastline Photo can't take your booking", from: FROM,
      html: responseToClientHtml({ ...b, accept: false, creativeName: 'Coastline Photo', note: "Sorry Jo, I'm already booked that weekend.", url: 'https://lenstrybe.com/creatives' }) },
    { id: 'rescheduled-client', name: 'Booking moved to a new time, sent to the client', audience: 'client', subject: 'Your booking with Coastline Photo has been updated', from: FROM,
      html: rescheduleToClientHtml({ ...b, when: 'Sunday, 14 March 2027, 12:00pm to 9:00pm', creativeName: 'Coastline Photo', moved: true, previously: b.when, note: 'Starting an hour earlier for the getting-ready shots.', url: clientUrl }) },
    { id: 'details-changed-client', name: 'Booking details changed (same time), sent to the client', audience: 'client', subject: 'Your booking with Coastline Photo has been updated', from: FROM,
      html: rescheduleToClientHtml({ ...b, location: 'Montville Chapel, Montville QLD', creativeName: 'Coastline Photo', moved: false, previously: '', note: '' }) },
    { id: 'cancelled-by-creative', name: 'Creative cancelled the booking, sent to the client', audience: 'client', subject: 'Coastline Photo has cancelled your booking', from: FROM,
      html: creativeCancelledHtml({ ...b, creativeName: 'Coastline Photo', reason: 'Family emergency, so sorry Jo.', url: 'https://lenstrybe.com/creatives' }) },
    { id: 'cancelled-by-client', name: 'Client cancelled their booking, sent to the creative', audience: 'creative', subject: 'Jo Harper cancelled their booking', from: FROM,
      html: clientCancelledHtml({ ...b, who: 'Jo Harper', wasRequest: false, reason: "We've moved the wedding to 2028.", url: creativeUrl }) },
    { id: 'withdrawn-by-client', name: 'Client withdrew a booking request, sent to the creative', audience: 'creative', subject: 'Jo Harper withdrew their booking request', from: FROM,
      html: clientCancelledHtml({ ...b, who: 'Jo Harper', wasRequest: true, reason: '', url: creativeUrl }) },
  ]
}
