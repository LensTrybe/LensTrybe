// Emails sent by send-event-invite, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, facts, quote } from './email.ts'

// To each invitee of a creative's calendar event, with an invite.ics attached.
// From "<creative> (via LensTrybe)", reply-to the creative. The subject is built in index.ts.
export function eventInviteHtml(d: { hostName: string, title: unknown, when: string, location?: unknown, notes?: unknown }) {
  return layout({
    blocks: [
      heading("You're invited", String(d.title ?? '')),
      para(`${d.hostName} has invited you to an event.`),
      facts([['When', d.when], ['Where', d.location]]),
      d.notes ? quote(d.notes, 'Notes') : '',
      para(`The attached invite (.ics) can be added to your Apple, Google or Outlook calendar. Reply to this email to reach ${d.hostName}.`, { small: true }),
    ],
    why: `You got this because ${d.hostName} invited you to an event using LensTrybe.`,
  })
}

export function previews() {
  const from = 'Coastline Photo (via LensTrybe) <noreply@mail.lenstrybe.com>'
  return [
    {
      id: 'invite', name: 'Calendar event invite, sent to each invitee', audience: 'anyone',
      subject: 'Coastline Photo invited you: Harper wedding, Maleny', from,
      html: eventInviteHtml({ hostName: 'Coastline Photo', title: 'Harper wedding, Maleny', when: 'Saturday 14 March 2027 · 1pm to 9pm', location: 'Maleny Manor, Maleny QLD', notes: 'Ceremony at 3pm.\nFamily photos straight after.' }),
    },
    {
      id: 'invite-all-day', name: 'All-day event invite with no place or notes', audience: 'anyone',
      subject: 'Coastline Photo invited you: Editing day', from,
      html: eventInviteHtml({ hostName: 'Coastline Photo', title: 'Editing day', when: 'Monday 16 March 2027 · All day' }),
    },
  ]
}
