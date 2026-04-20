import { useEffect } from 'react'

const ISSUE_STYLES = "\n    :root {\n      --black: #0a0a0f;\n      --green: #39ff14;\n      --white: #f4f0eb;\n      --muted: #8a8a9a;\n      --border: rgba(255,255,255,0.08);\n      --card: rgba(255,255,255,0.04);\n    }\n\n    .trybe-edit-issue-01-root,\n    .trybe-edit-issue-01-root * {\n      margin: 0;\n      padding: 0;\n      box-sizing: border-box;\n    }\n\n    .trybe-edit-issue-01-root {\n      background: var(--black);\n      color: var(--white);\n      font-family: 'DM Sans', sans-serif;\n      font-weight: 300;\n      line-height: 1.8;\n      -webkit-font-smoothing: antialiased;\n    }\n\n    .trybe-edit-issue-01-root .masthead {\n      border-bottom: 1px solid var(--border);\n      padding: 28px 0 24px;\n      text-align: center;\n      position: relative;\n      overflow: hidden;\n    }\n\n    .trybe-edit-issue-01-root .masthead::before {\n      content: '';\n      position: absolute;\n      top: -60px; left: 50%; transform: translateX(-50%);\n      width: 500px; height: 200px;\n      background: radial-gradient(ellipse, rgba(57,255,20,0.08) 0%, transparent 70%);\n      pointer-events: none;\n    }\n\n    .trybe-edit-issue-01-root .masthead-eyebrow {\n      font-size: 10px;\n      font-weight: 500;\n      letter-spacing: 0.25em;\n      text-transform: uppercase;\n      color: var(--green);\n      margin-bottom: 12px;\n    }\n\n    .trybe-edit-issue-01-root .masthead-title {\n      font-family: 'Playfair Display', serif;\n      font-size: clamp(38px, 6vw, 64px);\n      font-weight: 700;\n      letter-spacing: -0.02em;\n      line-height: 1;\n      color: var(--white);\n    }\n\n    .trybe-edit-issue-01-root .masthead-title em {\n      font-style: italic;\n      color: var(--green);\n    }\n\n    .trybe-edit-issue-01-root .masthead-meta {\n      margin-top: 16px;\n      font-size: 12px;\n      color: var(--muted);\n      letter-spacing: 0.1em;\n      text-transform: uppercase;\n    }\n\n    .trybe-edit-issue-01-root .masthead-meta span {\n      display: inline-block;\n      margin: 0 12px;\n    }\n\n    .trybe-edit-issue-01-root .masthead-meta span + span {\n      border-left: 1px solid var(--border);\n      padding-left: 24px;\n    }\n\n    .trybe-edit-issue-01-root .container {\n      max-width: 720px;\n      margin: 0 auto;\n      padding: 0 24px;\n    }\n\n    .trybe-edit-issue-01-root .section {\n      padding: 64px 0;\n      border-bottom: 1px solid var(--border);\n    }\n\n    .trybe-edit-issue-01-root .section:last-child { border-bottom: none; }\n\n    .trybe-edit-issue-01-root .section-label {\n      display: inline-flex;\n      align-items: center;\n      gap: 10px;\n      font-size: 10px;\n      font-weight: 500;\n      letter-spacing: 0.25em;\n      text-transform: uppercase;\n      color: var(--green);\n      margin-bottom: 28px;\n    }\n\n    .trybe-edit-issue-01-root .section-label::before {\n      content: '';\n      display: block;\n      width: 24px;\n      height: 1px;\n      background: var(--green);\n    }\n\n    .trybe-edit-issue-01-root h2 {\n      font-family: 'Playfair Display', serif;\n      font-size: clamp(26px, 4vw, 38px);\n      font-weight: 700;\n      line-height: 1.2;\n      letter-spacing: -0.02em;\n      margin-bottom: 24px;\n      color: var(--white);\n    }\n\n    .trybe-edit-issue-01-root h2 em { font-style: italic; color: var(--green); }\n\n    .trybe-edit-issue-01-root h3 {\n      font-family: 'Playfair Display', serif;\n      font-size: 22px;\n      font-weight: 400;\n      margin: 36px 0 12px;\n      color: var(--white);\n    }\n\n    .trybe-edit-issue-01-root p {\n      font-size: 16px;\n      color: rgba(244,240,235,0.82);\n      margin-bottom: 20px;\n    }\n\n    .trybe-edit-issue-01-root p:last-child { margin-bottom: 0; }\n\n    .trybe-edit-issue-01-root strong { font-weight: 500; color: var(--white); }\n\n    .trybe-edit-issue-01-root .editor-note {\n      padding: 36px 40px;\n      background: var(--card);\n      border: 1px solid var(--border);\n      border-left: 3px solid var(--green);\n    }\n\n    .trybe-edit-issue-01-root .editor-note p { font-size: 17px; line-height: 1.9; }\n\n    .trybe-edit-issue-01-root .editor-sig {\n      margin-top: 28px;\n      padding-top: 20px;\n      border-top: 1px solid var(--border);\n      font-size: 13px;\n      color: var(--muted);\n    }\n\n    .trybe-edit-issue-01-root .editor-sig strong {\n      display: block;\n      font-size: 14px;\n      color: var(--white);\n      margin-bottom: 2px;\n    }\n\n    .trybe-edit-issue-01-root .pull-quote {\n      margin: 40px 0;\n      padding: 32px 0;\n      border-top: 1px solid var(--border);\n      border-bottom: 1px solid var(--border);\n    }\n\n    .trybe-edit-issue-01-root .pull-quote p {\n      font-family: 'Playfair Display', serif;\n      font-size: clamp(20px, 3vw, 26px);\n      font-style: italic;\n      color: var(--white);\n      line-height: 1.5;\n      margin: 0;\n    }\n\n    .trybe-edit-issue-01-root .plans-grid { display: grid; gap: 16px; margin-top: 32px; }\n\n    .trybe-edit-issue-01-root .plan-card {\n      padding: 28px 32px;\n      background: var(--card);\n      border: 1px solid var(--border);\n      transition: border-color 0.2s;\n    }\n\n    .trybe-edit-issue-01-root .plan-card:hover { border-color: rgba(57,255,20,0.25); }\n\n    .trybe-edit-issue-01-root .plan-header {\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      margin-bottom: 16px;\n    }\n\n    .trybe-edit-issue-01-root .plan-name {\n      font-family: 'Playfair Display', serif;\n      font-size: 22px;\n      font-weight: 700;\n    }\n\n    .trybe-edit-issue-01-root .plan-badge {\n      font-size: 11px;\n      font-weight: 500;\n      letter-spacing: 0.12em;\n      text-transform: uppercase;\n      padding: 5px 12px;\n      border-radius: 2px;\n    }\n\n    .trybe-edit-issue-01-root .badge-free  { background: rgba(255,255,255,0.08); color: var(--muted); }\n    .trybe-edit-issue-01-root .badge-pro   { background: rgba(57,255,20,0.12); color: var(--green); border: 1px solid rgba(57,255,20,0.3); }\n    .trybe-edit-issue-01-root .badge-expert{ background: rgba(57,255,20,0.18); color: var(--green); border: 1px solid rgba(57,255,20,0.4); }\n    .trybe-edit-issue-01-root .badge-elite { background: rgba(255,195,0,0.12); color: #ffc300; border: 1px solid rgba(255,195,0,0.35); }\n\n    .trybe-edit-issue-01-root .plan-price { font-size: 13px; color: var(--muted); margin-bottom: 12px; }\n    .trybe-edit-issue-01-root .plan-who   { font-size: 14px; font-weight: 500; color: var(--white); margin-bottom: 8px; }\n\n    .trybe-edit-issue-01-root .plan-description {\n      font-size: 14px;\n      color: rgba(244,240,235,0.65);\n      line-height: 1.7;\n      margin: 0;\n    }\n\n    .trybe-edit-issue-01-root .plan-features {\n      margin-top: 16px;\n      display: flex;\n      flex-wrap: wrap;\n      gap: 8px;\n    }\n\n    .trybe-edit-issue-01-root .feature-tag {\n      font-size: 11px;\n      padding: 4px 10px;\n      background: rgba(255,255,255,0.05);\n      border: 1px solid var(--border);\n      color: rgba(244,240,235,0.6);\n      letter-spacing: 0.05em;\n    }\n\n    .trybe-edit-issue-01-root .spotlight-teaser {\n      padding: 48px 40px;\n      background: var(--card);\n      border: 1px solid var(--border);\n      text-align: center;\n    }\n\n    .trybe-edit-issue-01-root .spotlight-star {\n      font-size: 28px;\n      color: var(--green);\n      margin-bottom: 20px;\n      opacity: 0.6;\n    }\n\n    .trybe-edit-issue-01-root .spotlight-teaser h3 {\n      font-family: 'Playfair Display', serif;\n      font-size: 22px;\n      font-weight: 700;\n      margin: 0 0 16px;\n      color: var(--white);\n    }\n\n    .trybe-edit-issue-01-root .spotlight-teaser p {\n      font-size: 15px;\n      color: rgba(244,240,235,0.65);\n      max-width: 500px;\n      margin: 0 auto;\n      line-height: 1.8;\n    }\n\n    .trybe-edit-issue-01-root .spotlight-teaser a {\n      color: var(--green);\n      text-decoration: none;\n    }\n\n    .trybe-edit-issue-01-root .tip-box {\n      padding: 28px 32px;\n      background: rgba(57,255,20,0.04);\n      border: 1px solid rgba(57,255,20,0.2);\n    }\n\n    .trybe-edit-issue-01-root .tip-label {\n      font-size: 10px;\n      font-weight: 500;\n      letter-spacing: 0.25em;\n      text-transform: uppercase;\n      color: var(--green);\n      margin-bottom: 12px;\n    }\n\n    .trybe-edit-issue-01-root .tip-box h3 { font-size: 18px; margin: 0 0 10px; }\n    .trybe-edit-issue-01-root .tip-box p  { font-size: 14px; margin: 0; }\n\n    .trybe-edit-issue-01-root .coming-next {\n      display: grid;\n      grid-template-columns: 1fr 1fr;\n      gap: 16px;\n      margin-top: 28px;\n    }\n\n    .trybe-edit-issue-01-root .next-item {\n      padding: 20px 24px;\n      background: var(--card);\n      border: 1px solid var(--border);\n    }\n\n    .trybe-edit-issue-01-root .next-item-label {\n      font-size: 10px;\n      letter-spacing: 0.2em;\n      text-transform: uppercase;\n      color: var(--muted);\n      margin-bottom: 8px;\n    }\n\n    .trybe-edit-issue-01-root .next-item-title {\n      font-family: 'Playfair Display', serif;\n      font-size: 16px;\n      color: var(--white);\n      line-height: 1.4;\n    }\n\n    .trybe-edit-issue-01-root .issue-footer {\n      padding: 48px 0;\n      text-align: center;\n      border-top: 1px solid var(--border);\n    }\n\n    .trybe-edit-issue-01-root .footer-logo {\n      font-family: 'Playfair Display', serif;\n      font-size: 20px;\n      letter-spacing: 0.1em;\n      margin-bottom: 12px;\n      color: var(--white);\n    }\n\n    .trybe-edit-issue-01-root .footer-logo em { color: var(--green); font-style: normal; }\n\n    .trybe-edit-issue-01-root .footer-tagline {\n      font-size: 12px;\n      color: var(--muted);\n      letter-spacing: 0.15em;\n      text-transform: uppercase;\n      margin-bottom: 24px;\n    }\n\n    .trybe-edit-issue-01-root .footer-links {\n      display: flex;\n      justify-content: center;\n      gap: 24px;\n      font-size: 12px;\n    }\n\n    .trybe-edit-issue-01-root .footer-links a { color: var(--muted); text-decoration: none; transition: color 0.2s; }\n    .trybe-edit-issue-01-root .footer-links a:hover { color: var(--green); }\n\n    .trybe-edit-issue-01-root .divider {\n      width: 40px;\n      height: 1px;\n      background: var(--green);\n      margin: 32px 0;\n      opacity: 0.5;\n    }\n\n    @media (max-width: 600px) {\n      .trybe-edit-issue-01-root .coming-next { grid-template-columns: 1fr; }\n      .trybe-edit-issue-01-root .editor-note { padding: 28px 24px; }\n      .trybe-edit-issue-01-root .plan-card   { padding: 24px 20px; }\n      .trybe-edit-issue-01-root .spotlight-teaser { padding: 32px 20px; }\n    }\n  "

