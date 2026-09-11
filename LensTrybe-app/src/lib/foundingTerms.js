// The Founding Creative Agreement: the terms for the Founding 100.
//
// Single source for the public page (/founding-agreement) and the full text shown inside
// the signup step next to the tick box. When the wording changes, bump
// FOUNDING_TERMS_VERSION: the version each creative accepted is recorded against their
// account at signup (founding_terms_acceptances), so we can always show what they agreed to.
//
// Body format (rendered by LegalBody): blank lines separate blocks, lines starting with
// "• " make a list, **text** is bold and [text](/path) is a link.

export const FOUNDING_TERMS_VERSION = '2026-09-11'
export const FOUNDING_TERMS_UPDATED = '11 September 2026'
export const FOUNDING_TERMS_TITLE = 'Founding Creative Agreement'

export const FOUNDING_TERMS_INTRO = `**The terms for the Founding 100.**

You've been personally invited to be one of the first 100 creatives on LensTrybe. This is a genuine partnership: we give you our best tools for free while we grow, and in return you help us prove the platform with real work. This agreement sets out exactly what you get, what we ask, and what happens if things change.

It applies if you create your LensTrybe account with a founding code and tick the box to accept it. It sits alongside our [Terms and Conditions](/terms), [Privacy Policy](/privacy) and [Refund Policy](/refunds), which also apply. If this agreement and the Terms conflict, this agreement applies to the extent of the conflict.

In this agreement, "LensTrybe", "we" and "us" means the operator of LensTrybe, and "you" means the creative who accepted it.`

export const FOUNDING_TERMS_SECTIONS = [
  {
    id: 'who',
    title: '1. Who can join',
    body: `• The founding deal is offered by invitation only, at LensTrybe's discretion, and there are no more than 100 places.
• Your founding code is personal to you, works once, can't be transferred or sold, and expires 14 days after we send it.
• One founding account per person or business.
• You must be 18 or older and running a genuine creative business in Australia.
• We can withdraw an invitation before the code is used, for example if it has been shared with someone else.`,
  },
  {
    id: 'you-get',
    title: '2. What you get',
    body: `• **12 months of Expert, free.** Full access to our Expert plan (normally $74.99 a month) for 12 months from the day you create your account.
• **$49 a month for life after that.** When your free year ends, your Expert plan continues at a locked founding rate of $49 a month, or $588 a year if you choose annual billing. It won't go up for as long as you keep your founding deal.
• **A permanent Founding Creative badge** on your profile. The badge stays for life, even if your founding deal ends.
• **Zero commission, always.** You keep 100% of what you earn. LensTrybe never takes a cut of your work.
• **A real say.** Founding creatives get a direct line to us and help shape what we build next.`,
  },
  {
    id: 'billing',
    title: '3. Your card and billing',
    body: `• You add a card when you create your account. Nothing is charged during your free year while your founding deal is in place.
• We'll email you about 7 days before your free year ends, so there are no surprises. If you cancel before then, you won't be charged.
• After the free year, your plan renews automatically at your founding rate until you cancel.
• Prices are in Australian dollars.
• Your founding rate applies to the Expert plan. If you move to a different plan, standard pricing for that plan applies.`,
  },
  {
    id: 'we-ask',
    title: '4. What we ask in return',
    body: `To keep your founding deal, you agree to two things:

• **Get your profile live within 7 days.** Complete your profile to 100% within 7 days of creating your account, so clients see a real, finished listing. Your Founding Hub shows exactly what's left.
• **Run your next 3 real client jobs through LensTrybe within 6 months.** For each job, send the client a quote through LensTrybe, have them accept it, then issue the invoice and mark it paid. These must be genuine jobs for real clients (not yourself, a friend doing you a favour or a made-up client), completed within the first 6 months of your free year.

We'd also love **one piece of feedback a month**: a quick note on what's working and what could be better. This one is light-touch. If you miss a month, we'll send a friendly reminder, and it never affects your founding deal on its own.

Your progress is tracked automatically and you can see it any time in your Founding Hub.`,
  },
  {
    id: 'ending',
    title: '5. If a commitment is missed, and how the deal ends',
    body: `We're reasonable people. If you fall behind on either commitment in section 4:

• We'll email you explaining what's outstanding.
• You'll then have **14 days** to put it right.
• If it's still not met after that, your founding deal ends.

Your founding deal can also end if you tell us you want to leave the founding programme, or if you seriously or repeatedly break our Terms, misuse your founding code or record jobs that aren't genuine.

**When your founding deal ends:**
• The rest of your free year ends and the $49 founding rate is gone for good.
• Your plan continues at the standard price for your plan (for Expert, $74.99 a month or $749.90 a year, depending on the billing you chose).
• Your first payment at the standard price is taken **7 days after the deal ends**, or on your original first payment date if that's sooner.
• We'll email you when it ends, with the amount and the date of that first payment.
• If you don't want to continue, switch to the free Basic plan or cancel before that date and you won't be charged.
• You keep your profile, your Founding Creative badge and all your work. There are no penalties and no loss of data.

If something outside your control is getting in the way, reply to any of our emails and talk to us. We'd rather help than end a deal.`,
  },
  {
    id: 'cancelling',
    title: '6. Cancelling',
    body: `• You can cancel your plan at any time from your dashboard. What happens to your access when you cancel is set out in our Terms.
• If you cancel, your founding deal ends and your founding place can be offered to another creative.
• If you come back later, the free year doesn't restart and the founding rate isn't available again.`,
  },
  {
    id: 'changes',
    title: '7. Changes to this agreement',
    body: `• We may update this agreement. If we do, we'll email you at least 30 days beforehand, and changes won't take away benefits you've already been given.
• The version you accepted is recorded against your account, along with the date and time you accepted it.`,
  },
  {
    id: 'rights',
    title: '8. Your rights',
    body: `Nothing in this agreement excludes, restricts or changes any rights you have under the Australian Consumer Law or any other law that can't be excluded.`,
  },
  {
    id: 'agreeing',
    title: '9. Accepting this agreement',
    body: `You accept this agreement by entering your founding code and ticking the box when you create your account. You can read it again at any time at [lenstrybe.com/founding-agreement](/founding-agreement).

Questions? Email [connect@lenstrybe.com](mailto:connect@lenstrybe.com).`,
  },
]
