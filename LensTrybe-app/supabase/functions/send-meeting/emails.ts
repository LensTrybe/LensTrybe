// Emails sent by send-meeting, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, facts, quote, button, link } from './email.ts'

// To the client: a creative asks to meet. From "<creative> (via LensTrybe)", reply-to the creative.
// The subject is built in index.ts.
export function meetingRequestHtml(d: { hostName: string, title: unknown, when: string, location?: unknown, description?: unknown, link: string }) {
  return layout({
    blocks: [
      heading('Meeting request', String(d.title ?? '')),
      para(`${d.hostName} would like to meet with you. Let them know if this time works.`),
      facts([['When', d.when], ['Where', d.location]]),
      d.description ? quote(d.description, 'Details') : '',
      button('Accept, decline or propose a time', d.link),
      para(`Or paste this link into your browser:<br>${link(d.link, d.link)}`, { html: true, small: true }),
    ],
    why: `You got this because ${d.hostName} sent you a meeting request through LensTrybe.`,
  })
}

export function previews() {
  const url = 'https://lenstrybe.com/meeting/3f6c2a9e-8d41-4b7a-9c0e-1a2b3c4d5e6f'
  return [
    {
      id: 'request', name: 'Meeting request sent to a client', audience: 'client',
      subject: 'Coastline Photo would like to meet: Wedding planning catch-up',
      from: 'Coastline Photo (via LensTrybe) <noreply@mail.lenstrybe.com>',
      html: meetingRequestHtml({
        hostName: 'Coastline Photo', title: 'Wedding planning catch-up',
        when: 'Tuesday 2 February 2027 · 10am to 11am', location: 'Maleny Botanic Gardens café',
        description: 'Let’s walk the ceremony spot and run through the shot list.\nBring any inspiration photos you have.',
        link: url,
      }),
    },
    {
      id: 'request-no-place', name: 'Meeting request with no place or details', audience: 'client',
      subject: 'Coastline Photo would like to meet: Quick call',
      from: 'Coastline Photo (via LensTrybe) <noreply@mail.lenstrybe.com>',
      html: meetingRequestHtml({ hostName: 'Coastline Photo', title: 'Quick call', when: 'Time to be confirmed', link: url }),
    },
  ]
}
