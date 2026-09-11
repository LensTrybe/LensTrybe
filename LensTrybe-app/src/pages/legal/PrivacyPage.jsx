import LegalDocument from '../../components/legal/LegalDocument'

const UPDATED = '11 September 2026'

const INTRO = `This Privacy Policy explains how LensTrybe ("LensTrybe", "we", "us", "our") collects, uses, stores and shares personal information when you use lenstrybe.com and our services (the "Platform").

We handle personal information in line with the Australian Privacy Principles in the Privacy Act 1988 (Cth). We don't sell your personal information, and we don't use it for third-party advertising.

If you have a question at any time, email [privacy@lenstrybe.com](mailto:privacy@lenstrybe.com).`

const SECTIONS = [
  {
    id: 'collect',
    title: 'Information we collect',
    body: `### Creatives
• **Account details:** name, business name, email address, password (stored in encrypted form), phone number, location and the plan you're on.
• **Profile and portfolio:** bio, tagline, skills, services, pricing, availability, photos, videos, social links and website content.
• **Business details:** ABN, business contact details, and bank account details you choose to add so they appear on your invoices.
• **Credential documents:** copies of insurance, Blue Card, police check, Working with Vulnerable People or similar documents you upload.
• **Business records:** clients, contacts, projects, bookings, meetings, quotes, invoices, contracts and signatures, expenses, notes, tasks and files you create or upload.
• **Billing details:** your plan, billing history and payment status. Card details are collected and stored by our payment provider, Revolut. We never see or store your full card number.

### Clients
• **Account details:** name, email address, and optionally your phone number and company.
• **Activity:** messages, job posts, saved Creatives, and documents or files Creatives share with you.

### People who don't have an account
Creatives use LensTrybe to run their business, so we also hold information about people they work with. This includes their clients' names, contact details, addresses, and details of quotes, invoices, contracts, bookings and deliveries. It also includes people who send an enquiry through a Creative's profile or website, and people who write a review.

We handle this information on behalf of the Creative, who is responsible for having collected it lawfully. If you're a Creative's client and have a question about your information, please contact that Creative first. You can also contact us.

### Information collected automatically
• **Usage and device information:** pages visited, features used, searches, browser and device type, approximate location (from your IP address) and the date and time of your visit.
• **Security logs:** sign-in events, IP addresses and error logs, used to keep the Platform secure.
• **Profile statistics:** when a Creative's profile is viewed or appears in search, we record it (including the viewer's account, if they're signed in) so we can show Creatives accurate totals in their insights. Creatives see totals, not who viewed them.

See our [Cookies Policy](/cookies) for how we use cookies and similar technologies.`,
  },
  {
    id: 'how-collect',
    title: 'How we collect it',
    body: `We collect personal information:

• directly from you when you sign up, fill in your profile, use our tools, message someone or contact us
• from Creatives, when they add details about their clients or send documents, portal links, delivery links or review requests
• from other users, for example when someone sends you a message, invites you to a team or writes a review
• from Google, if you choose to sign in with Google (your name, email address and profile picture)
• from Revolut, which tells us whether a payment succeeded
• automatically, when you use the Platform

If you don't give us certain information, we may not be able to provide some features. For example, we can't create an account without an email address.`,
  },
  {
    id: 'use',
    title: 'How we use it',
    body: `We use personal information to:

• create and manage accounts and verify sign-ins
• show Creatives' public profiles and portfolios, and help Clients find the right Creative
• provide the business tools, including sending the quotes, invoices, contracts, portal links, delivery links, meeting invites and review requests Creatives ask us to send
• let users message each other and notify you about activity on your account
• process subscriptions, trials, plan changes and failed payments
• generate PDF copies of invoices, quotes and contracts
• provide Lumi, our AI assistant, when you choose to use it
• keep the Platform safe, including moderating content, preventing fraud and spam, and enforcing our [Terms](/terms)
• respond to support requests, complaints and feedback
• understand how the Platform is used so we can improve it
• send you service emails, and marketing emails if you've agreed to receive them
• meet our legal obligations

We only use your information for these purposes, for purposes related to them that you would reasonably expect, or where you have agreed or the law permits it.`,
  },
  {
    id: 'public',
    title: 'What other people can see',
    body: `### Creative profiles are public
Your public profile can be seen by anyone, including people who aren't signed in and search engines. This includes your display or business name, profile photo, location (city and state), bio, skills, services, portfolio, plan badge, credential badges, availability, reviews, and any website or social links you add. Your portfolio website is public too.

Please only add information to your public profile that you're happy for anyone to see.

### Kept private
Your email address, phone number, bank details, credential documents, business records and messages are not shown publicly. Clients see the contact details you choose to share. Your bank details appear only on invoices you send.

### Sharing between users
When you message someone, send them a document or hire them, they will see the information you share. Clients can see the details a Creative includes in documents sent to them, and Creatives can see the details a Client provides.`,
  },
  {
    id: 'share',
    title: 'Who we share it with',
    body: `We share personal information only as needed to run the Platform.

### Service providers
These companies host, store and process data for us under contract. They may only use it to provide their service to LensTrybe.

• **Supabase:** database, sign-in and file storage (stored in Australia, Sydney region)
• **Vercel:** website hosting and privacy-friendly usage analytics (global network, including the United States)
• **Resend:** sending emails (United States)
• **Revolut:** subscription payments (processing may take place in Australia, the United Kingdom and the European Union)
• **Google:** optional sign-in with Google, automated image safety checks and web fonts (United States and other countries)
• **Anthropic:** the AI model behind Lumi (United States)
• **PDFShift:** creating PDF copies of documents (France)
• **Cloudflare:** delivers the download tool used on file delivery pages (global network)

### Others
• **Other users**, as described in [section 4](#public).
• **Professional advisers** such as our lawyers, accountants and insurers, where needed.
• **Authorities**, where required by law or to protect the safety, rights or property of any person, including to report illegal content.
• **A buyer of our business**, if LensTrybe is sold or restructured. The buyer would have to handle your information in line with this policy.

We do not sell personal information, and we do not share it with advertisers.`,
  },
  {
    id: 'overseas',
    title: 'Sending information overseas',
    body: `Our main database and files are stored in Australia. Some of our service providers are based overseas, or use servers overseas, as listed in [section 5](#share). This means some personal information may be sent to or accessed from the United States, the United Kingdom, countries in the European Union (including France), and other countries where those providers operate.

We take reasonable steps to make sure overseas providers protect personal information to a standard similar to the Australian Privacy Principles. We do this by choosing reputable providers with strong security practices and relying on their contractual data protection commitments.`,
  },
  {
    id: 'automated-decisions',
    title: 'Automated decisions',
    body: `Some decisions on LensTrybe are made, or mostly made, by computer programs. This helps us keep the Platform safe and run billing reliably. They include:

• **Content checks.** Text you post (such as profile text, reviews and messages) is automatically checked against lists of prohibited words. Images you upload, including portfolio images and client deliveries, are checked by Google's image safety service. Content that fails these checks is blocked automatically. This uses the content itself.
• **Message contact details.** On some plans, messages that appear to include phone numbers, email addresses or other contact details are automatically blocked. This uses the message text and your plan.
• **Plan features and limits.** What you can use, and how you appear in search, depends on your plan and your profile details. This uses your plan, location, skills and profile information.
• **Billing.** Renewal charges happen automatically. If a payment fails, we retry it daily, and after 3 failed attempts or 7 days (whichever comes first) your account moves to the free Basic plan. This uses your plan, billing dates and payment status.
• **Account deletion.** When you delete your account, it is scheduled for permanent deletion automatically 30 days later unless you reactivate it. This uses your account ID and the date you asked.

If you think an automated decision about you is wrong, email [support@lenstrybe.com](mailto:support@lenstrybe.com) and a person will review it.`,
  },
  {
    id: 'ai',
    title: 'Lumi, our AI assistant',
    body: `Lumi is optional. When you use it, your messages and some details about your business (your business name and creative category) are sent to our AI provider, Anthropic, to generate a response. Your Lumi conversations are saved to your account so you can come back to them, and you can delete them at any time.

Under its commercial terms, our AI provider doesn't use this data to train its models. Please don't share sensitive information with Lumi that you don't need to.`,
  },
  {
    id: 'emails',
    title: 'Emails and marketing',
    body: `We send service emails that you need to use LensTrybe, such as sign-in and security emails, billing emails, and notifications about messages, bookings and documents. You can't opt out of essential service emails while you have an account.

We only send marketing emails, such as our newsletter, if you've agreed to receive them. Every marketing email has an unsubscribe link, and you can also unsubscribe by emailing [privacy@lenstrybe.com](mailto:privacy@lenstrybe.com).`,
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: `We take reasonable steps to protect personal information from misuse, interference, loss and unauthorised access, change or disclosure. These include:

• encryption of data in transit, and encrypted password storage
• strict access controls, so users can only see their own private data and the information others have shared with them
• bank details and credential documents stored separately and visible only to their owner
• private file links that expire, and rate limits to prevent abuse
• email confirmation codes for sensitive actions such as deleting an account
• limiting staff access to what is needed to support you

No system is completely secure. If a data breach is likely to cause you serious harm, we will notify you and the Office of the Australian Information Commissioner (OAIC) as required by law.`,
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: `We keep your information while your account is active and for as long as we need it to provide the Platform.

• **When you delete your account,** it is hidden straight away and permanently deleted, including your uploaded files, 30 days later. You can reactivate it within those 30 days.
• **Backups** are kept for up to 7 days, so deleted information may remain in backups for up to 7 days after it is removed.
• **After deletion,** we keep a minimal record that the deletion happened (an internal account ID, the account type, the plan and the dates). This record doesn't include your name or email address.
• **Payment records** for subscriptions are kept by our payment provider, Revolut, and in our accounting records for as long as tax and financial laws require (generally 5 years).
• **Security logs** are kept for a limited time and then automatically deleted.

If a Creative deletes their account, information they held about their clients is deleted with it.`,
  },
  {
    id: 'rights',
    title: 'Access, correction and your choices',
    body: `### Access and download
You can see and update most of your information in your dashboard. You can download a copy of your account data at any time: Creatives go to Settings > Your Data, and Clients go to Account & Data.

### Correction
You can correct your profile and account details yourself. If something is wrong that you can't change, email us and we'll fix it.

### Deletion
You can delete your account yourself at any time (see [section 11](#retention)).

### Other requests
To ask for access to or correction of any other personal information we hold, email [privacy@lenstrybe.com](mailto:privacy@lenstrybe.com). We'll need to confirm your identity first. We'll respond within 30 days. Access is free, although we may charge a reasonable fee for large or repeated requests (we'll tell you first). If we can't give you access or make a correction, we'll explain why in writing.`,
  },
  {
    id: 'complaints',
    title: 'Complaints',
    body: `If you have a concern about how we've handled your personal information, please email [privacy@lenstrybe.com](mailto:privacy@lenstrybe.com) with the details. We'll acknowledge your complaint within 5 business days, look into it, and give you our response within 30 days.

If you're not satisfied with our response, you can complain to the Office of the Australian Information Commissioner at [oaic.gov.au](https://www.oaic.gov.au) or on 1300 363 992.`,
  },
  {
    id: 'age',
    title: 'Age limit',
    body: `LensTrybe is for people aged 18 and over. We don't knowingly collect personal information from anyone under 18 for an account. If we learn that someone under 18 has created an account, we will delete it.

Creatives sometimes photograph or film children as part of their work. Creatives are responsible for having a parent's or guardian's consent before uploading or sharing images of children.`,
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: `We may update this policy from time to time. The "last updated" date at the top shows when it last changed. If we make a significant change, we'll email registered users at least 30 days before it takes effect, unless the change is needed sooner for legal or safety reasons.`,
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: `Privacy enquiries and requests: [privacy@lenstrybe.com](mailto:privacy@lenstrybe.com)

LensTrybe
Queensland, Australia
lenstrybe.com`,
  },
]

export default function PrivacyPage() {
  return <LegalDocument title="Privacy Policy" updated={UPDATED} intro={INTRO} sections={SECTIONS} />
}
