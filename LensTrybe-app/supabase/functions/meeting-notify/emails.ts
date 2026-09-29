// Emails sent by meeting-notify, in the LensTrybe "Night" design (see email.ts).
// Both go to the client, from "<creative> (via LensTrybe)", reply-to the creative.
// Subjects are built in index.ts.
import { layout, heading, para, facts, quote } from './email.ts'

// The creative confirmed the client's meeting or call.
export function meetingConfirmedHtml(d: { hostName: string, isPhone: boolean, when: string, location?: unknown, description?: unknown }) {
  return layout({
    blocks: [
      heading('Confirmed', `You’re booked in with ${d.hostName}`),
      para(`Your ${d.isPhone ? 'phone call' : 'meeting'} is confirmed for the time below.`),
      facts([['When', d.when], ['How', d.isPhone ? 'Phone call' : String(d.location || 'Details to follow')]]),
      d.description ? quote(d.description, 'Details') : '',
      para('Need to change it? Just reply to this email.', { small: true }),
    ],
    why: `You got this because you have a ${d.isPhone ? 'call' : 'meeting'} with ${d.hostName} arranged through LensTrybe.`,
  })
}

// The creative can't make the time the client asked for.
export function meetingDeclinedHtml(d: { hostName: string }) {
  return layout({
    blocks: [
      heading('', `About your request with ${d.hostName}`),
      para(`Unfortunately ${d.hostName} isn’t able to make the time you requested. Feel free to reply with another time that suits you and they’ll do their best to fit you in.`),
      para(`Reply to this email to reach ${d.hostName} directly.`, { small: true }),
    ],
    why: `You got this because you asked ${d.hostName} for a meeting through LensTrybe.`,
  })
}

export function previews() {
  const from = 'Coastline Photo (via LensTrybe) <noreply@mail.lenstrybe.com>'
  return [
    {
      id: 'confirmed-meeting', name: 'Meeting confirmed, sent to the client', audience: 'client',
      subject: 'Your meeting with Coastline Photo is confirmed', from,
      html: meetingConfirmedHtml({ hostName: 'Coastline Photo', isPhone: false, when: 'Tuesday 2 February 2027 · 10am to 11am', location: 'Maleny Botanic Gardens café', description: 'We will walk the ceremony spot together.' }),
    },
    {
      id: 'confirmed-call', name: 'Phone call confirmed, sent to the client', audience: 'client',
      subject: 'Your call with Coastline Photo is confirmed', from,
      html: meetingConfirmedHtml({ hostName: 'Coastline Photo', isPhone: true, when: 'Thursday 4 February 2027 · 2pm' }),
    },
    {
      id: 'declined', name: 'Meeting or call request declined, sent to the client', audience: 'client',
      subject: 'Update on your call request', from,
      html: meetingDeclinedHtml({ hostName: 'Coastline Photo' }),
    },
  ]
}
