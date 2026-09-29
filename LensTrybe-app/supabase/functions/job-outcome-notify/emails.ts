// Emails sent by job-outcome-notify, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, strong, esc, button, facts, FROM } from './email.ts'

// To the creative whose reply the poster accepted.
export function quoteAcceptedHtml(d: { name: string, who: string, title: string, price: number, threadsUrl: string }) {
  return layout({
    preheader: `${d.who} accepted your quote for ${d.title}`,
    blocks: [
      heading('Job board', 'Your quote was accepted'),
      para(`${d.name ? `Hi ${esc(d.name)}, ` : ''}${strong(d.who)} wants to go ahead. They've messaged you, so reply in your threads to sort out the details.`, { html: true }),
      facts([['Job', d.title], ['Your price', `AUD ${Number.isFinite(d.price) ? d.price.toFixed(2) : '0.00'}`]]),
      button('Open your threads', d.threadsUrl),
      para("They're also in your CRM as a lead.", { small: true }),
    ],
    why: 'You got this because you replied to a job on LensTrybe.',
  })
}

// To every creative whose reply was closed when the poster picked someone else.
export function jobFilledHtml(d: { name: string, title: string, jobsUrl: string }) {
  return layout({
    preheader: `${d.title} has been filled`,
    blocks: [
      heading('Job board', 'That job has been filled'),
      para(`${d.name ? `Hi ${esc(d.name)}, ` : ''}thanks for replying to ${strong(d.title)}. The client went with someone else this time.`, { html: true }),
      button('See open jobs', d.jobsUrl),
    ],
    why: 'You get this once per job you reply to.',
  })
}

export function previews() {
  return [
    {
      id: 'accepted', name: 'Quote accepted on the job board, sent to the creative', audience: 'creative',
      subject: 'Your quote for Wedding photographer in Maleny was accepted', from: FROM,
      html: quoteAcceptedHtml({ name: 'Coastline Photo', who: 'Jo Harper', title: 'Wedding photographer in Maleny', price: 1026, threadsUrl: 'https://lenstrybe.com/dashboard/clients/messages' }),
    },
    {
      id: 'filled', name: 'Job filled by someone else, sent to the other creatives who replied', audience: 'creative',
      subject: 'Wedding photographer in Maleny has been filled', from: FROM,
      html: jobFilledHtml({ name: 'Coastline Photo', title: 'Wedding photographer in Maleny', jobsUrl: 'https://lenstrybe.com/dashboard/my-work/jobs' }),
    },
  ]
}
