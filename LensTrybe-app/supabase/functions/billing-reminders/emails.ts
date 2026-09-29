// Emails for billing-reminders. Pure functions: plain data in, { subject, html } out.
import { layout, heading, para, facts, button, planName } from './email.ts'

const SITE = 'https://lenstrybe.com'
const FROM_PREVIEW = 'LensTrybe <noreply@mail.lenstrybe.com>'

export type ReminderData = {
  name: string        // business name, or 'there'
  isTrial: boolean    // trial (or founding free year) ending, else annual renewal
  founding: boolean   // founding member
  tier: string        // tier id charged at this date (pending tier if a downgrade is scheduled)
  billing: string     // 'annual' | 'monthly'
  price: string       // formatted amount, or ''
  when: string        // formatted charge date
}

export function reminderEmail(d: ReminderData): { subject: string, html: string } {
  const { name, isTrial, founding, tier, billing, price, when } = d
  const per = billing === 'annual' ? 'year' : 'month'
  const plan = `${tier ? planName(tier) : ''}${founding && tier === 'expert' ? ' (founding rate)' : ''}`

  const subject = isTrial
    ? (founding ? `Your free LensTrybe year ends on ${when}` : `Your LensTrybe free trial ends on ${when}`)
    : `Your LensTrybe annual plan renews on ${when}`
  const title = isTrial
    ? (founding ? 'Your free founding year is almost up' : 'Your free trial ends soon')
    : 'Your annual plan renews soon'
  const intro = isTrial
    ? `Hi ${name}, just a heads-up: your free ${founding ? 'founding year' : 'trial'} ends on ${when}. After that, your ${plan} plan continues and we'll charge your saved card${price ? ` ${price} per ${per}` : ''}.`
    : `Hi ${name}, just a heads-up: your ${plan} plan renews on ${when} and we'll charge your saved card${price ? ` ${price} for the year` : ''}.`
  const footNote = `Happy to continue? You don't need to do anything. If you'd rather not continue, cancel any time before ${when} in Settings and you won't be charged. Referral discounts, if you have any, are applied automatically. Questions? Reply to this email.`

  const html = layout({
    preheader: subject,
    blocks: [
      heading(isTrial ? 'Trial ending' : 'Renewal reminder', title),
      para(intro),
      facts([
        ['Plan', `${plan}, billed ${billing === 'annual' ? 'annually' : 'monthly'}`],
        ['Amount', price ? `${price} per ${per}` : ''],
        [isTrial ? 'First charge' : 'Renewal date', when],
      ]),
      button('Manage subscription', `${SITE}/dashboard/settings/subscription`),
      para(footNote, { small: true }),
    ],
    why: "You're getting this because a charge is coming up on your LensTrybe subscription.",
  })
  return { subject, html }
}

export function previews() {
  const base = { name: 'Coastline Photo', billing: 'monthly', when: '14 March 2027' }
  const list: { id: string, name: string, data: Partial<ReminderData> }[] = [
    { id: 'trial-ending', name: 'Free trial ends in 7 days, first charge coming', data: { isTrial: true, founding: false, tier: 'expert', price: '$74.99' } },
    { id: 'founding-year-ending', name: 'Founding free year ends in 7 days, founding rate starts', data: { isTrial: true, founding: true, tier: 'expert', price: '$49.00' } },
    { id: 'annual-renewal', name: 'Annual plan renews in 7 days', data: { isTrial: false, founding: false, tier: 'elite', billing: 'annual', price: '$1,499.90' } },
  ]
  return list.map((p) => {
    const m = reminderEmail({ ...base, ...p.data } as ReminderData)
    return { id: p.id, name: p.name, audience: 'creative', subject: m.subject, from: FROM_PREVIEW, html: m.html }
  })
}
