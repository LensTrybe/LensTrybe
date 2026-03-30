import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ClientPortalPage() {
  const { token } = useParams();
  const [portal, setPortal] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("invoices");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchPortal();
  }, [token]);

  const fetchPortal = async () => {
    const { data: portalData, error } = await supabase
      .from("client_portals")
      .select("*")
      .eq("portal_token", token)
      .single();

    if (error || !portalData) { setNotFound(true); setLoading(false); return; }
    setPortal(portalData);

    const creativeId = portalData.creative_id;
    const clientEmail = portalData.client_email;

    const [prof, inv, quo, con, msg] = await Promise.all([
      supabase.from("profiles").select("business_name, avatar_url, location").eq("id", creativeId).single(),
      supabase.from("invoices").select("*").eq("creative_id", creativeId).eq("client_email", clientEmail),
      supabase.from("quotes").select("*").eq("creative_id", creativeId).eq("client_email", clientEmail),
      supabase.from("contracts").select("*").eq("creative_id", creativeId).eq("client_email", clientEmail),
      supabase.from("message_threads").select("*").eq("creative_id", creativeId).eq("client_email", clientEmail),
    ]);

    setProfile(prof.data);
    setInvoices(inv.data || []);
    setQuotes(quo.data || []);
    setContracts(con.data || []);
    setMessages(msg.data || []);
    setLoading(false);
  };

  const statusColor = (status) => {
    const map = { draft: "#666", sent: "#facc15", paid: "#39ff14", accepted: "#39ff14", signed: "#39ff14", declined: "#f87171", converted: "#a78bfa", overdue: "#f87171" };
    return map[status] || "#666";
  };

  if (loading) return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontFamily: "system-ui" }}>
      Loading your portal...
    </div>
  );

  if (notFound) return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontFamily: "system-ui", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 48 }}>🔍</span>
      <p>Portal not found</p>
    </div>
  );

  const tabs = [
    { id: "invoices", label: "Invoices", count: invoices.length },
    { id: "quotes", label: "Quotes", count: quotes.length },
    { id: "contracts", label: "Contracts", count: contracts.length },
    { id: "messages", label: "Messages", count: messages.length },
  ];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0f0f; }
        .portal-page { min-height: 100vh; background: #0f0f0f; color: #e8e8e8; font-family: 'DM Sans', system-ui, sans-serif; }
        .portal-hero { background: #141414; border-bottom: 1px solid #1e1e1e; padding: 32px; text-align: center; }
        .portal-brand { font-size: 22px; font-weight: 800; color: #39ff14; margin-bottom: 4px; }
        .portal-welcome { font-size: 15px; color: #888; }
        .portal-client { font-size: 28px; font-weight: 700; color: #fff; margin-top: 8px; }
        .portal-body { max-width: 800px; margin: 0 auto; padding: 28px 20px; }
        .portal-tabs { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
        .portal-tab { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 8px 16px; font-size: 13px; color: #888; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.15s; }
        .portal-tab.active { background: #1e2a1e; border-color: #39ff14; color: #39ff14; }
        .tab-count { background: #2a2a2a; border-radius: 10px; padding: 1px 6px; font-size: 10px; font-weight: 700; }
        .portal-tab.active .tab-count { background: #2a4a2a; color: #39ff14; }
        .doc-list { display: flex; flex-direction: column; gap: 10px; }
        .doc-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; gap: 16px; }
        .doc-icon { font-size: 24px; flex-shrink: 0; }
        .doc-info { flex: 1; }
        .doc-title { font-size: 14px; font-weight: 600; color: #fff; }
        .doc-meta { font-size: 12px; color: #666; margin-top: 3px; }
        .doc-status { font-size: 11px; font-weight: 700; border-radius: 4px; padding: 3px 8px; border: 1px solid; text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }
        .doc-action { background: #39ff14; color: #000; border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: none; white-space: nowrap; }
        .doc-action:hover { opacity: 0.85; }
        .empty-tab { text-align: center; padding: 48px 20px; color: #444; font-size: 13px; }
        .empty-tab span { font-size: 36px; display: block; margin-bottom: 10px; }
        .portal-footer { text-align: center; padding: 32px; color: #333; font-size: 12px; border-top: 1px solid #1a1a1a; margin-top: 40px; }
        .portal-footer span { color: #39ff14; font-weight: 700; }
      `}</style>

      <div className="portal-page">
        <div className="portal-hero">
          <div className="portal-brand">{profile?.business_name || "Your Creative"}</div>
          <div className="portal-welcome">Welcome to your client portal</div>
          <div className="portal-client">{portal.client_name}</div>
        </div>

        <div className="portal-body">
          <div className="portal-tabs">
            {tabs.map((t) => (
              <button key={t.id} className={`portal-tab ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>
                {t.label} <span className="tab-count">{t.count}</span>
              </button>
            ))}
          </div>

          {activeTab === "invoices" && (
            <div className="doc-list">
              {invoices.length === 0 ? (
                <div className="empty-tab"><span>💰</span>No invoices yet</div>
              ) : invoices.map((inv) => (
                <div key={inv.id} className="doc-card">
                  <span className="doc-icon">💰</span>
                  <div className="doc-info">
                    <div className="doc-title">Invoice #{inv.id.slice(0, 8).toUpperCase()}</div>
                    <div className="doc-meta">${inv.amount} · Due {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</div>
                  </div>
                  <span className="doc-status" style={{ color: statusColor(inv.status), borderColor: statusColor(inv.status) + "44" }}>{inv.status}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "quotes" && (
            <div className="doc-list">
              {quotes.length === 0 ? (
                <div className="empty-tab"><span>📋</span>No quotes yet</div>
              ) : quotes.map((q) => (
                <div key={q.id} className="doc-card">
                  <span className="doc-icon">📋</span>
                  <div className="doc-info">
                    <div className="doc-title">Quote #{q.id.slice(0, 8).toUpperCase()}</div>
                    <div className="doc-meta">${q.amount} · Valid until {q.valid_until ? new Date(q.valid_until).toLocaleDateString() : "—"}</div>
                  </div>
                  <span className="doc-status" style={{ color: statusColor(q.status), borderColor: statusColor(q.status) + "44" }}>{q.status}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "contracts" && (
            <div className="doc-list">
              {contracts.length === 0 ? (
                <div className="empty-tab"><span>📝</span>No contracts yet</div>
              ) : contracts.map((c) => (
                <div key={c.id} className="doc-card">
                  <span className="doc-icon">📝</span>
                  <div className="doc-info">
                    <div className="doc-title">{c.title || "Contract"}</div>
                    <div className="doc-meta">{c.signed_at ? `Signed ${new Date(c.signed_at).toLocaleDateString()}` : "Awaiting signature"}</div>
                  </div>
                  <span className="doc-status" style={{ color: statusColor(c.status), borderColor: statusColor(c.status) + "44" }}>{c.status}</span>
                  {c.status !== "signed" && c.signing_token && (
                    <a href={`/sign/${c.signing_token}`} className="doc-action">Sign Now</a>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "messages" && (
            <div className="doc-list">
              {messages.length === 0 ? (
                <div className="empty-tab"><span>💬</span>No messages yet</div>
              ) : messages.map((m) => (
                <div key={m.id} className="doc-card">
                  <span className="doc-icon">💬</span>
                  <div className="doc-info">
                    <div className="doc-title">{m.subject}</div>
                    <div className="doc-meta">{new Date(m.last_message_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="portal-footer">
          Powered by <span>LensTrybe</span>
        </div>
      </div>
    </>
  );
}