// Emails sent by send-message-notification, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, strong, link, button, facts, quote, lines, esc, planName, FROM, dollars } from './email.ts'

// To a job's poster (creative or client): a creative applied for their job.
export function jobApplicationHtml(d: { fromName: string, title: string, toName: string, price: number, includes: string, cover: string, ctaUrl: string }) {
  return layout({
    preheader: `${d.fromName} applied for your job on LensTrybe`,
    blocks: [
      heading('New application', `${d.fromName} applied for your job`),
      para(`Regarding ${strong(d.title)}`, { html: true }),
      d.toName ? para(`Hi ${d.toName},`) : '',
      para(`${d.fromName} has applied for your job "${d.title}".`),
      facts([['Offer', dollars(Number.isFinite(d.price) ? d.price : 0)]]),
      para(`${strong("What's included:")} ${lines(d.includes)}`, { html: true }),
      d.cover ? quote(d.cover, 'Cover message') : '',
      button('View applications on LensTrybe', d.ctaUrl),
    ],
    why: "You're receiving this because you posted a job on LensTrybe.",
  })
}

// To a creative at their monthly reply cap: an enquiry is waiting (at most once a week).
// tier is the label the function computes from subscription_tier (e.g. "Basic"); planName() turns it
// into the name people see.
export function cappedEnquiryHtml(d: { fromName: string, threadSubject: string, subjectLine: string, hi: string, cap: number, tier: string, resetLabel: string, messagesUrl: string, upgradeUrl: string }) {
  return layout({
    preheader: `${d.fromName} is waiting on a reply and your monthly limit is reached`,
    blocks: [
      heading('Enquiry waiting', 'You have a new enquiry waiting'),
      para(`From ${strong(d.fromName)}${d.threadSubject ? ` about ${strong(d.threadSubject)}` : ''}`, { html: true }),
      d.hi ? para(d.hi) : '',
      para(`${d.fromName} got in touch about ${d.subjectLine}.`),
      para(`You have used all ${esc(d.cap)} of your replies this month on the ${esc(planName(d.tier))} plan, so you cannot reply until your limit resets on ${strong(d.resetLabel)}.`, { html: true }),
      para('Trybe Complete and Trybe Studio give you unlimited replies, contact sharing, client portals and a full website.'),
      button('Upgrade to Trybe Complete', d.upgradeUrl),
      para(`Your enquiry is waiting in ${link('your messages', d.messagesUrl)}.`, { html: true, small: true }),
    ],
    why: 'You keep receiving enquiries while your limit is reached, and you will not be sent this reminder more than once a week.',
  })
}

// An ordinary new message, client to creative or creative to client.
export function messageHtml(d: { fromName: string, threadSubject: string, hi: string, message: string, ctaUrl: string, canReply: boolean }) {
  return layout({
    preheader: `${d.fromName} sent you a message on LensTrybe`,
    blocks: [
      heading('New message', `${d.fromName} sent you a message`),
      d.threadSubject ? para(`Regarding ${strong(d.threadSubject)}`, { html: true }) : '',
      d.hi ? para(d.hi) : '',
      quote(d.message),
      button('Reply on LensTrybe', d.ctaUrl),
      d.canReply ? para(`You can reply straight to this email to reach ${d.fromName}, or open LensTrybe to reply in the conversation.`, { small: true }) : '',
    ],
    why: "You're receiving this because you have an active conversation on LensTrybe.",
  })
}

export function previews() {
  const msg = "Hi Sam,\n\nJust confirming the ceremony starts at 2pm at the Maleny Manor. Can you arrive by 1pm for the getting-ready shots?\n\nJo"
  return [
    {
      id: 'message-to-creative', name: 'New message from a client, sent to the creative', audience: 'creative',
      subject: 'New message from Jo Harper on LensTrybe', from: FROM,
      html: messageHtml({ fromName: 'Jo Harper', threadSubject: 'Wedding in Maleny, Sun 14 Mar 2027', hi: 'Hi Coastline Photo,', message: msg, ctaUrl: 'https://lenstrybe.com/dashboard/clients/messages', canReply: true }),
    },
    {
      id: 'message-to-client', name: 'New message from a creative, sent to the client', audience: 'client',
      subject: 'New message from Coastline Photo on LensTrybe', from: FROM,
      html: messageHtml({ fromName: 'Coastline Photo', threadSubject: 'Wedding in Maleny, Sun 14 Mar 2027', hi: 'Hi Jo Harper,', message: "Hi Jo,\n\n1pm is perfect. I'll bring a second shooter for the getting-ready shots.\n\nSam", ctaUrl: 'https://lenstrybe.com/portal/3f9c2a7e1b', canReply: true }),
    },
    {
      id: 'capped', name: 'Enquiry waiting while the creative is at their reply limit', audience: 'creative',
      subject: 'New enquiry from Jo Harper, reply limit reached', from: FROM,
      html: cappedEnquiryHtml({ fromName: 'Jo Harper', threadSubject: 'Wedding in Maleny, Sun 14 Mar 2027', subjectLine: 'Wedding in Maleny, Sun 14 Mar 2027', hi: 'Hi Coastline Photo,', cap: 3, tier: 'Basic', resetLabel: '1 November', messagesUrl: 'https://lenstrybe.com/dashboard/clients/messages', upgradeUrl: 'https://lenstrybe.com/dashboard/settings/subscription' }),
    },
    {
      id: 'job-application', name: 'A creative applied for a job, sent to the client who posted it', audience: 'anyone',
      subject: 'New application for your job: Wedding photographer in Maleny', from: FROM,
      html: jobApplicationHtml({ fromName: 'Coastline Photo', title: 'Wedding photographer in Maleny', toName: 'Jo Harper', price: 1026, includes: 'Full-day coverage, 400+ edited photos, online gallery', cover: "Hi Jo, I've shot a dozen weddings in Maleny and I'm free on Sun 14 Mar 2027. Happy to chat.", ctaUrl: 'https://lenstrybe.com/client-dashboard?view=jobs' }),
    },
  ]
}
