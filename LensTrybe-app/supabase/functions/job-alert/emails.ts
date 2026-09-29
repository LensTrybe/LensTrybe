// Emails sent by job-alert, in the LensTrybe "Night" design (see email.ts).
import { layout, heading, para, link, button, facts, FROM } from './email.ts'

// To a creative who fits a newly posted job. At most perDay a day; they can turn these off in Settings.
export function jobAlertHtml(d: { name: string, title: string, who: string, where: string, when: string, budget: string, brief: string, briefCut: boolean, perDay: number, jobsUrl: string, settingsUrl: string }) {
  return layout({
    preheader: `${d.title} · ${d.where}`,
    blocks: [
      heading('Job board', 'A new job that fits your work'),
      para(`${d.name ? `Hi ${d.name}, ` : ''}a client just posted a job on LensTrybe. Reply with your price and what's included, and they pick who they want.`),
      facts([['Who', d.who], ['Where', d.where || 'Not given'], ['When', d.when], ['Budget', d.budget]], d.title),
      d.brief ? para(`${d.brief}${d.briefCut ? '…' : ''}`) : '',
      button('Reply with a quote', d.jobsUrl),
      para(`${link('Turn job alerts off in Settings', d.settingsUrl)}.`, { html: true, small: true }),
    ],
    why: `You get these because you're a creative on LensTrybe. At most ${d.perDay} a day.`,
  })
}

export function previews() {
  return [
    {
      id: 'alert', name: 'New job that fits their work, sent to matching creatives', audience: 'creative',
      subject: 'New job: Wedding photographer in Maleny, Maleny QLD', from: FROM,
      html: jobAlertHtml({
        name: 'Sam Lee', title: 'Wedding photographer in Maleny', who: 'Photographer or Videographer', where: 'Maleny QLD', when: 'Sun 14 March',
        budget: 'AUD 2,500', brief: 'Full-day wedding coverage for about 90 guests at Maleny Manor. Ceremony at 2pm, reception until 9pm. Looking for a relaxed, documentary style with some posed family shots.', briefCut: false,
        perDay: 3, jobsUrl: 'https://lenstrybe.com/app/jobs', settingsUrl: 'https://lenstrybe.com/app/settings',
      }),
    },
  ]
}
