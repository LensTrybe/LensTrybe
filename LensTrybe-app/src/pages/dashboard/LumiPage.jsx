import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";

const BRAND = {
  bg: "#0a0a0f",
  card: "#13131a",
  inner: "#1a1a24",
  border: "#1e1e1e",
  border2: "#202027",
  green: "#1DB954",
  pink: "#FF2D78",
  muted: "#8b8a9a",
  text: "rgb(242,242,242)",
};

const TIER_LIMITS = {
  basic:  { monthly: 0,   daily: 0 },
  pro:    { monthly: 5,   daily: 3 },
  expert: { monthly: 100, daily: 25 },
  elite:  { monthly: -1,  daily: 50 },
};

const QUICK_PROMPTS = [
  { label: "Price a job", text: "Help me price a job. I'm a photographer based in Brisbane and a client wants a 4-hour corporate headshot session for 10 staff members. What should I charge?" },
  { label: "Improve a quote", text: "Rewrite this quote description to sound more professional and compelling: '2 hour photo shoot, editing included, 20 final images delivered'" },
  { label: "Write a contract clause", text: "Write a contract clause for usage rights on commercial photography. The client is a small business and wants to use the images on their website and social media for 2 years." },
  { label: "Follow up a lead", text: "Write a polite but confident follow-up message to a client who has not responded to my quote in 5 days." },
  { label: "Write my bio", text: "Write a professional bio for my LensTrybe profile. I am a Sydney-based wedding and portrait photographer with 6 years experience. I shoot with a natural, candid style and love telling real stories." },
  { label: "Handle scope creep", text: "A client is asking for extra edited images beyond what was included in the contract. How should I handle this professionally and turn it into a paid add-on?" },
  { label: "Overdue invoice", text: "Write a firm but polite message to a client whose invoice is now 14 days overdue." },
  { label: "Package my services", text: "Help me create three photography packages (basic, standard, premium) for a wedding photographer. Include what to bundle in each and suggested price points for the Australian market." },
];

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "4px 2px" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: BRAND.green,
            animation: `lumiDot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function LumiBubble({ text }) {
  const parts = text.split("\n");
  return (
    <div style={{ fontSize: 14, lineHeight: 1.7, color: BRAND.text }}>
      {parts.map((line, i) => {
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              <span style={{ color: BRAND.green, flexShrink: 0, marginTop: 1 }}>+</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return <div key={i} style={{ fontWeight: 700, color: "#fff", marginBottom: 4, marginTop: i > 0 ? 8 : 0 }}>{line.slice(2, -2)}</div>;
        }
        if (line === "") return <div key={i} style={{ height: 8 }} />;
        const boldReplaced = line.replace(/\*\*(.*?)\*\*/g, (_, m) => `<strong>${m}</strong>`);
        return <div key={i} style={{ marginBottom: 2 }} dangerouslySetInnerHTML={{ __html: boldReplaced }} />;
      })}
    </div>
  );
}

export default function LumiPage() {
  const [user, setUser] = useState(null);
  const [tier, setTier] = useState("basic");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usageMonthly, setUsageMonthly] = useState(0);
  const [usageDaily, setUsageDaily] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `@keyframes lumiDot { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }`;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { setPageLoading(false); return; }
      setUser(u);
      const { data: profile } = await supabase.from("profiles").select("subscription_tier").eq("id", u.id).single();
      const t = (profile?.subscription_tier || "basic").toLowerCase();
      setTier(t);
      const today = new Date().toISOString().split("T")[0];
      const thisMonth = today.substring(0, 7) + "-01";
      const { data: usage } = await supabase.from("lumi_usage").select("*").eq("user_id", u.id).single();
      if (usage) {
        setUsageMonthly(usage.month_reset_at === thisMonth ? usage.monthly_count : 0);
        setUsageDaily(usage.day_reset_at === today ? usage.daily_count : 0);
      }
      setPageLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!pageLoading && tier !== "basic" && messages.length === 0) {
      const firstName = user?.user_metadata?.first_name || user?.email?.split("@")[0] || "";
      const greeting = firstName ? `Hey ${firstName}.` : "Hey there.";
      setMessages([{
        role: "lumi",
        text: `${greeting} I'm Lumi, your LensTrybe AI assistant.\n\nI can help you write better quotes and contracts, price your jobs, handle tricky client situations, write your bio, and a whole lot more.\n\nWhat do you need today?`,
      }]);
    }
  }, [pageLoading, tier]);

  const limits = TIER_LIMITS[tier] || TIER_LIMITS.basic;
  const monthlyRemaining = limits.monthly === -1 ? Infinity : limits.monthly - usageMonthly;
  const dailyRemaining = limits.daily - usageDaily;
  const isUnlimited = limits.monthly === -1;
  const isAtMonthlyLimit = !isUnlimited && monthlyRemaining <= 0;
  const isAtDailyLimit = dailyRemaining <= 0;
  const isBlocked = tier === "basic" || isAtMonthlyLimit || isAtDailyLimit;

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || loading || isBlocked) return;
    setInput("");
    const history = messages
      .filter((m) => m.role !== "lumi" || messages.indexOf(m) > 0)
      .map((m) => ({ role: m.role === "lumi" ? "assistant" : "user", content: m.text }))
      .slice(-10);
    setMessages((prev) => [...prev, { role: "user", text: msg }, { role: "typing" }]);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`https://lqafxisymvrazipaozfk.supabase.co/functions/v1/lumi-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: msg, history }),
      });
      const data = await res.json();
      setMessages((prev) => prev.filter((m) => m.role !== "typing").concat([{ role: "lumi", text: data.reply || data.message || "Something went wrong. Please try again." }]));
      if (data.remaining_monthly !== undefined && data.remaining_monthly !== -1) {
        setUsageMonthly(limits.monthly - data.remaining_monthly);
      }
      if (data.remaining_daily !== undefined) {
        setUsageDaily(limits.daily - data.remaining_daily);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.role !== "typing").concat([{ role: "lumi", text: "Something went wrong connecting to Lumi. Please try again in a moment." }]));
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  if (pageLoading) {
    return (
      <div style={{ background: BRAND.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
        <div style={{ color: BRAND.muted, fontSize: 14 }}>Loading Lumi...</div>
      </div>
    );
  }

  if (tier === "basic") {
    return (
      <div style={{ background: BRAND.bg, minHeight: "100vh", fontFamily: "Inter, sans-serif", padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #FF2D78, #1DB954)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 24 }}>✦</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", marginBottom: 12 }}>Meet Lumi</div>
        <div style={{ fontSize: 15, color: BRAND.muted, lineHeight: 1.7, maxWidth: 420, marginBottom: 32 }}>
          Your AI creative business assistant. Lumi helps you write better quotes, price jobs, draft contracts, handle tricky clients, and run a more profitable creative business. Available on Pro and above.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32, width: "100%", maxWidth: 380 }}>
          {["Write and improve quotes and invoices", "Help you price any job", "Draft contract clauses", "Handle difficult client situations", "Write your profile bio"].map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 10, padding: "10px 16px" }}>
              <span style={{ color: BRAND.green, fontSize: 14 }}>+</span>
              <span style={{ color: BRAND.text, fontSize: 14 }}>{f}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => window.location.href = "/pricing"}
          style={{ background: BRAND.pink, color: "#fff", border: "none", borderRadius: 12, padding: "14px 36px", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
        >
          Upgrade to unlock Lumi
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: BRAND.bg, minHeight: "100vh", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", maxWidth: 900, margin: "0 auto", padding: "0 0 80px" }}>
      <div style={{ padding: "28px 24px 0", display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${BRAND.border}`, paddingBottom: 20 }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg, #FF2D78, #1DB954)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>✦</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>Lumi</div>
          <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>Your LensTrybe AI assistant</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {isUnlimited ? (
            <div style={{ fontSize: 12, color: BRAND.green, background: "rgba(29,185,84,0.1)", border: "1px solid rgba(29,185,84,0.25)", borderRadius: 999, padding: "4px 12px", fontWeight: 700 }}>Unlimited</div>
          ) : (
            <div style={{ fontSize: 12, color: BRAND.muted }}>
              {Math.max(0, monthlyRemaining)} message{monthlyRemaining !== 1 ? "s" : ""} left this month
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 0", display: "flex", flexDirection: "column", gap: 20, minHeight: 400 }}>
        {messages.map((msg, i) => {
          if (msg.role === "typing") {
            return (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #FF2D78, #1DB954)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>✦</div>
                <div style={{ background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: "4px 14px 14px 14px", padding: "12px 16px" }}>
                  <TypingDots />
                </div>
              </div>
            );
          }
          if (msg.role === "lumi") {
            return (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #FF2D78, #1DB954)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, marginTop: 2 }}>✦</div>
                <div style={{ background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: "4px 14px 14px 14px", padding: "14px 18px", maxWidth: "82%", flex: 1 }}>
                  <LumiBubble text={msg.text} />
                </div>
              </div>
            );
          }
          return (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: "row-reverse" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: BRAND.inner, border: `1px solid ${BRAND.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: BRAND.muted, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>ME</div>
              <div style={{ background: BRAND.green, borderRadius: "14px 4px 14px 14px", padding: "12px 16px", maxWidth: "78%", fontSize: 14, fontWeight: 500, color: "#000", lineHeight: 1.6 }}>{msg.text}</div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 1 && !isBlocked && (
        <div style={{ padding: "20px 24px 0" }}>
          <div style={{ fontSize: 11, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 10 }}>Quick start</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.label}
                onClick={() => send(qp.text)}
                style={{ background: BRAND.card, border: `1px solid ${BRAND.border}`, color: BRAND.muted, fontSize: 12, padding: "7px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.target.style.borderColor = BRAND.green; e.target.style.color = BRAND.green; }}
                onMouseLeave={(e) => { e.target.style.borderColor = BRAND.border; e.target.style.color = BRAND.muted; }}
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(isAtMonthlyLimit || isAtDailyLimit) && (
        <div style={{ margin: "16px 24px 0", background: "rgba(255,45,120,0.08)", border: "1px solid rgba(255,45,120,0.2)", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, fontSize: 13, color: BRAND.pink }}>
            {isAtDailyLimit && !isAtMonthlyLimit
              ? "You have reached your daily Lumi limit. Come back tomorrow or upgrade your plan."
              : "You have used all your Lumi messages for this month. Upgrade to keep going."}
          </div>
          <button
            onClick={() => window.location.href = "/pricing"}
            style={{ background: BRAND.pink, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}
          >
            Upgrade plan
          </button>
        </div>
      )}

      <div style={{ padding: "16px 24px 0", display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
          onKeyDown={handleKey}
          disabled={isBlocked || loading}
          placeholder={isBlocked ? "Upgrade your plan to keep chatting with Lumi..." : "Ask Lumi anything about your creative business..."}
          rows={1}
          style={{
            flex: 1,
            background: isBlocked ? "#0f0f18" : BRAND.inner,
            border: `1px solid ${BRAND.border2}`,
            borderRadius: 14,
            padding: "12px 16px",
            color: BRAND.text,
            fontSize: 14,
            fontFamily: "Inter, sans-serif",
            resize: "none",
            outline: "none",
            lineHeight: 1.5,
            minHeight: 46,
            maxHeight: 120,
            opacity: isBlocked ? 0.5 : 1,
          }}
        />
        <button
          onClick={() => send()}
          disabled={isBlocked || loading || !input.trim()}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: isBlocked || !input.trim() ? BRAND.inner : BRAND.green,
            border: `1px solid ${isBlocked || !input.trim() ? BRAND.border : BRAND.green}`,
            cursor: isBlocked || loading || !input.trim() ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            opacity: isBlocked || !input.trim() ? 0.4 : 1,
            transition: "all 0.15s",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isBlocked || !input.trim() ? BRAND.muted : "#000"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {!isUnlimited && !isBlocked && (
        <div style={{ padding: "10px 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 3, background: BRAND.border, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, background: monthlyRemaining <= 2 ? BRAND.pink : BRAND.green, width: `${Math.max(0, (monthlyRemaining / limits.monthly) * 100)}%`, transition: "width 0.3s" }} />
          </div>
          <div style={{ fontSize: 11, color: BRAND.muted, whiteSpace: "nowrap" }}>
            {Math.max(0, monthlyRemaining)} / {limits.monthly} this month
          </div>
        </div>
      )}
    </div>
  );
}
