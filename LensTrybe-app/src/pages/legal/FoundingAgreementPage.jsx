import LegalDocument from '../../components/legal/LegalDocument'

const UPDATED = '11 September 2026'

const INTRO = `**Welcome to the LensTrybe founding creatives.**

You've been personally invited to be one of the first creatives on LensTrybe. This is a genuine partnership: we give you our best tools for free while we grow, and in return you help us prove the platform with real work. Here's exactly what you get and what we ask.

This Founding Creative Agreement applies if you joined LensTrybe with a founding code and ticked the box to accept it. It sits alongside our [Terms and Conditions](/terms), [Privacy Policy](/privacy) and [Refund Policy](/refunds), which also apply. If this agreement and the Terms conflict, this agreement applies to the extent of the conflict.`

const SECTIONS = [
  {
    id: 'you-get',
    title: 'What you get',
    body: `• **12 months of Expert, free.** Full access to our Expert plan (normally $74.99 a month) for 12 months from the day you sign up. You add a card when you join, but nothing is charged during your free year.
• **$49 a month for life after that.** When your free year ends, your Expert plan continues at a locked founding rate of $49 a month (or $588 a year if you choose annual billing). That's well below the standard Expert price, and it won't go up for as long as you stay on your founding plan.
• **A reminder before you're charged.** We'll email you about 7 days before your free year ends, so there are no surprises. You can cancel any time before then and you won't be charged.
• **A permanent Founding Creative badge** on your profile, so clients can see you were one of the originals. The badge stays for life, even if your founding deal ends.
• **Zero commission, always.** You keep 100% of what you earn. LensTrybe never takes a cut of your work.`,
  },
  {
    id: 'we-ask',
    title: 'What we ask in return',
    body: `To keep your founding deal, you agree to two things:

• **Get your profile live within 7 days.** Complete your profile to 100% within 7 days of signing up, so clients see a real, finished listing. Your Founding Hub shows exactly what's left to finish.
• **Run your next 3 real client jobs through LensTrybe within 6 months.** For each job, send the client a quote through LensTrybe, have them accept it, then issue the invoice and mark it paid. These must be genuine jobs for real clients (not yourself or a made-up client), completed within the first 6 months of your free year.

We'd also love **one piece of feedback a month**: a quick note on what's working and what could be better. It shapes what we build next, and founding creatives have a real say. This one is light-touch. If you miss a month, we'll just send a friendly reminder. It never affects your founding deal on its own.`,
  },
  {
    id: 'falling-behind',
    title: 'If life gets in the way',
    body: `We're reasonable people. If you fall behind on either of the two commitments above, we won't pull the rug out from under you.

• You'll get a heads-up by email explaining what's outstanding.
• You'll then have **14 days** to put it right.
• If it's still not met after that, your founding deal ends and your plan moves to the standard price for your plan. You keep your profile, your badge and all your work. You just lose the rest of the free year and the $49 founding rate.
• There are no penalties and no loss of data. You can change plans or cancel at any time, as set out in our Terms.

If something outside your control is getting in the way, reply to any of our emails and talk to us. We'd rather help than end a deal.`,
  },
  {
    id: 'fine-print',
    title: 'The fine print',
    body: `• Your founding code is personal to you, single-use and not transferable.
• The founding deal is offered at LensTrybe's discretion to invited creatives only, and there are a limited number of places.
• Your founding rate applies to the Expert plan. If you move to a different plan, standard pricing for that plan applies.
• If you cancel your plan, you can come back later, but the free year doesn't restart.
• We may update this agreement. If we do, we'll email you at least 30 days beforehand, and changes won't take away benefits you've already been given.
• Nothing in this agreement limits your rights under the Australian Consumer Law.`,
  },
  {
    id: 'agreeing',
    title: 'Agreeing to this agreement',
    body: `By entering your founding code and ticking the box at sign-up, you confirm you've read and agree to this Founding Creative Agreement.

Questions? Email [connect@lenstrybe.com](mailto:connect@lenstrybe.com).`,
  },
]

export default function FoundingAgreementPage() {
  return <LegalDocument title="Founding Creative Agreement" updated={UPDATED} intro={INTRO} sections={SECTIONS} />
}
