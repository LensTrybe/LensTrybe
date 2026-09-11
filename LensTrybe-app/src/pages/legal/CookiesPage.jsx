import LegalDocument from '../../components/legal/LegalDocument'

const UPDATED = '11 September 2026'

const INTRO = `This Cookies Policy explains how LensTrybe ("we", "us") uses cookies and similar technologies on lenstrybe.com.

In short: we only use what's needed to run LensTrybe, remember your settings and count visits anonymously. We don't use advertising or tracking cookies, and we don't follow you around other websites.`

const SECTIONS = [
  {
    id: 'what',
    title: 'What cookies and similar technologies are',
    body: `Cookies are small text files a website saves in your browser. Similar technologies include your browser's local storage and session storage, which let a website remember information on your device.

LensTrybe mostly uses local storage and session storage rather than cookies. In this policy, "cookies" means all of these.`,
  },
  {
    id: 'essential',
    title: 'Essential',
    body: `These are needed for LensTrybe to work. They can't be switched off in our settings. If you block them in your browser, you won't be able to sign in.

• **Sign-in session** (local storage): keeps you signed in securely as you move around the Platform. Removed when you sign out.
• **Sign-in redirect** (session storage): remembers the page you were on so we can take you back after you sign in, and shows the right message after signing in with Google. Cleared when you close the tab.
• **Sign-up progress** (session storage): remembers the plan you chose and any founding code you entered while you finish signing up.
• **Security:** protections against misuse, such as rate limits, work on our servers and don't store anything extra on your device.`,
  },
  {
    id: 'preferences',
    title: 'Preferences',
    body: `These remember choices you make so LensTrybe works the way you like. They stay on your device and are never sent to advertisers.

• **Theme** (local storage): whether you prefer the light or dark dashboard.
• **Dashboard layout** (local storage): your dashboard widget layout, quick links and where you've placed the note-taker.
• **Templates and dismissed notices** (local storage): templates you've saved on this device, and notices you've already closed so we don't show them again.
• **Intro animation** (session storage): whether you've already seen the opening animation, so it doesn't replay during the same visit.
• **View counting** (session storage): stops the same visit counting as more than one profile view or search appearance.
• **Preview and demo modes** (local storage or session storage): used when you open a preview or demo link.

You can clear these at any time by clearing your browser's site data for lenstrybe.com.`,
  },
  {
    id: 'analytics',
    title: 'Analytics',
    body: `We use Vercel Web Analytics to understand, in aggregate, which pages are visited and how the site performs. It doesn't use cookies and doesn't identify you. Visits are counted using a temporary anonymous identifier that is discarded after 24 hours. We remove private link codes (such as client portal, delivery and signing links) from page addresses before they're counted.

We don't use Google Analytics, advertising pixels or session recording tools.`,
  },
  {
    id: 'third-party',
    title: 'Third-party services',
    body: `Some features load services from other companies, which may set their own cookies under their own policies:

• **Revolut**, when you enter card details to subscribe. Revolut may use cookies to process your payment securely and prevent fraud.
• **Google**, if you choose to sign in with Google. Google may set cookies on its own sign-in pages.
• **Google Fonts**, which we use for typefaces. Google receives your IP address when fonts load, but no cookies are set for LensTrybe.
• **Cloudflare**, which delivers the tool used to download files as a ZIP on delivery pages. Cloudflare receives your IP address when it loads.

We don't control these cookies. You can read [Revolut's privacy policy](https://www.revolut.com/legal/privacy/) and [Google's privacy policy](https://policies.google.com/privacy) for more information.`,
  },
  {
    id: 'not-used',
    title: 'What we don’t use cookies for',
    body: `We never use cookies to:

• show you ads, or build advertising profiles
• track you across other websites
• sell or share information with advertisers`,
  },
  {
    id: 'control',
    title: 'Managing cookies',
    body: `You can view, block or delete cookies and site data in your browser settings:

• **Chrome:** Settings > Privacy and security > Third-party cookies, or Site settings
• **Safari:** Settings > Safari > Advanced > Website Data (iPhone), or Safari > Settings > Privacy (Mac)
• **Firefox:** Settings > Privacy & Security > Cookies and Site Data
• **Edge:** Settings > Cookies and site permissions

If you block essential storage, you won't be able to sign in. Clearing site data will sign you out and reset your preferences.`,
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: `If we start using a new kind of cookie, we'll update this policy first. If it isn't essential, we'll ask for your consent before using it where the law requires. If we make a significant change, we'll email registered users at least 30 days before it takes effect.`,
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: `Questions about cookies: [privacy@lenstrybe.com](mailto:privacy@lenstrybe.com). Our [Privacy Policy](/privacy) explains how we handle personal information more generally.`,
  },
]

export default function CookiesPage() {
  return <LegalDocument title="Cookies Policy" updated={UPDATED} intro={INTRO} sections={SECTIONS} />
}
