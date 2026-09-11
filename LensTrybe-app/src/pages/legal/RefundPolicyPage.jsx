import LegalDocument from '../../components/legal/LegalDocument'

const UPDATED = '11 September 2026'

const INTRO = `This Refund Policy explains how cancellations and refunds work for LensTrybe's paid Creative plans. It forms part of our [Terms and Conditions](/terms).

Client accounts and the Basic plan are free, so there's nothing to refund.

Nothing in this policy limits your rights under the Australian Consumer Law. See [section 5](#consumer-law).`

const SECTIONS = [
  {
    id: 'cancel',
    title: 'Cancel any time',
    body: `You can cancel your paid plan at any time online, in Settings > Subscription or Settings > Danger Zone. You don't need to call or email us.

When you cancel:

• you won't be charged again
• you keep your paid features until the end of the period you've already paid for
• your account then moves to the free Basic plan, and your profile and data stay safe`,
  },
  {
    id: 'trials',
    title: 'Free trials',
    body: `If your plan starts with a free trial, you won't be charged if you cancel before the trial ends. Your first charge date is shown before you confirm your plan and in Settings > Subscription, and we'll email you a reminder about 7 days before it.`,
  },
  {
    id: 'monthly',
    title: 'Monthly plans',
    body: `Monthly payments are not refunded for part of a month once the month has started, except where the Australian Consumer Law requires it (see [section 5](#consumer-law)).`,
  },
  {
    id: 'annual',
    title: 'Annual plans: 14-day refund',
    body: `If you change your mind about an annual plan, you can get a **full refund** if you ask within **14 days of your first annual payment**. This includes switching from a monthly to an annual plan. Once the refund is processed, your account moves to the free Basic plan.

After 14 days, annual payments aren't refunded for the rest of the year, except where the Australian Consumer Law requires it. If you cancel, you keep your paid features until the end of the year you've paid for, and your plan won't renew.

The 14-day refund applies to your first annual payment only, not to later yearly renewals. We'll email you a reminder about 7 days before each annual renewal, and the date is always shown in Settings > Subscription, so there are no surprises.`,
  },
  {
    id: 'consumer-law',
    title: 'Your rights under the Australian Consumer Law',
    body: `Our services come with guarantees that cannot be excluded under the Australian Consumer Law. For major failures with the service, you are entitled to cancel your service contract with us and to a refund for the unused portion, or to compensation for its reduced value. You are also entitled to be compensated for any other reasonably foreseeable loss or damage. If a failure does not amount to a major failure, you are entitled to have problems with the service rectified in a reasonable time and, if this is not done, to cancel your contract and obtain a refund for the unused portion of the contract.

If you think we've let you down, contact us at [billing@lenstrybe.com](mailto:billing@lenstrybe.com) and we'll work with you to put it right.`,
  },
  {
    id: 'our-changes',
    title: 'When we make changes',
    body: `We'll refund the unused part of any fees you've paid in advance if:

• we close your account for a reason other than a serious or repeated breach of our [Terms](/terms)
• we stop offering LensTrybe
• we make a change that significantly reduces the main features of your paid plan, or change our Terms to your detriment, and you cancel because of it

We'll give you at least 30 days' notice of any price increase, so you can cancel before it applies.`,
  },
  {
    id: 'other',
    title: 'Upgrades, founding plans and discounts',
    body: `• **Upgrades:** when you upgrade, you pay the difference for the rest of your billing period (switching from monthly to annual starts a new annual period, with credit for the unused part of your month). If you then cancel, you keep the upgraded features until the period ends.
• **Downgrades:** a downgrade takes effect at your next renewal, and the lower price applies from then. Downgrading doesn't create a refund for the current period.
• **Founding Creatives:** your free period and locked-in price are set out in the [Founding Creative Agreement](/founding-agreement). This policy applies once you start paying.
• **Referral rewards and discounts** reduce what you pay. They have no cash value and can't be refunded or exchanged for cash.`,
  },
  {
    id: 'request',
    title: 'How to request a refund',
    body: `Email [billing@lenstrybe.com](mailto:billing@lenstrybe.com) from the email address on your account and tell us:

• the plan you're on (monthly or annual)
• the date of the payment
• the reason for your request (optional, but it helps us improve)

We'll reply within 3 business days. Approved refunds go back to the card you paid with within 10 business days, although your bank may take a few extra days to show it.

If there's a problem with a charge, please contact us before disputing it with your bank. We can usually fix it faster.`,
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: `We may update this policy from time to time. If a change reduces your refund rights, we'll email you at least 30 days before it takes effect, and it won't apply to payments made before then.`,
  },
]

export default function RefundPolicyPage() {
  return <LegalDocument title="Refund Policy" updated={UPDATED} intro={INTRO} sections={SECTIONS} />
}
