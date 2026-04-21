import { useEffect, useState } from "react";

const TARGET_DATE = new Date("2026-05-01T00:00:00+10:00");

function getTimeLeft() {
  const now = new Date();
  const diff = TARGET_DATE - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export default function ComingSoon() {
  const [time, setTime] = useState(getTimeLeft());
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = () => {
    if (email) setSubmitted(true);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #12111a;
          --bg2: #1a1925;
          --green: #1DB954;
          --pink: #FF2D78;
          --white: #ffffff;
          --muted: #8b8a9a;
          --border: rgba(255,255,255,0.08);
        }

        body {
          background: var(--bg);
          color: var(--white);
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
        }

        .nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          height: 56px;
          border-bottom: 1px solid var(--border);
          background: rgba(18, 17, 26, 0.85);
          backdrop-filter: blur(12px);
        }

        .nav-logo {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 16px;
          color: var(--white);
          letter-spacing: -0.3px;
        }

        .nav-tagline {
          font-size: 12px;
          color: var(--muted);
          letter-spacing: 0.3px;
        }

        .page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 100px 24px 60px;
          text-align: center;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(29, 185, 84, 0.1);
          border: 1px solid rgba(29, 185, 84, 0.25);
          border-radius: 100px;
          padding: 6px 16px;
          font-size: 12px;
          font-weight: 500;
          color: var(--green);
          letter-spacing: 0.3px;
          margin-bottom: 40px;
        }

        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--green);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        h1 {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(42px, 7vw, 72px);
          font-weight: 700;
          line-height: 1.1;
          margin-bottom: 24px;
          letter-spacing: -0.5px;
        }

        h1 .pink { color: var(--pink); }
        h1 .white { color: var(--white); }
        h1 .green { color: var(--green); }

        .subtitle {
          font-size: 16px;
          color: var(--muted);
          max-width: 500px;
          line-height: 1.7;
          font-weight: 400;
          margin-bottom: 56px;
        }

        .countdown {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 56px;
        }

        .unit {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px 24px 16px;
          min-width: 80px;
        }

        .unit-value {
          font-family: 'Playfair Display', serif;
          font-size: clamp(36px, 5vw, 52px);
          font-weight: 700;
          color: var(--white);
          line-height: 1;
          margin-bottom: 8px;
        }

        .unit-label {
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 500;
        }

        .sep {
          font-family: 'Playfair Display', serif;
          font-size: 36px;
          color: var(--muted);
          opacity: 0.4;
          margin-bottom: 24px;
          align-self: flex-start;
          padding-top: 20px;
        }

        .form-wrap {
          width: 100%;
          max-width: 420px;
        }

        .form-label {
          font-size: 13px;
          color: var(--muted);
          margin-bottom: 12px;
          font-weight: 400;
        }

        .form-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .form-row input {
          flex: 1;
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 100px;
          outline: none;
          padding: 13px 20px;
          color: var(--white);
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-row input:focus {
          border-color: rgba(29,185,84,0.5);
        }

        .form-row input::placeholder {
          color: rgba(255,255,255,0.2);
        }

        .btn-green {
          background: var(--green);
          border: none;
          color: #000;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          padding: 13px 24px;
          border-radius: 100px;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          white-space: nowrap;
        }

        .btn-green:hover { background: #22d95e; }
        .btn-green:active { transform: scale(0.97); }

        .privacy {
          font-size: 11px;
          color: rgba(255,255,255,0.18);
          letter-spacing: 0.3px;
        }

        .success {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--green);
          font-size: 14px;
          font-weight: 500;
          padding: 14px 20px;
          border: 1px solid rgba(29,185,84,0.25);
          border-radius: 100px;
          background: rgba(29,185,84,0.08);
        }

        .footer {
          margin-top: 72px;
          font-size: 12px;
          color: rgba(255,255,255,0.2);
          letter-spacing: 0.3px;
        }

        .footer a {
          color: rgba(255,255,255,0.3);
          text-decoration: none;
          transition: color 0.2s;
        }

        .footer a:hover { color: var(--green); }

        .dot-sep {
          display: inline-block;
          margin: 0 12px;
          color: rgba(255,255,255,0.15);
        }
      `}</style>

      <nav className="nav">
        <span className="nav-logo">LensTrybe</span>
        <span className="nav-tagline">Connect. Capture. Create.</span>
      </nav>

      <div className="page">

        <div className="badge">
          <div className="badge-dot" />
          Opening May 1st, 2026 — Creatives only
        </div>

        <h1>
          <span className="pink">Connect.</span>{" "}
          <span className="white">Capture.</span>{" "}
          <span className="green">Create.</span>
        </h1>

        <p className="subtitle">
          Australia's premium marketplace for visual creatives. Photographers, videographers, drone pilots and more — no commissions, ever.
        </p>

        <div className="countdown">
          <div className="unit">
            <div className="unit-value">{String(time.days).padStart(2, "0")}</div>
            <div className="unit-label">Days</div>
          </div>
          <div className="sep">:</div>
          <div className="unit">
            <div className="unit-value">{String(time.hours).padStart(2, "0")}</div>
            <div className="unit-label">Hours</div>
          </div>
          <div className="sep">:</div>
          <div className="unit">
            <div className="unit-value">{String(time.minutes).padStart(2, "0")}</div>
            <div className="unit-label">Mins</div>
          </div>
          <div className="sep">:</div>
          <div className="unit">
            <div className="unit-value">{String(time.seconds).padStart(2, "0")}</div>
            <div className="unit-label">Secs</div>
          </div>
        </div>

        <div className="form-wrap">
          <p className="form-label">Get notified when we open</p>

          {submitted ? (
            <div className="success">
              ✓ &nbsp;You're on the list — we'll be in touch soon.
            </div>
          ) : (
            <>
              <div className="form-row">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
                <button className="btn-green" onClick={handleSubmit}>
                  Notify Me
                </button>
              </div>
              <p className="privacy">No spam. Unsubscribe anytime.</p>
            </>
          )}
        </div>

        <div className="footer">
          <a href="mailto:connect@lenstrybe.com">connect@lenstrybe.com</a>
          <span className="dot-sep">·</span>
          © 2026 LensTrybe
        </div>

      </div>
    </>
  );
}
