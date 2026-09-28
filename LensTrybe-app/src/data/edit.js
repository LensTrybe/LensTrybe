// The Trybe Edit: LensTrybe's monthly read for professional visual creatives.
// Live mode reads the issues from the edit_issues table (published on the 1st of each month);
// this file is the demo copy and the source the issues were written from.
export const ISSUES = [
  {
    slug: 'issue-01-lenstrybe-is-live', n: 1, month: 'October 2026', title: 'LensTrybe is live',
    dek: "What's on the platform, how to get found, and the ten minutes that set you up for the busy season.",
    mood: 'golden', seed: 21, read: '5 min', publish_at: '2026-10-01T00:00:00+10:00',
    sections: [
      { k: 'note', label: "Editor's note", body: [
        "It's October, wedding season is starting, and LensTrybe is open.",
        "When I started building this, I wanted one place where Australian photographers and videographers could get found, book the work, get paid and deliver it, without paying anyone a cut of their job. That place now exists, and this issue shows you how to get the most out of it before the busy months hit.",
        "If you only have a minute, skip to the ten-minute checklist. It's the part that gets you in front of clients.",
      ], sig: ['Michael, Founder of LensTrybe', 'connect@lenstrybe.com · lenstrybe.com'] },
      { k: 'feature', label: 'Feature', h: 'What you can do on LensTrybe *today*', body: [
        "### Get found by the right clients",
        "**Find a Creative** is where clients search by what you do and where you are. Your profile shows your work, your services and your reviews. It's free on every plan, including Trybe Free.",
        "### Pick up work from the job board",
        "Clients post jobs for free, with the date, the location and the budget up front. You can browse every job on any plan. Until 31 December, every plan, including Trybe Free, can reply to any job anywhere in Australia. After that, Trybe Essential replies to jobs in your own state, and Trybe Complete and Trybe Studio reply anywhere. Your reply includes your price, what's included and a short message, and the client picks who they want.",
        "### Run the job from one place",
        "On Trybe Complete and Trybe Studio, everything after the enquiry lives in LensTrybe. Quotes the client can accept online. Contracts they sign on their phone. Invoices with payment tracking. A branded client portal where they see everything about their booking in one spot. And when the shoot is done, you deliver the files through **LensTrybe Deliver** with your branding.",
        "### Work with other creatives",
        "**Collaborate** is where you find a second shooter or post a collab. The **Marketplace** is where you buy and sell gear with other creatives. On Trybe Studio, you can bring up to four team members into your workspace.",
        "> LensTrybe takes no commission on your jobs, ever. We make our money from plans, and Trybe Free is free for good.",
      ] },
      { k: 'plans', label: 'Plans', h: 'Four plans, *no commission*', body: [
        "Every plan keeps 100% of what you earn. Pick the one that fits where your business is now, and change it any time.",
      ], plans: [
        { n: 'Trybe Free', p: 'Free', s: 'Always free', who: 'Getting found and building your presence', d: 'A public profile in Find a Creative, 5 portfolio photos and 3 bookings a month.', tags: ['Profile', 'Find a Creative', 'Browse jobs'] },
        { n: 'Trybe Essential', p: '$24.99/mo', s: 'or $249.90 a year', who: 'Looking the part and taking bookings', d: 'Your own website, 5 bookings a month, a client list, review requests, and job replies in your state.', tags: ['Website', 'Job replies in your state', 'Reviews'] },
        { n: 'Trybe Complete', p: '$74.99/mo', s: 'or $749.90 a year', who: 'Running your whole business in one place', hot: true, d: 'Quotes, contracts, invoicing, client portals and Deliver, unlimited bookings, and job replies anywhere in Australia.', tags: ['Quotes', 'Contracts', 'Invoicing', 'Client portals'] },
        { n: 'Trybe Studio', p: '$149.99/mo', s: 'or $1,499.90 a year', who: 'Studios and teams', d: 'Everything in Trybe Complete, plus a team of up to four, your own domain and the homepage spotlight.', tags: ['Team', 'Own domain', 'Homepage spotlight'] },
      ], after: '**Annual plans get you two months free.**' },
      { k: 'checklist', label: 'The ten-minute checklist', h: 'Get into Find a Creative in *ten minutes*', body: [
        "Clients can only find you in Find a Creative once your profile has three things. That's the whole list:",
        "**1. A profile photo.** Your face or your logo, clear and well lit.",
        "**2. A tagline.** One line that says what you shoot and where. \"Wedding and elopement photographer, Sunshine Coast\" beats \"Capturing your moments\".",
        "**3. At least one creative type.** Photographer, videographer, drone pilot, editor and so on.",
        "Then, if you have another five minutes:",
        "**4. Add your best work.** Choose a few images that show the kind of jobs you want more of, not everything you've ever shot.",
        "**5. Set your service area.** It decides which job board posts suit you.",
        "**6. Add your services and starting prices.** Clients shortlist people who show a price.",
        "That's it. You're now in front of every client searching your area.",
      ] },
      { k: 'howto', label: 'How-to', h: 'Reply to your *first job*', body: [
        "**1.** Open the **Job board** and find a job that suits your date, area and price.",
        "**2.** Tap **Reply**, enter your price and what's included, and write two or three sentences that show you read their brief.",
        "**3.** Send it. If the client accepts, a conversation opens with them, and they're added to your clients automatically.",
      ], tip: { h: 'Reply early, keep it short', p: 'A short, specific message that mentions their date and their brief stands out.' } },
      { k: 'founding', label: 'Founding 100', h: 'Help shape *LensTrybe*', body: [
        "We're inviting 100 Australian creatives to help shape LensTrybe. Founding creatives get 12 months of Trybe Complete free, then $49 a month locked in for life, plus a permanent Founding Creative badge.",
        "In return we ask for a finished profile within seven days, your next three jobs run through the platform, and a line of feedback each month.",
        "Places are invitation only. If you'd like one, email **connect@lenstrybe.com** and tell me about your work.",
      ] },
    ],
  },
]
