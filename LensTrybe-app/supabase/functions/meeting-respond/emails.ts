// Emails sent by meeting-respond, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, facts, quote, button, FROM } from './email.ts'

const APP = 'https://lenstrybe.com'

// To the creative: their client answered a meeting request (accepted, declined or suggested
// another time). title is also the subject line, built in index.ts.
export function meetingResponseHtml(d: { response: string, title: string, meetingTitle: string, when: string, suggested?: string, message?: string | null }) {
  const intro = d.response === 'accepted'
    ? 'It is confirmed on their side. It is in your Meetings, and on your calendar if you added it there.'
    : d.response === 'declined'
      ? 'They said no to this one. Suggest another time from Meetings when you are ready.'
      : 'Have a look at the time they suggested and confirm or counter it from Meetings.'
  return layout({
    blocks: [
      heading('Meeting', d.title),
      para(intro),
      facts([['Meeting', d.meetingTitle], ['Proposed', d.when], ['Suggested instead', d.suggested]]),
      d.message ? quote(d.message) : '',
      button('Open Meetings', `${APP}/dashboard/clients/meetings`),
    ],
    why: 'You got this because a client answered a meeting request you sent on LensTrybe.',
  })
}

export function previews() {
  const base = { meetingTitle: 'Wedding planning catch-up', when: 'Tuesday 2 February 2027 · 10am to 11am' }
  return [
    {
      id: 'accepted', name: 'Client accepted a meeting, sent to the creative', audience: 'creative',
      subject: 'Jo Harper confirmed the meeting', from: FROM,
      html: meetingResponseHtml({ ...base, response: 'accepted', title: 'Jo Harper confirmed the meeting' }),
    },
    {
      id: 'declined', name: 'Client declined a meeting, sent to the creative', audience: 'creative',
      subject: "Jo Harper can't make the meeting", from: FROM,
      html: meetingResponseHtml({ ...base, response: 'declined', title: "Jo Harper can't make the meeting", message: 'Sorry Sam, I am away for work that week.' }),
    },
    {
      id: 'reschedule', name: 'Client suggested another time, sent to the creative', audience: 'creative',
      subject: 'Jo Harper suggested another time', from: FROM,
      html: meetingResponseHtml({ ...base, response: 'reschedule', title: 'Jo Harper suggested another time', suggested: 'Thursday 4 February 2027 · 2pm', message: 'Could we do the Thursday afternoon instead?' }),
    },
  ]
}
