import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

const STATUS_COLORS = {
  lead: { bg: "#2a2a1a", border: "#4a4a1a", text: "#facc15" },
  active: { bg: "#1a2a1a", border: "#2a4a2a", text: "#39ff14" },
  past: { bg: "#1a1a2a", border: "#2a2a4a", text: "#818cf8" },
  vip: { bg: "#2a1a2a", border: "#4a1a4a", text: "#e879f9" },
};

const STATUSES = ["lead", "active", "past", "vip"];

export default function CRMPage() {
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", company: "",
    notes: "", status: "lead", instagram: "", website: "", tags: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchContacts();
  }, [user]);

  const fetchContacts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_contacts")
      .select("*")
      .eq("creative_id", user.id)
      .order("created_at", { ascending: false });
    setContacts(data || []);
    setLoading(false);
  };

  const openNew = () => {
    setEditingContact(null);
    setForm({ name: "", email: "", phone: "", company: "", notes: "", status: "lead", instagram: "", website: "", tags: "" });
    setShowModal(true);
  };

  const openEdit = (contact) => {
    setEditingContact(contact);
    setForm({
      name: contact.name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      company: contact.company || "",
      notes: contact.notes || "",
      status: contact.status || "lead",
      instagram: contact.instagram || "",
      website: contact.website || "",
      tags: (contact.tags || []).join(", "),
    });
    setShowModal(true);
  };

  const saveContact = async () => {
    if (!form.name.trim()) return;
    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      creative_id: user.id,
    };
    if (editingContact) {
      const { data } = await supabase.from("crm_contacts").update(payload).eq("id", editingContact.id).select().single();
      setContacts((prev) => prev.map((c) => (c.id === editingContact.id ? data : c)));
      if (selectedContact?.id === editingContact.id) setSelectedContact(data);
    } else {
      const { data } = await supabase.from("crm_contacts").insert(payload).select().single();
      setContacts((prev) => [data, ...prev]);
    }
    setShowModal(false);
  };

  const deleteContact = async (id) => {
    await supabase.from("crm_contacts").delete().eq("id", id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    if (selectedContact?.id === id) setSelectedContact(null);
  };

  const updateStatus = async (id, status) => {
    await supabase.from("crm_contacts").update({ status }).eq("id", id);
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    if (selectedContact?.id === id) setSelectedContact((prev) => ({ ...prev, status }));
  };

  const filtered = contacts.filter((c) => {
    const matchSearch = c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.company?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: contacts.length,
    lead: contacts.filter((c) => c.status === "lead").length,
    active: contacts.filter((c) => c.status === "active").length,
    vip: contacts.filter((c) => c.status === "vip").length,
  };

  return (
    <>
      <style>{`
        .crm-wrap { display: flex; height: calc(100vh - 60px); background: #0f0f0f; color: #e8e8e8; font-family: 'DM Sans', system-ui, sans-serif; overflow: hidden; }
        .crm-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .crm-header { padding: 20px 24px 0; }
        .crm-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .crm-title { font-size: 22px; font-weight: 700; color: #fff; }
        .crm-add-btn { background: #39ff14; color: #000; border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .crm-add-btn:hover { opacity: 0.85; }
        .crm-stats { display: flex; gap: 12px; margin-bottom: 16px; }
        .stat-chip { background: #141414; border: 1px solid #222; border-radius: 8px; padding: 8px 16px; font-size: 12px; color: #888; }
        .stat-chip strong { color: #fff; font-size: 16px; display: block; }
        .crm-controls { display: flex; gap: 10px; margin-bottom: 16px; }
        .crm-search { flex: 1; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 8px 14px; color: #e8e8e8; font-size: 13px; outline: none; }
        .crm-search:focus { border-color: #39ff14; }
        .crm-search::placeholder { color: #444; }
        .filter-tabs { display: flex; gap: 6px; }
        .filter-tab { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 6px; padding: 6px 12px; font-size: 12px; color: #666; cursor: pointer; white-space: nowrap; }
        .filter-tab.active { border-color: #39ff14; color: #39ff14; background: #1a2a1a; }
        .crm-body { display: flex; flex: 1; overflow: hidden; }
        .contact-list { width: 340px; min-width: 340px; overflow-y: auto; border-right: 1px solid #1e1e1e; padding: 0 0 20px; }
        .contact-list::-webkit-scrollbar { width: 4px; }
        .contact-list::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
        .contact-card { padding: 14px 20px; border-bottom: 1px solid #1a1a1a; cursor: pointer; transition: background 0.1s; }
        .contact-card:hover { background: #161616; }
        .contact-card.active { background: #1a2a1a; border-left: 3px solid #39ff14; }
        .contact-card-top { display: flex; align-items: center; gap: 10px; }
        .contact-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #000; flex-shrink: 0; background: linear-gradient(135deg, #39ff14, #a855f7); }
        .contact-info { flex: 1; min-width: 0; }
        .contact-name { font-size: 14px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .contact-sub { font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
        .status-badge { font-size: 10px; font-weight: 700; border-radius: 4px; padding: 2px 7px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid; flex-shrink: 0; }
        .contact-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
        .tag-chip { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 4px; padding: 2px 7px; font-size: 10px; color: #888; }
        .empty-contacts { padding: 40px 20px; text-align: center; color: #444; font-size: 13px; }
        .contact-detail { flex: 1; overflow-y: auto; padding: 24px; }
        .contact-detail::-webkit-scrollbar { width: 4px; }
        .contact-detail::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
        .no-contact { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #333; gap: 12px; font-size: 14px; }
        .detail-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
        .detail-avatar { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #000; background: linear-gradient(135deg, #39ff14, #a855f7); flex-shrink: 0; }
        .detail-name { font-size: 20px; font-weight: 700; color: #fff; }
        .detail-company { font-size: 13px; color: #666; margin-top: 3px; }
        .detail-actions { display: flex; gap: 8px; margin-left: auto; }
        .detail-btn { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 8px; padding: 7px 14px; font-size: 12px; color: #aaa; cursor: pointer; transition: all 0.15s; }
        .detail-btn:hover { border-color: #444; color: #fff; }
        .detail-btn.danger:hover { border-color: #f87171; color: #f87171; }
        .detail-section { margin-bottom: 20px; }
        .detail-section-title { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 10px; }
        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .detail-field { background: #141414; border: 1px solid #1e1e1e; border-radius: 8px; padding: 10px 14px; }
        .detail-field-label { font-size: 11px; color: #555; margin-bottom: 4px; }
        .detail-field-value { font-size: 13px; color: #e8e8e8; word-break: break-all; }
        .detail-field-value a { color: #39ff14; text-decoration: none; }
        .detail-field-value a:hover { text-decoration: underline; }
        .status-select { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 8px 12px; color: #e8e8e8; font-size: 13px; outline: none; width: 100%; cursor: pointer; }
        .notes-box { background: #141414; border: 1px solid #1e1e1e; border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #e8e8e8; min-height: 80px; white-space: pre-wrap; line-height: 1.6; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 28px; width: 480px; max-width: 90vw; max-height: 90vh; overflow-y: auto; }
        .modal h3 { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 20px; }
        .modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .modal-field { display: flex; flex-direction: column; gap: 6px; }
        .modal-field.full { grid-column: 1 / -1; }
        .modal-field label { font-size: 11px; color: #888; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .modal-field input, .modal-field select, .modal-field textarea { background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 9px 12px; color: #e8e8e8; font-size: 13px; outline: none; font-family: inherit; }
        .modal-field input:focus, .modal-field select:focus, .modal-field textarea:focus { border-color: #39ff14; }
        .modal-field textarea { resize: vertical; min-height: 80px; }
        .modal-field select option { background: #1a1a1a; }
        .modal-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
        .modal-cancel { background: none; border: 1px solid #2a2a2a; color: #888; border-radius: 8px; padding: 9px 18px; cursor: pointer; font-size: 13px; }
        .modal-confirm { background: #39ff14; border: none; color: #000; border-radius: 8px; padding: 9px 20px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .modal-confirm:hover { opacity: 0.85; }
      `}</style>

      <div className="crm-wrap">
        <div className="crm-main">
          <div className="crm-header">
            <div className="crm-title-row">
              <span className="crm-title">CRM</span>
              <button className="crm-add-btn" onClick={openNew}>+ Add Contact</button>
            </div>
            <div className="crm-stats">
              {[
                { label: "Total", value: stats.total },
                { label: "Leads", value: stats.lead },
                { label: "Active", value: stats.active },
                { label: "VIP", value: stats.vip },
              ].map((s) => (
                <div key={s.label} className="stat-chip">
                  <strong>{s.value}</strong>{s.label}
                </div>
              ))}
            </div>
            <div className="crm-controls">
              <input className="crm-search" placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="filter-tabs">
                {["all", ...STATUSES].map((s) => (
                  <button key={s} className={`filter-tab ${filterStatus === s ? "active" : ""}`} onClick={() => setFilterStatus(s)}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="crm-body">
            <div className="contact-list">
              {loading ? (
                <div className="empty-contacts">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="empty-contacts">
                  <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                  <p>No contacts yet</p>
                  <p style={{ fontSize: 11, marginTop: 4 }}>Click + Add Contact to get started</p>
                </div>
              ) : (
                filtered.map((c) => {
                  const sc = STATUS_COLORS[c.status] || STATUS_COLORS.lead;
                  return (
                    <div key={c.id} className={`contact-card ${selectedContact?.id === c.id ? "active" : ""}`} onClick={() => setSelectedContact(c)}>
                      <div className="contact-card-top">
                        <div className="contact-avatar">{c.name?.[0]?.toUpperCase() || "?"}</div>
                        <div className="contact-info">
                          <div className="contact-name">{c.name}</div>
                          <div className="contact-sub">{c.company || c.email}</div>
                        </div>
                        <span className="status-badge" style={{ background: sc.bg, borderColor: sc.border, color: sc.text }}>
                          {c.status}
                        </span>
                      </div>
                      {c.tags?.length > 0 && (
                        <div className="contact-tags">
                          {c.tags.map((t, i) => <span key={i} className="tag-chip">{t}</span>)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="contact-detail">
              {!selectedContact ? (
                <div className="no-contact">
                  <span style={{ fontSize: 48 }}>👤</span>
                  <p style={{ color: "#444" }}>Select a contact to view details</p>
                </div>
              ) : (
                <>
                  <div className="detail-header">
                    <div className="detail-avatar">{selectedContact.name?.[0]?.toUpperCase() || "?"}</div>
                    <div>
                      <div className="detail-name">{selectedContact.name}</div>
                      <div className="detail-company">{selectedContact.company || "No company"}</div>
                    </div>
                    <div className="detail-actions">
                      <button className="detail-btn" onClick={() => openEdit(selectedContact)}>✏️ Edit</button>
                      <button className="detail-btn danger" onClick={() => deleteContact(selectedContact.id)}>🗑 Delete</button>
                    </div>
                  </div>

                  <div className="detail-section">
                    <div className="detail-section-title">Status</div>
                    <select
                      className="status-select"
                      value={selectedContact.status}
                      onChange={(e) => updateStatus(selectedContact.id, e.target.value)}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>

                  <div className="detail-section">
                    <div className="detail-section-title">Contact Info</div>
                    <div className="detail-grid">
                      {[
                        { label: "Email", value: selectedContact.email, href: `mailto:${selectedContact.email}` },
                        { label: "Phone", value: selectedContact.phone, href: `tel:${selectedContact.phone}` },
                        { label: "Instagram", value: selectedContact.instagram, href: selectedContact.instagram ? `https://instagram.com/${selectedContact.instagram.replace("@", "")}` : null },
                        { label: "Website", value: selectedContact.website, href: selectedContact.website },
                      ].map((f) => (
                        <div key={f.label} className="detail-field">
                          <div className="detail-field-label">{f.label}</div>
                          <div className="detail-field-value">
                            {f.value ? (f.href ? <a href={f.href} target="_blank" rel="noopener noreferrer">{f.value}</a> : f.value) : <span style={{ color: "#444" }}>—</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedContact.tags?.length > 0 && (
                    <div className="detail-section">
                      <div className="detail-section-title">Tags</div>
                      <div className="contact-tags">
                        {selectedContact.tags.map((t, i) => <span key={i} className="tag-chip">{t}</span>)}
                      </div>
                    </div>
                  )}

                  {selectedContact.notes && (
                    <div className="detail-section">
                      <div className="detail-section-title">Notes</div>
                      <div className="notes-box">{selectedContact.notes}</div>
                    </div>
                  )}

                  <div className="detail-section">
                    <div className="detail-section-title">Finance</div>
                    <div className="detail-grid">
                      <div className="detail-field">
                        <div className="detail-field-label">Total Spent</div>
                        <div className="detail-field-value" style={{ color: "#39ff14", fontWeight: 700 }}>
                          ${selectedContact.total_spent || "0"}
                        </div>
                      </div>
                      <div className="detail-field">
                        <div className="detail-field-label">Last Contacted</div>
                        <div className="detail-field-value">
                          {selectedContact.last_contacted_at ? new Date(selectedContact.last_contacted_at).toLocaleDateString() : <span style={{ color: "#444" }}>—</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingContact ? "Edit Contact" : "New Contact"}</h3>
            <div className="modal-grid">
              <div className="modal-field">
                <label>Name *</label>
                <input placeholder="Jane Smith" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="modal-field">
                <label>Company</label>
                <input placeholder="Acme Co." value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} />
              </div>
              <div className="modal-field">
                <label>Email</label>
                <input placeholder="jane@example.com" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="modal-field">
                <label>Phone</label>
                <input placeholder="+61 400 000 000" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="modal-field">
                <label>Instagram</label>
                <input placeholder="@username" value={form.instagram} onChange={(e) => setForm((p) => ({ ...p, instagram: e.target.value }))} />
              </div>
              <div className="modal-field">
                <label>Website</label>
                <input placeholder="https://..." value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} />
              </div>
              <div className="modal-field">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label>Tags (comma separated)</label>
                <input placeholder="wedding, portrait" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} />
              </div>
              <div className="modal-field full">
                <label>Notes</label>
                <textarea placeholder="Any notes about this contact..." value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="modal-confirm" onClick={saveContact}>{editingContact ? "Save Changes" : "Add Contact"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}