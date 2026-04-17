export default function TermsPage() {
  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', padding: '60px 24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', color: '#ccc', lineHeight: 1.8 }}>
        <h1 style={{ color: '#fff', fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>Terms and Conditions</h1>
        <p style={{ color: '#39ff14', fontSize: '14px', marginBottom: '48px' }}>LensTrybe · Effective Date: March 14, 2026</p>

        {[
          { title: '1. Acceptance of Terms', body: 'These Terms and Conditions ("Terms") govern your use of the LensTrybe platform operated by Michael Trybe (Sole Trader), Queensland, Australia ("LensTrybe", "we", "us"). By creating an account or using LensTrybe, you agree to be bound by these Terms. If you do not agree, do not use the platform.' },
          { title: '2. Description of Service', body: 'LensTrybe is a subscription-based directory and marketplace platform that connects visual creative professionals (Photographers, Videographers, Drone Pilots, Video Editors, Photo Editors, Social Media Managers, Hair and Makeup Artists, and UGC Creators) with clients who wish to hire them.\n\nLensTrybe operates as a directory and discovery platform. We do not act as an agent, employer, or contractor of any creative or client. We do not facilitate or process payments between creatives and clients. Any agreements, contracts, payments, and disputes arising from arrangements between creatives and clients are solely between those parties.' },
          { title: '3. User Accounts', body: '3.1 Eligibility\nYou must be at least 18 years of age to create an account on LensTrybe. By registering, you confirm that you meet this requirement.\n\n3.2 Account Responsibility\nYou are responsible for maintaining the confidentiality of your account credentials. You are responsible for all activity that occurs under your account. Notify us immediately at connect@lenstrybe.com if you suspect unauthorised access to your account.\n\n3.3 Accurate Information\nYou agree to provide accurate, current, and complete information when creating your account and profile, and to keep this information up to date.' },
          { title: '4. Creative Subscriptions', body: '4.1 Subscription Tiers\nLensTrybe offers four subscription tiers for creative professionals: Basic (free), Pro, Expert, and Elite. The features included in each tier are described on the pricing page at lenstrybe.com. LensTrybe reserves the right to modify tier features with reasonable notice to subscribers.\n\n4.2 Billing\nPaid subscriptions are billed monthly or annually through Stripe. By subscribing, you authorise LensTrybe to charge your payment method on a recurring basis. Annual subscriptions are billed upfront and include two months free compared to the monthly rate.\n\n4.3 Founding Member Period\nCreatives who join during the Founding Member period (prior to September 1, 2026) may build their profile without charge. Billing for paid tiers commences on September 1, 2026. Founding Members receive a permanent Founding Member badge on their profile.\n\n4.4 Price Changes\nLensTrybe reserves the right to change subscription prices. We will provide at least 30 days notice of any price increase. Continued use of the platform after a price change takes effect constitutes acceptance of the new price.' },
          { title: '5. Refund Policy', body: 'Please refer to our Refund Policy section below for full details on cancellations and refunds.' },
          { title: '6. Client Accounts', body: 'Client accounts are free. Clients may browse creative profiles, save favourites, and contact creatives through the platform. LensTrybe does not charge clients any fees for using the platform.' },
          { title: '7. User Conduct', body: 'You agree not to:\n\n• Post false, misleading, or fraudulent information on your profile\n• Impersonate any person or entity\n• Use the platform for any unlawful purpose\n• Harass, abuse, or harm other users\n• Upload content that infringes third-party intellectual property rights\n• Attempt to gain unauthorised access to the platform or other user accounts\n• Use automated tools to scrape or extract data from the platform\n• Post content that is offensive, discriminatory, or inappropriate\n\nLensTrybe reserves the right to suspend or terminate accounts that violate these Terms without notice or refund.' },
          { title: '8. Content Ownership', body: '8.1 Your Content\nYou retain ownership of all content you upload to LensTrybe, including profile photos, portfolio images, and videos. By uploading content, you grant LensTrybe a non-exclusive, royalty-free licence to display, reproduce, and distribute your content solely for the purpose of operating the platform and marketing LensTrybe.\n\n8.2 Content Responsibility\nYou are solely responsible for the content you upload. You warrant that you own or have the necessary rights to all content you post, and that your content does not infringe any third-party rights.' },
          { title: '9. Credentials and Verification', body: 'LensTrybe allows creatives to display credential badges (ABN, insurance, Blue Card, police check, WWVP) on their profiles. LensTrybe does not independently verify the authenticity of uploaded credential documents. Clients are responsible for independently verifying any credentials before engaging a creative.' },
          { title: '10. Disputes Between Users', body: 'LensTrybe is not a party to any agreement between a creative and a client. All disputes arising from such arrangements are solely between the creative and the client. LensTrybe does not mediate, arbitrate, or resolve disputes between users and accepts no liability for any loss or damage arising from arrangements made through the platform.' },
          { title: '11. Limitation of Liability', body: 'To the maximum extent permitted by Australian law, LensTrybe is not liable for any indirect, incidental, special, or consequential damages arising from your use of the platform, including but not limited to loss of income, loss of data, or loss of business opportunity.\n\nOur total liability to you for any claim arising from your use of LensTrybe is limited to the subscription fees you have paid to us in the 12 months preceding the claim.' },
          { title: '12. Platform Availability', body: 'LensTrybe does not guarantee uninterrupted or error-free access to the platform. We may suspend the platform temporarily for maintenance, upgrades, or reasons beyond our control. We will endeavour to provide advance notice of planned downtime where possible.' },
          { title: '13. Termination', body: 'You may cancel your account at any time through your account settings. LensTrybe may suspend or terminate your account at any time for breach of these Terms or for any other reason at our discretion.\n\nUpon termination, your profile will be removed from the platform. Content you have uploaded may be retained for a period as described in our Privacy Policy.' },
          { title: '14. Governing Law', body: 'These Terms are governed by the laws of Queensland, Australia. Any disputes arising from these Terms will be subject to the exclusive jurisdiction of the courts of Queensland, Australia.' },
          { title: '15. Changes to These Terms', body: 'LensTrybe may update these Terms from time to time. We will notify registered users of material changes by email. Continued use of the platform after changes take effect constitutes acceptance of the updated Terms.' },
          { title: '16. Contact', body: 'For any questions regarding these Terms, contact us at connect@lenstrybe.com.' },
        ].map((section, i) => (
          <div key={i} style={{ marginBottom: '40px' }}>
            <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>{section.title}</h2>
            {section.body.split('\n\n').map((para, j) => (
              <p key={j} style={{ marginBottom: '12px', whiteSpace: 'pre-line' }}>{para}</p>
            ))}
          </div>
        ))}

        <div style={{ marginTop: '60px', padding: '32px', background: 'rgba(57,255,20,0.05)', border: '1px solid rgba(57,255,20,0.15)', borderRadius: '12px' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Refund Policy</h2>
          <p style={{ color: '#39ff14', fontSize: '14px', marginBottom: '32px' }}>LensTrybe · Effective Date: March 14, 2026</p>
          {[
            { title: '1. Overview', body: 'This Refund Policy applies to all paid subscriptions on the LensTrybe platform. By subscribing to a paid tier, you agree to this policy.' },
            { title: '2. Monthly Subscriptions', body: 'Monthly subscriptions are non-refundable. If you cancel a monthly subscription, you will retain access to your paid tier features until the end of the current billing period. Your subscription will not renew after that date and you will not be charged again.\n\nNo partial refunds are issued for unused days in a monthly billing period.' },
            { title: '3. Annual Subscriptions', body: '3.1 Within 14 Days of Purchase\nIf you purchase an annual subscription and request a refund within 14 days of the initial purchase date, you are entitled to a full refund of the annual subscription fee. To request a refund, contact connect@lenstrybe.com within 14 days of your purchase with your account email and reason for the refund request.\n\n3.2 After 14 Days\nIf you cancel an annual subscription after the 14-day refund window, you are entitled to a partial refund equivalent to 50% of the subscription fees for the remaining complete months of your annual term.\n\nFor example: if you purchase an annual subscription and cancel after 4 months, you have 8 months remaining. You would receive a refund of 50% of the value of those 8 remaining months.\n\nRefunds after 14 days are processed at LensTrybe\'s discretion and will be calculated based on the original purchase price.' },
            { title: '4. Founding Member Period', body: 'During the Founding Member period (prior to September 1, 2026), creative profiles are built free of charge and no billing occurs. This policy applies from September 1, 2026 when billing commences.' },
            { title: '5. Free (Basic) Tier', body: 'The Basic tier is free and no refunds apply. There are no charges associated with the Basic tier.' },
            { title: '6. How to Request a Refund', body: 'To request a refund, email connect@lenstrybe.com with:\n\n• Your full name and account email address\n• Your subscription tier and billing period (monthly or annual)\n• The date of your subscription purchase\n• Your reason for requesting a refund\n\nWe will respond to refund requests within 1-3 business days. Approved refunds will be processed to your original payment method within 10 business days.' },
            { title: '7. Exceptional Circumstances', body: 'LensTrybe may issue refunds outside of this policy at our sole discretion in exceptional circumstances, such as significant platform downtime or technical issues that prevent access to paid features.' },
            { title: '8. Changes to This Policy', body: 'LensTrybe reserves the right to modify this Refund Policy at any time. Changes will be communicated to subscribers by email with at least 30 days notice before taking effect.' },
            { title: '9. Contact', body: 'For all refund enquiries, contact us at connect@lenstrybe.com.' },
          ].map((section, i) => (
            <div key={i} style={{ marginBottom: '32px' }}>
              <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>{section.title}</h3>
              {section.body.split('\n\n').map((para, j) => (
                <p key={j} style={{ marginBottom: '10px', whiteSpace: 'pre-line' }}>{para}</p>
              ))}
            </div>
          ))}
        </div>

        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '13px', color: '#666' }}>
          <p>LensTrybe · Queensland, Australia · lenstrybe.com</p>
          <p>© 2026 LensTrybe. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
