// Emails sent by send-booking-update, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, button, facts, link, FROM } from './email.ts'

// Status as people see it: capitalised (the old design did this with CSS), with the American
// "canceled" spelled the Australian way.
function statusLabel(s: string) {
  const t = String(s || '').trim()
  if (t.toLowerCase() === 'canceled') return 'Cancelled'
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// To the client: the creative confirmed, declined or changed the status of a booking.
// Confirmed bookings also carry an .ics attachment (added in index.ts) and, when there is a
// view token, an "Add to calendar" link.
export function bookingUpdateHtml(d: {
  businessName: string, confirmed: boolean, declined: boolean,
  service?: string | null, bookingDate?: string | null, allDay?: boolean, startTime?: string | null, endTime?: string | null, location?: string | null,
  status: string, addUrl?: string,
}) {
  const kicker = d.confirmed ? 'Booking confirmed' : d.declined ? 'Booking update' : 'Booking update'
  const title = d.confirmed ? 'Your booking is confirmed' : d.declined ? 'An update on your booking' : 'Your booking has been updated'
  const intro = d.confirmed
    ? `Great news, ${d.businessName} has confirmed your booking.`
    : d.declined
      ? `${d.businessName} is unable to take this booking. Feel free to reach out to them to find another time.`
      : `${d.businessName} has updated the status of your booking.`
  const dateStr = d.bookingDate ? new Date(d.bookingDate).toLocaleDateString('en-AU', { dateStyle: 'full' }) : ''
  const timeStr = d.allDay
    ? 'All day'
    : [d.startTime, d.endTime].every(Boolean)
      ? `${String(d.startTime).slice(0, 5)} to ${String(d.endTime).slice(0, 5)}`
      : ''
  return layout({
    preheader: intro,
    blocks: [
      heading(kicker, title),
      para(intro),
      facts([
        ['Service', d.service || 'Booking'],
        ['Date', dateStr],
        ['Time', timeStr],
        ['Location', d.location || ''],
        ['Status', statusLabel(d.status)],
      ]),
      button('View on LensTrybe', 'https://lenstrybe.com/client-dashboard'),
      d.addUrl ? para(link('Add to calendar', d.addUrl), { html: true }) : '',
      para(d.addUrl
        ? 'Add to calendar puts this straight in your calendar. The attached file does the same if your email app prefers it. You can reply straight to this email to reach your creative.'
        : 'You can reply straight to this email to reach your creative.', { small: true }),
    ],
    why: `You got this because you have a booking with ${d.businessName} on LensTrybe.`,
  })
}

export function previews() {
  const base = { businessName: 'Coastline Photo', service: 'Wedding photography', bookingDate: '2027-03-14', allDay: false, startTime: '13:00:00', endTime: '21:00:00', location: 'Maleny Manor, Maleny QLD' }
  return [
    {
      id: 'confirmed', name: 'Booking confirmed, sent to the client (with Add to calendar and .ics file)', audience: 'client',
      subject: 'Your booking with Coastline Photo is confirmed', from: FROM,
      html: bookingUpdateHtml({ ...base, confirmed: true, declined: false, status: 'confirmed', addUrl: 'https://lqafxisymvrazipaozfk.supabase.co/functions/v1/calendar-feed?booking=7c1e9a52' }),
    },
    {
      id: 'declined', name: 'Booking declined or cancelled, sent to the client', audience: 'client',
      subject: 'An update on your booking with Coastline Photo', from: FROM,
      html: bookingUpdateHtml({ ...base, confirmed: false, declined: true, status: 'declined' }),
    },
    {
      id: 'updated', name: 'Booking status changed (any other status), sent to the client', audience: 'client',
      subject: 'An update on your booking with Coastline Photo', from: FROM,
      html: bookingUpdateHtml({ ...base, allDay: true, confirmed: false, declined: false, status: 'completed' }),
    },
  ]
}
