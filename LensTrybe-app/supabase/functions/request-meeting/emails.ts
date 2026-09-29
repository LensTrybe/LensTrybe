// Emails sent by request-meeting, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, facts, quote, button, FROM } from './email.ts'

// To the creative: a signed-in client asked for a phone call. Reply-to is the client.
// The subject is built in index.ts.
export function callRequestHtml(d: { clientName?: string | null, when: string, clientPhone?: string | null, clientEmail?: string | null, message?: string | null }) {
  return layout({
    blocks: [
      heading('New call request', `${d.clientName || 'A client'} wants a phone call`),
      para('You have a new phone call request on LensTrybe.'),
      facts([['Preferred time', d.when], ['Phone', d.clientPhone], ['Email', d.clientEmail]]),
      d.message ? quote(d.message, 'Message') : '',
      button('Review the request', 'https://lenstrybe.com/dashboard/clients/meetings'),
    ],
    why: 'You got this because a client asked for a phone call through your LensTrybe profile.',
  })
}

export function previews() {
  return [
    {
      id: 'creative', name: 'Phone call request, sent to the creative', audience: 'creative',
      subject: 'New phone call request from Jo Harper', from: FROM,
      html: callRequestHtml({ clientName: 'Jo Harper', when: 'Friday 29 January 2027 · 5:30pm', clientPhone: '0412 345 678', clientEmail: 'jo.harper@gmail.com', message: 'Hi Sam, keen to chat about our wedding in Maleny on Sat 14 Mar 2027.' }),
    },
    {
      id: 'creative-minimal', name: 'Phone call request with no name, time or message', audience: 'creative',
      subject: 'New phone call request from a client', from: FROM,
      html: callRequestHtml({ when: 'A time they suggested', clientEmail: 'jo.harper@gmail.com' }),
    },
  ]
}
