// Emails sent by site-enquiry, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, strong, link, button, quote, esc, FROM } from './email.ts'

// To the creative: someone enquired through their LensTrybe website. Reply-to is the enquirer.
export function websiteEnquiryHtml(d: { name: string, email: string, phone: string, message: string }) {
  return layout({
    blocks: [
      heading('New website enquiry', `${d.name} got in touch`),
      para("Someone enquired through your LensTrybe website. They've been added to your CRM and the message is in your threads."),
      para(`${strong('Email:')} ${link(d.email, `mailto:${d.email}`)}${d.phone ? `<br>${strong('Phone:')} ${esc(d.phone)}` : ''}`, { html: true }),
      d.message ? quote(d.message, 'Message') : '',
      button('Open your CRM', 'https://lenstrybe.com/dashboard/clients/crm'),
    ],
    why: 'You got this because someone enquired through your LensTrybe website.',
  })
}

export function previews() {
  return [
    {
      id: 'creative', name: 'Website enquiry, sent to the creative', audience: 'creative',
      subject: 'New website enquiry from Jo Harper', from: FROM,
      html: websiteEnquiryHtml({ name: 'Jo Harper', email: 'jo.harper@gmail.com', phone: '0412 345 678', message: "Hi Sam, we're getting married in Maleny on Sun 14 Mar 2027. Are you available for full-day coverage?\n\nThanks, Jo" }),
    },
  ]
}
