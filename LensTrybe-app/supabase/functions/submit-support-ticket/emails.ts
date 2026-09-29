// Emails sent by submit-support-ticket, in the LensTrybe "Night" design (see email.ts).
// Subjects are built in index.ts.
import { layout, heading, para, strong, facts, quote, button, FROM } from './email.ts'

// To support@lenstrybe.com, reply-to the person who raised it.
export function supportStaffHtml(d: { name: string, email: string, who: string, role: string, category: string, subject: string, ref: string, message: string }) {
  return layout({
    preheader: `${d.name || d.email} needs a hand`,
    blocks: [
      heading('New support request', d.subject || 'New support request'),
      para('A new support request just came in through LensTrybe.'),
      facts([['From', d.who], ['Account type', d.role], ['Category', d.category], ['Reference', `#${d.ref}`]]),
      para(strong('Message'), { html: true }),
      quote(d.message),
      button('Open the support inbox', 'https://hq.lenstrybe.com/support'),
      para('Reply directly to this email to respond to the person who raised it.', { small: true }),
    ],
    why: 'You got this because a support request came in through LensTrybe.',
  })
}

// To the person who raised it, reply-to support@lenstrybe.com. Fixed text plus the reference only.
export function supportConfirmationHtml(d: { ref: string }) {
  return layout({
    preheader: 'Thanks for reaching out to LensTrybe support',
    blocks: [
      heading('Support request received', "Thanks. We're on it."),
      para("We've received your request and someone from the team will get back to you as soon as we can, usually within one business day."),
      facts([['Reference', `#${d.ref}`]]),
      para("You can reply straight to this email if you need to add anything. If you didn't contact LensTrybe support, you can ignore this email.", { small: true }),
    ],
    why: 'You got this because this email address was used to contact LensTrybe support.',
  })
}

export function previews() {
  return [
    {
      id: 'staff', name: 'New support request, sent to the support inbox', audience: 'staff',
      subject: 'New support request [Billing]: Invoice INV-0221 shows the wrong amount', from: FROM,
      html: supportStaffHtml({ name: 'Sam Lee', email: 'sam@coastlinephoto.com.au', who: 'Sam Lee · sam@coastlinephoto.com.au', role: 'creative', category: 'Billing', subject: 'Invoice INV-0221 shows the wrong amount', ref: '7F3A91C2', message: 'Hi team,\n\nINV-0221 for Jo Harper should be $1,026.00 but the PDF shows $1,062.00.\n\nThanks, Sam' }),
    },
    {
      id: 'confirmation', name: 'Support request received, sent to the person who raised it', audience: 'anyone',
      subject: "We've got your request (#7F3A91C2)", from: FROM,
      html: supportConfirmationHtml({ ref: '7F3A91C2' }),
    },
  ]
}