export default function TrybeEditIssue01() {
  useEffect(() => {
    const prev = document.title
    document.title = 'The Trybe Edit | Issue #1 | LensTrybe'
    return () => {
      document.title = prev
    }
  }, [])

  return (
    <div className="trybe-edit-issue-01-root">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      <style>{ISSUE_STYLES}</style>

      <div className="masthead">
        <div className="container">
          <div className="masthead-eyebrow">LensTrybe Presents</div>
          <div className="masthead-title">The Trybe <em>Edit</em></div>
          <div className="masthead-meta">
            <span>Issue #1</span>
            <span>May 2026</span>
            <span>For Creative Professionals</span>
          </div>
        </div>
      </div>

      <div className="container">

        <div className="section">
          <div className="section-label">Editor's Note</div>
          <div className="editor-note">
            <p>
              Welcome to the very first issue of <strong>The Trybe Edit</strong>, LensTrybe's monthly read for professional visual creatives who are serious about building a business, not just a following.
            </p>
            <p>
              I started LensTrybe because I saw creative professionals who were extraordinary at their craft struggling with everything around it. Finding clients. Managing projects. Getting paid. Presenting their work professionally. The tools existed, but they were scattered, generic, and built for everyone, which meant they were built for no one in particular.
            </p>
            <p>
              LensTrybe is different. It is built specifically for photographers, videographers, drone pilots, video editors, photo editors, social media managers, hair and makeup artists, and UGC creators. Every feature on the platform exists because it solves a real problem in a creative professional's working life.
            </p>
            <p>
              This first issue is your orientation. What LensTrybe actually does. How it can change the way you run your business. And, honestly, which plan is the right fit for where you are right now.
            </p>
            <p>
              We are just getting started. I cannot wait to grow this with you.
            </p>
            <div className="editor-sig">
              <strong>Michael, Founder of LensTrybe</strong>
              connect@lenstrybe.com&nbsp;·&nbsp;lenstrybe.com
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-label">Feature</div>
          <h2>What LensTrybe Can Actually Do for <em>Your</em> Creative Business</h2>

          <p>
            Most creatives spend somewhere between 30 and 50 percent of their working week on things that are not the work. Chasing invoices. Writing contracts from scratch. Sending files through links that expire. Trying to remember where they left a client's brief. Updating their website, or giving up and not updating it at all.
          </p>
          <p>
            LensTrybe was built to give that time back. Here is what that looks like in practice.
          </p>

          <div className="divider" />

          <h3>You get discovered by the right clients</h3>
          <p>
            When a client needs a photographer for a wedding in Brisbane, a UGC creator for a skincare launch, or a drone pilot for a real estate development, LensTrybe is where they come to find someone. Your profile is searchable by creative type, specialty, location, and availability. Clients do not browse Instagram hoping to stumble onto you. They search for exactly what they need, and you show up.
          </p>
          <p>
            Your subscription tier determines your placement in those results. Elite appears first, then Expert, then Pro, then Basic. Investing in your LensTrybe presence is a direct investment in how often the right clients find you.
          </p>

          <div className="pull-quote">
            <p>"Your profile is working for you at midnight, on weekends, while you are on a shoot. That is what a great platform does."</p>
          </div>

          <h3>You run your business from one place</h3>
          <p>
            Once a client finds you, everything that happens next lives inside LensTrybe. Quotes and invoices with your own bank details printed on them. No platform taking a cut. Money goes straight to you. Custom contracts you write once and reuse. A CRM that tracks every client from first enquiry to completed job. A client portal where your clients can see their contract, invoice, booking, and delivered files without needing to log in.
          </p>
          <p>
            For a lot of creatives, these tools replace a collection of separate subscriptions covering invoicing software, contract tools, and file delivery services that collectively cost more than an Expert or Elite plan on LensTrybe.
          </p>

          <h3>You deliver your work professionally</h3>
          <p>
            <strong>LensTrybe Deliver</strong> is built for the moment after the shoot, when you need to get files to a client in a way that looks professional and protects your work. Upload your photos and videos, generate a branded gallery link, and share it with your client. Password protection means you control access until the invoice is paid. Your logo and brand colours apply automatically. No generic file-sharing links. No expiry notices going out at the wrong time.
          </p>

          <h3>You build a profile that compounds over time</h3>
          <p>
            Every review from a completed booking, every credential badge, every portfolio piece stays on your profile and continues working for you. A LensTrybe profile built over 12 months tells a much more powerful story than an Instagram grid. Clients can see your credentials, your past work, your reviews, and book directly. It is the professional presence you would otherwise spend weeks building on a custom website, and it updates itself as you work.
          </p>

          <h3>You stop losing jobs to creatives who look more established</h3>
          <p>
            One of the most underestimated problems in the creative industry is the perception gap. Talented newcomers lose work to less talented but more polished competitors simply because the polished competitor has a professional invoice, a proper contract, and a branded delivery gallery. LensTrybe closes that gap from day one. Even on the free Basic plan, you have a public profile. As you grow into Pro and Expert, the tools that make you look established are right there waiting.
          </p>
        </div>

        <div className="section">
          <div className="section-label">Plan Guide</div>
          <h2>Which Plan Is Right for <em>Where You Are</em> Right Now?</h2>

          <p>
            There is no wrong answer here. Every plan is designed for a specific stage of a creative career. The key is being honest about where you are, not where you want to be. The right plan is the one that fits your actual workflow today, with room to grow into the next tier when you are ready.
          </p>

          <div className="plans-grid">

            <div className="plan-card">
              <div className="plan-header">
                <div className="plan-name">Basic</div>
                <div className="plan-badge badge-free">Free</div>
              </div>
              <div className="plan-price">Always free</div>
              <div className="plan-who">You are just starting out, or testing the waters</div>
              <p className="plan-description">
                Basic gives you a public profile, 5 portfolio photos, and the ability to receive enquiries from clients. You can browse the marketplace and the job board. It is a genuine professional presence at no cost, ideal if you are in your first year, still building your portfolio, or simply want to see how clients on LensTrybe behave before committing to a paid plan. The limitation is visibility. Basic profiles appear last in search results and your monthly replies are capped at 5. When you are getting more enquiries than that, it is time to move up.
              </p>
              <div className="plan-features">
                <span className="feature-tag">Public profile</span>
                <span className="feature-tag">5 portfolio photos</span>
                <span className="feature-tag">5 replies/month</span>
                <span className="feature-tag">Marketplace browse</span>
              </div>
            </div>

            <div className="plan-card">
              <div className="plan-header">
                <div className="plan-name">Pro</div>
                <div className="plan-badge badge-pro">$24.99/mo</div>
              </div>
              <div className="plan-price">or $249.90/year and save $49.98</div>
              <div className="plan-who">You are actively taking bookings and want to look the part</div>
              <p className="plan-description">
                Pro is for the creative who is past the wondering-if-this-will-work stage and is actively building a client base. You get 20 portfolio photos, 1 video, 20 monthly replies, booking and scheduling tools, and the ability to send quotes and invoices with your bank details. Your pink Pro badge shows clients you are a committed professional. For under $25 a month, Pro pays for itself with a single booking. This is the right starting point for most working creatives.
              </p>
              <div className="plan-features">
                <span className="feature-tag">20 photos · 1 video</span>
                <span className="feature-tag">20 replies/month</span>
                <span className="feature-tag">Quotes and invoicing</span>
                <span className="feature-tag">Booking system</span>
                <span className="feature-tag">Review requests</span>
                <span className="feature-tag">Pro badge</span>
              </div>
            </div>

            <div className="plan-card">
              <div className="plan-header">
                <div className="plan-name">Expert</div>
                <div className="plan-badge badge-expert">$74.99/mo</div>
              </div>
              <div className="plan-price">or $749.90/year and save $149.98</div>
              <div className="plan-who">You are running a real business and need real tools</div>
              <p className="plan-description">
                Expert is for the creative who thinks of themselves as a business owner first. Unlimited replies. Custom contracts. A CRM to manage your client relationships. A client portal so every project has a professional shared space. Brand kit. A portfolio website at your own lenstrybe.com subdomain. LensTrybe Deliver with 50GB storage. Business insights so you understand your numbers. Homepage rotation so new clients find you. At $74.99 a month, Expert replaces tools that would cost $200 to $400 separately, and it all works together automatically.
              </p>
              <div className="plan-features">
                <span className="feature-tag">40 photos · 5 videos</span>
                <span className="feature-tag">Unlimited replies</span>
                <span className="feature-tag">Custom contracts</span>
                <span className="feature-tag">CRM 500 clients</span>
                <span className="feature-tag">Client portal</span>
                <span className="feature-tag">Brand kit</span>
                <span className="feature-tag">Deliver 50GB</span>
                <span className="feature-tag">Portfolio website</span>
                <span className="feature-tag">Business insights</span>
                <span className="feature-tag">Homepage rotation</span>
              </div>
            </div>

            <div className="plan-card">
              <div className="plan-header">
                <div className="plan-name">Elite</div>
                <div className="plan-badge badge-elite">$149.99/mo</div>
              </div>
              <div className="plan-price">or $1,499.90/year and save $299.98</div>
              <div className="plan-who">You are running a studio, agency, or high-volume creative operation</div>
              <p className="plan-description">
                Elite is for the creative professional whose business has outgrown what one person can handle alone. Bring up to 4 team members under a single subscription. Unlimited everything including portfolio, storage, CRM records, and marketplace listings. A multi-page portfolio website with custom domain connection. Elite Spotlight placement on the LensTrybe homepage. LensTrybe Deliver with 200GB storage. A dedicated Studio Profile page that showcases your whole team. If you are running a photography or video production studio, Elite is the infrastructure your brand deserves.
              </p>
              <div className="plan-features">
                <span className="feature-tag">Unlimited portfolio</span>
                <span className="feature-tag">Team up to 5</span>
                <span className="feature-tag">Studio profile</span>
                <span className="feature-tag">Elite Spotlight</span>
                <span className="feature-tag">Deliver 200GB</span>
                <span className="feature-tag">Custom domain</span>
                <span className="feature-tag">Unlimited CRM</span>
                <span className="feature-tag">Team insights</span>
              </div>
            </div>

          </div>

          <div className="divider" />

          <p>
            <strong>One note on timing.</strong> If you sign up before May 1, 2026, you qualify as a Founding Member. Your profile goes live immediately, your first payment is deferred to the official launch date, and you receive a permanent Founding Member badge that stays on your profile regardless of any future plan changes. It is a genuine early-adopter recognition, not a marketing trick.
          </p>
        </div>

        <div className="section">
          <div className="section-label">Creative Spotlight</div>
          <h2>Coming in <em>Issue #2</em></h2>

          <div className="spotlight-teaser">
            <div className="spotlight-star">&#9733;</div>
            <h3>Every month, one creative. Their story, in their words.</h3>
            <p>
              From Issue #2 onwards, the Creative Spotlight will feature a real LensTrybe member. How they built their profile, how they landed their first bookings through the platform, and what advice they would give to a creative just starting out. Each issue, a different category, a different story. If you would like to be considered for a future spotlight, reach out to us at <a href="mailto:connect@lenstrybe.com">connect@lenstrybe.com</a>.
            </p>
          </div>
        </div>

        <div className="section">
          <div className="section-label">Platform Tip</div>
          <h2>Set Up Your Brand Kit <em>Before</em> Anything Else</h2>

          <div className="tip-box">
            <div className="tip-label">This month's tip</div>
            <h3>Your Brand Kit is the multiplier</h3>
            <p>
              Available on Expert and Elite plans, your Brand Kit covers your logo, brand colour, and font. It applies automatically to every client-facing output on the platform including invoices, quotes, contracts, your client portal, your Deliver galleries, and your portfolio website. Set it once and every document and gallery you ever produce looks like it came from a proper studio. If you are on Expert or Elite and have not set this up yet, it is the first thing to do when you log in today.
            </p>
          </div>
        </div>

        <div className="section">
          <div className="section-label">What's Coming</div>
          <h2>In Issue <em>#2</em></h2>

          <p>Next month we are going deeper on things a lot of creatives get wrong, and how getting them right changes everything.</p>

          <div className="coming-next">
            <div className="next-item">
              <div className="next-item-label">Feature</div>
              <div className="next-item-title">How to write a bio that actually converts browsers into clients</div>
            </div>
            <div className="next-item">
              <div className="next-item-label">Business</div>
              <div className="next-item-title">Pricing your creative services and what the market says you should charge</div>
            </div>
            <div className="next-item">
              <div className="next-item-label">Platform</div>
              <div className="next-item-title">Using LensTrybe Deliver as your payment protection tool</div>
            </div>
            <div className="next-item">
              <div className="next-item-label">Spotlight</div>
              <div className="next-item-title">A working creative shares how they landed their first five LensTrybe bookings</div>
            </div>
          </div>
        </div>

      </div>

      <div className="issue-footer">
        <div className="container">
          <div className="footer-logo">LENS<em>TRYBE</em></div>
          <div className="footer-tagline">Connect. Capture. Create.</div>
          <div className="footer-links">
            <a href="https://lenstrybe.com">lenstrybe.com</a>
            <a href="/the-trybe-edit">Archive</a>
            <a href="mailto:connect@lenstrybe.com">connect@lenstrybe.com</a>
            <a href="#">Unsubscribe</a>
          </div>
        </div>
      </div>
    </div>
  )
}
