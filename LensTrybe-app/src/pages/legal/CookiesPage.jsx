export default function CookiesPage() {
  const sections = [
    { title: '1. What Are Cookies', body: 'Cookies are small text files that are stored on your device when you visit a website. They are widely used to make websites work efficiently and to provide information to the website operator. Cookies do not give us access to your device or any information beyond what you choose to share with us.' },
    { title: '2. How LensTrybe Uses Cookies', body: 'LensTrybe uses cookies solely to operate the platform correctly. We do not use cookies for advertising, remarketing, or tracking you across other websites.\n\n2.1 Essential Cookies\nThese cookies are necessary for the platform to function. Without them, core features such as logging in, maintaining your session, and accessing your dashboard would not work. These cookies cannot be disabled.\n\n• Session cookies — keep you logged in while you navigate the platform\n• Authentication cookies — verify your identity and account permissions\n• Security cookies — protect against cross-site request forgery and other security threats\n• Preference cookies — remember your region and currency selection\n\n2.2 Functional Cookies\nThese cookies allow the platform to remember choices you have made and provide enhanced functionality. Disabling these may affect your experience but will not prevent you from using the platform.\n\n• UI preference cookies — remember display settings and navigation state\n• Form state cookies — preserve form data if you navigate away mid-completion\n\n2.3 Analytics Cookies\nLensTrybe currently uses only built-in platform analytics to understand how the platform is being used. This data is used solely to improve the platform experience. We do not use Google Analytics or any third-party analytics tools at this time.\n\nIf we introduce third-party analytics tools in the future, this policy will be updated and users will be notified.' },
    { title: '3. What We Do Not Use Cookies For', body: 'LensTrybe does not use cookies for:\n\n• Advertising or retargeting\n• Tracking your activity on other websites\n• Selling or sharing your data with advertisers\n• Building advertising profiles' },
    { title: '4. Third-Party Cookies', body: 'Some third-party services we use may set their own cookies on your device:\n\n• Stripe — our payment processor may set cookies during the checkout process to prevent fraud and ensure payment security. These cookies are governed by Stripe\'s own privacy and cookie policy.\n\nWe do not control third-party cookies and recommend reviewing the relevant third-party policies for more information.' },
    { title: '5. Managing Cookies', body: 'You can control and manage cookies through your browser settings. Most browsers allow you to:\n\n• View cookies that have been set\n• Block all cookies\n• Block third-party cookies\n• Delete cookies when you close your browser\n\nPlease be aware that blocking essential cookies will prevent you from logging in and using key features of the LensTrybe platform.\n\nInstructions for managing cookies in common browsers:\n• Google Chrome: chrome://settings/cookies\n• Safari: Preferences > Privacy\n• Firefox: about:preferences#privacy\n• Microsoft Edge: edge://settings/privacy' },
    { title: '6. Cookie Consent', body: 'By continuing to use the LensTrybe platform, you consent to our use of essential and functional cookies as described in this policy. Where we use non-essential cookies, we will request your consent through a cookie notice on the platform.' },
    { title: '7. Changes to This Policy', body: 'We may update this Cookies Policy from time to time, particularly if we introduce new tools or third-party services. We will notify registered users of any material changes by email. The effective date at the top of this page will always reflect the most recent version.' },
    { title: '8. Contact Us', body: 'If you have any questions about our use of cookies, please contact us at:\n\nLensTrybe\nEmail: connect@lenstrybe.com\nWebsite: lenstrybe.com\nQueensland, Australia' },
  ]

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', padding: '60px 24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', color: '#ccc', lineHeight: 1.8 }}>
        <h1 style={{ color: '#fff', fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>Cookies Policy</h1>
        <p style={{ color: '#39ff14', fontSize: '14px', marginBottom: '48px' }}>LensTrybe · Effective Date: March 14, 2026</p>
        {sections.map((section, i) => (
          <div key={i} style={{ marginBottom: '40px' }}>
            <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>{section.title}</h2>
            {section.body.split('\n\n').map((para, j) => (
              <p key={j} style={{ marginBottom: '12px', whiteSpace: 'pre-line' }}>{para}</p>
            ))}
          </div>
        ))}
        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '13px', color: '#666' }}>
          <p>LensTrybe · Queensland, Australia · lenstrybe.com</p>
          <p>© 2026 LensTrybe. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
