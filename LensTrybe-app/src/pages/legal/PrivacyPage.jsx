export default function PrivacyPage() {
  const sections = [
    { title: '1. Introduction', body: 'LensTrybe ("we", "us", "our") is a subscription-based directory and marketplace platform connecting visual creative professionals with clients. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use the LensTrybe platform at lenstrybe.com.\n\nBy creating an account or using LensTrybe, you agree to the practices described in this Privacy Policy. If you do not agree, please do not use our platform.\n\nLensTrybe is operated by Michael Trybe (Sole Trader), Queensland, Australia. We are committed to complying with the Australian Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).' },
    { title: '2. Information We Collect', body: '2.1 Information You Provide\n• Account details: name, email address, password, phone number\n• Profile information: display name, bio, tagline, location, profile photo, portfolio images and videos\n• Business information: ABN/ACN, business name\n• Credential documents: uploaded copies of insurance, Blue Card, police check, WWVP, or other verification documents\n• Payment information: billing details processed securely by Stripe. LensTrybe does not store full card numbers.\n• Communications: messages sent through the platform between creatives and clients\n• Content: any files, images, videos, or documents you upload to the platform\n\n2.2 Information Collected Automatically\n• Usage data: pages visited, features used, search queries, time on platform\n• Device information: browser type, operating system, IP address\n• Cookies and similar tracking technologies' },
    { title: '3. How We Use Your Information', body: 'We use your personal information to:\n\n• Create and manage your account\n• Display your public creative profile to clients\n• Process subscription payments through Stripe\n• Enable messaging between creatives and clients\n• Send transactional emails such as welcome messages, payment confirmations, and account notifications\n• Improve the platform through usage analytics\n• Respond to support enquiries\n• Comply with legal obligations\n\nWe will not sell your personal information to third parties. We do not use your data for advertising purposes.' },
    { title: '4. How We Share Your Information', body: '4.1 Public Profile Information\nWhen you create a creative profile on LensTrybe, the following information is visible to the public and to clients: display name, profile photo, location (city and state), bio, specialties, portfolio, subscription tier badge, credentials badges, availability, and reviews.\n\nYou control what you include in your public profile. Do not include sensitive personal information you do not wish to be publicly visible.\n\n4.2 Third-Party Service Providers\nWe share data with trusted third-party providers who help us operate the platform:\n\n• Stripe — payment processing. Stripe\'s privacy policy applies to payment data.\n• Resend — transactional email delivery\n• Base44 — platform infrastructure and hosting\n\nThese providers are only permitted to use your data to provide services to LensTrybe and are bound by confidentiality obligations.\n\n4.3 Legal Requirements\nWe may disclose your information if required by law, court order, or government authority, or to protect the rights, safety, or property of LensTrybe, our users, or the public.' },
    { title: '5. Data Storage and Security', body: 'Your data is stored on servers provided by our infrastructure partners. LensTrybe implements reasonable technical and organisational measures to protect your personal information from unauthorised access, loss, or disclosure.\n\nNo method of transmission over the internet is completely secure. While we take reasonable steps to protect your data, we cannot guarantee absolute security.\n\nWe retain your personal information for as long as your account is active or as needed to provide our services. If you delete your account, we will delete or anonymise your personal data within 30 days, except where we are required to retain it for legal or compliance purposes.' },
    { title: '6. Your Rights', body: 'Under the Australian Privacy Act 1988, you have the right to:\n\n• Access the personal information we hold about you\n• Request correction of inaccurate or incomplete information\n• Request deletion of your personal information (subject to legal obligations)\n• Opt out of non-essential communications\n\nTo exercise any of these rights, contact us at connect@lenstrybe.com. We will respond within 1-3 business days.' },
    { title: '7. Cookies', body: 'LensTrybe uses cookies and similar technologies to maintain your session, remember your preferences, and analyse platform usage. You can control cookies through your browser settings. Disabling cookies may affect your ability to use some features of the platform.' },
    { title: '8. Children\'s Privacy', body: 'LensTrybe is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from minors. If we become aware that we have collected data from a person under 18, we will delete it promptly.' },
    { title: '9. Changes to This Policy', body: 'We may update this Privacy Policy from time to time. We will notify registered users of material changes by email. Continued use of the platform after changes take effect constitutes acceptance of the updated policy.' },
    { title: '10. Contact Us', body: 'If you have any questions or concerns about this Privacy Policy, please contact us at:\n\nLensTrybe\nEmail: connect@lenstrybe.com\nWebsite: lenstrybe.com\nQueensland, Australia' },
  ]

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', padding: '60px 24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', color: '#ccc', lineHeight: 1.8 }}>
        <h1 style={{ color: '#fff', fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>Privacy Policy</h1>
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
