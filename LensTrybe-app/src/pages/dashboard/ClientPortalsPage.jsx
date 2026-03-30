import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ClientPortalsPage() {
  const [user, setUser] = useState(null);
  const [portals, setPortals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ client_name: "", client_email: "" });
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchPortals();
  }, [user]);

  const fetchPortals = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("client_portals")
      .select("*")
      .eq("creative_id", user.id)
      .order("created_at", { ascending: false });
    setPortals(data || []);
    setLoading(false);
  };

  const createPortal = async () => {
    if (!form.client_name.trim()) return;
    const { data, error } = await supabase
      .from("client_portals")
      .insert({ ...form, creative_id: user.id })
      .select()
      .single();
    if (!error && data) {
      setPortals((prev) => [data, ...prev]);
      setShowModal(false);
      setForm({ client_name: "", client_email: "" });
    }
  };

  const deletePortal = async (id) => {
    await supabase.from("client_portals").delete().eq("id", id);
    setPortals((prev) => prev.filter((p) => p.id !== id));
  };

  const copyLink = (token) => {
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <>
      <style>{`
        .portals-wrap { padding: 28px 32px; background: #0f0f0f; min-height: 100vh; color: #e8e8e8; font-family: 'DM Sans', system-ui, sans-serif; }
        .portals-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .portals-title { font-size: 22px; font-weight: 700; color: #fff; }
        .portals-subtitle { font-size: 13px; color: #555; margin-top: 4px; }
        .add-portal-btn { background: #39ff14; color: #000; border: none; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .add-portal-btn:hover { opacity: 0.85; }
        .portals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
        .portal-card { background: #141414; border: 1px solid #222; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .portal-card-top { display: flex; align-items: center; gap: 12px; }
        .portal-avatar { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #39ff14, #a855f7); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #000; flex-shrink: 0; }
        .portal-info { flex: 1; }
        .portal-name { font-size: 15px; font-weight: 600; color: #fff; }
        .portal-email { font-size: 12px; color: #666; margin-top: 2px; }
        .portal-link-row { display: flex; align-items: center; gap: 8px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 8px 12px; }
        .portal-link-url { flex: 1; font-size: 11px; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
        .copy-btn { background: #1e2a1e; border: 1px solid #2a4a2a; border-radius: 6px; padding: 4px 10px; font-size: 11px; color: #39ff14; cursor: pointer; white-space: nowrap; font-weight: 600; transition: all 0.15s; }
        .copy-btn:hover { background: #39ff14; color: #000; }
        .copy-btn.copied { background: #39ff14; color: #000; }
        .portal-actions { display: flex; gap: 8px; }
        .portal-view-btn { flex: 1; background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 8px; padding: 8px; font-size: 12px; color: #aaa; cursor: pointer; text-align: center; text-decoration: none; display: block; transition: all 0.15s; }
        .portal-view-btn:hover { border-color: #444; color: #fff; }
        .portal-delete-btn { background: none; border: 1px solid #2a2a2a; border-radius: 8px; padding: 8px 12px; font-size: 12px; color: #555; cursor: pointer; transition: all 0.15s; }
        .portal-delete-btn:hover { border-color: #f87171; color: #f87171; }
        .portal-date { font-size: 11px; color: #444; }
        .empty-portals { text-align: center; padding: 60px 20px; color: #444; }
        .empty-portals span { font-size: 48px; display: block; margin-bottom: 12px; }
        .empty-portals p { font-size: 14px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 28px; width: 420px; max-width: 90vw; }
        .modal h3 { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 6px; }
        .modal p { font-size: 13px; color: #666; margin: 0 0 20px; }
        .modal-field { margin-bottom: 14px; }
        .modal-field label { display: block; font-size: 11px; color: #888; margin-bottom: 6px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .modal-field input { width: 100%; background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 10px 12px; color: #e8e8e8; font-size: 13px; outline: none; box-sizing: border-box; }
        .modal-field input:focus { border-color: #39ff14; }
        .modal-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
        .modal-cancel { background: none; border: 1px solid #2a2a2a; color: #888; border-radius: 8px; padding: 9px 18px; cursor: pointer; font-size: 13px; }
        .modal-confirm { background: #39ff14; border: none; color: #000; border-radius: 8px; padding: 9px 20px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .modal-confirm:hover { opacity: 0.85; }
      `}</style>

      <div className="portals-wrap">
        <div className="portals-header">
          <div>
            <div className="portals-title">Client Portals</div>
            <div className="portals-subtitle">Share a unique link with each client to view their documents</div>
          </div>
          <button className="add-portal-btn" onClick={() => setShowModal(true)}>+ New Portal</button>
        </div>

        {loading ? (
          <div className="empty-portals"><p>Loading...</p></div>
        ) : portals.length === 0 ? (
          <div className="empty-portals">
            <span>🔗</span>
            <p>No client portals yet</p>
            <p style={{ fontSize: 12, marginTop: 6, color: "#333" }}>Create a portal to give clients a private link to view their docs</p>
          </div>
        ) : (
          <div className="portals-grid">
            {portals.map((portal) => {
              const url = `${window.location.origin}/portal/${portal.portal_token}`;
              return (
                <div key={portal.id} className="portal-card">
                  <div className="portal-card-top">
                    <div className="portal-avatar">{portal.client_name?.[0]?.toUpperCase() || "?"}</div>
                    <div className="portal-info">
                      <div className="portal-name">{portal.client_name}</div>
                      <div className="portal-email">{portal.client_email || "No email"}</div>
                    </div>
                  </div>
                  <div className="portal-link-row">
                    <span className="portal-link-url">{url}</span>
                    <button
                      className={`copy-btn ${copied === portal.portal_token ? "copied" : ""}`}
                      onClick={() => copyLink(portal.portal_token)}
                    >
                      {copied === portal.portal_token ? "✓ Copied!" : "Copy Link"}
                    </button>
                  </div>
                  <div className="portal-actions">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="portal-view-btn">
                      👁 Preview Portal
                    </a>
                    <button className="portal-delete-btn" onClick={() => deletePortal(portal.id)}>🗑</button>
                  </div>
                  <div className="portal-date">Created {new Date(portal.created_at).toLocaleDateString()}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New Client Portal</h3>
            <p>A unique link will be generated for this client</p>
            <div className="modal-field">
              <label>Client Name *</label>
              <input placeholder="Jane Smith" value={form.client_name} onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))} />
            </div>
            <div className="modal-field">
              <label>Client Email</label>
              <input placeholder="jane@example.com" value={form.client_email} onChange={(e) => setForm((p) => ({ ...p, client_email: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="modal-confirm" onClick={createPortal}>Create Portal</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}