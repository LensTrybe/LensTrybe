import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

const ROLES = ["Photographer","Videographer","Editor","Assistant","Second Shooter","Studio Manager","Social Media","Other"];

export default function TeamPage() {
  const [user, setUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", role: "Assistant", status: "active" });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchMembers();
  }, [user]);

  const fetchMembers = async () => {
    setLoading(true);
    const { data } = await supabase.from("team_members").select("*").eq("creative_id", user.id).order("created_at", { ascending: false });
    setMembers(data || []);
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", email: "", role: "Assistant", status: "active" });
    setShowModal(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({ name: m.name || "", email: m.email || "", role: m.role || "Assistant", status: m.status || "active" });
    setShowModal(true);
  };

  const saveMember = async () => {
    if (!form.name.trim()) return;
    const payload = { ...form, creative_id: user.id };
    if (editing) {
      const { data } = await supabase.from("team_members").update(payload).eq("id", editing.id).select().single();
      setMembers((prev) => prev.map((m) => m.id === editing.id ? data : m));
    } else {
      const { data } = await supabase.from("team_members").insert(payload).select().single();
      setMembers((prev) => [data, ...prev]);
    }
    setShowModal(false);
  };

  const deleteMember = async (id) => {
    await supabase.from("team_members").delete().eq("id", id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const toggleStatus = async (m) => {
    const newStatus = m.status === "active" ? "inactive" : "active";
    await supabase.from("team_members").update({ status: newStatus }).eq("id", m.id);
    setMembers((prev) => prev.map((mem) => mem.id === m.id ? { ...mem, status: newStatus } : mem));
  };

  const active = members.filter((m) => m.status === "active");
  const inactive = members.filter((m) => m.status === "inactive");

  return (
    <>
      <style>{`
        .team-wrap { padding: 28px 32px; background: #0f0f0f; min-height: 100vh; color: #e8e8e8; font-family: 'DM Sans', system-ui, sans-serif; }
        .team-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .team-title { font-size: 22px; font-weight: 700; color: #fff; }
        .team-subtitle { font-size: 13px; color: #555; margin-top: 4px; }
        .add-btn { background: #39ff14; color: #000; border: none; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .team-stats { display: flex; gap: 12px; margin-bottom: 24px; }
        .team-stat { background: #141414; border: 1px solid #1e1e1e; border-radius: 8px; padding: 12px 18px; font-size: 12px; color: #888; }
        .team-stat strong { font-size: 20px; color: #fff; display: block; font-weight: 800; }
        .section-label { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 12px; margin-top: 20px; }
        .team-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
        .member-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; }
        .member-top { display: flex; align-items: center; gap: 12px; }
        .member-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #39ff14, #a855f7); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #000; flex-shrink: 0; }
        .member-avatar.inactive { background: #2a2a2a; color: #555; }
        .member-info { flex: 1; }
        .member-name { font-size: 14px; font-weight: 600; color: #fff; }
        .member-role { font-size: 12px; color: #888; margin-top: 2px; }
        .member-email { font-size: 11px; color: #555; }
        .member-status { font-size: 10px; font-weight: 700; border-radius: 4px; padding: 2px 7px; border: 1px solid; text-transform: uppercase; }
        .member-status.active { color: #39ff14; border-color: #2a4a2a; background: #1a2a1a; }
        .member-status.inactive { color: #555; border-color: #2a2a2a; background: #1a1a1a; }
        .member-actions { display: flex; gap: 6px; }
        .member-btn { flex: 1; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 7px; padding: 6px; font-size: 11px; color: #888; cursor: pointer; text-align: center; }
        .member-btn:hover { border-color: #444; color: #fff; }
        .member-btn.danger:hover { border-color: #f87171; color: #f87171; }
        .empty-team { text-align: center; padding: 60px 20px; color: #444; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 28px; width: 420px; max-width: 90vw; }
        .modal h3 { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 20px; }
        .modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .modal-field { display: flex; flex-direction: column; gap: 6px; }
        .modal-field.full { grid-column: 1 / -1; }
        .modal-field label { font-size: 11px; color: #888; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .modal-field input, .modal-field select { background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 9px 12px; color: #e8e8e8; font-size: 13px; outline: none; font-family: inherit; }
        .modal-field input:focus, .modal-field select:focus { border-color: #39ff14; }
        .modal-field select option { background: #1a1a1a; }
        .modal-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
        .modal-cancel { background: none; border: 1px solid #2a2a2a; color: #888; border-radius: 8px; padding: 9px 18px; cursor: pointer; font-size: 13px; }
        .modal-confirm { background: #39ff14; border: none; color: #000; border-radius: 8px; padding: 9px 20px; font-size: 13px; font-weight: 700; cursor: pointer; }
      `}</style>
      <div className="team-wrap">
        <div className="team-header">
          <div>
            <div className="team-title">Team</div>
            <div className="team-subtitle">Manage your crew</div>
          </div>
          <button className="add-btn" onClick={openNew}>+ Add Member</button>
        </div>
        {members.length > 0 && (
          <div className="team-stats">
            <div className="team-stat"><strong>{members.length}</strong>Total</div>
            <div className="team-stat"><strong>{active.length}</strong>Active</div>
            <div className="team-stat"><strong>{inactive.length}</strong>Inactive</div>
          </div>
        )}
        {loading ? <div className="empty-team"><p>Loading...</p></div> : members.length === 0 ? (
          <div className="empty-team">
            <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
            <p>No team members yet</p>
          </div>
        ) : (
          <>
            {active.length > 0 && (<>
              <div className="section-label">Active ({active.length})</div>
              <div className="team-grid">
                {active.map((m) => (
                  <div key={m.id} className="member-card">
                    <div className="member-top">
                      <div className="member-avatar">{m.name?.[0]?.toUpperCase() || "?"}</div>
                      <div className="member-info">
                        <div className="member-name">{m.name}</div>
                        <div className="member-role">{m.role}</div>
                        {m.email && <div className="member-email">{m.email}</div>}
                      </div>
                      <span className="member-status active">active</span>
                    </div>
                    <div className="member-actions">
                      <button className="member-btn" onClick={() => openEdit(m)}>Edit</button>
                      <button className="member-btn" onClick={() => toggleStatus(m)}>Deactivate</button>
                      <button className="member-btn danger" onClick={() => deleteMember(m.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>)}
            {inactive.length > 0 && (<>
              <div className="section-label">Inactive ({inactive.length})</div>
              <div className="team-grid">
                {inactive.map((m) => (
                  <div key={m.id} className="member-card">
                    <div className="member-top">
                      <div className="member-avatar inactive">{m.name?.[0]?.toUpperCase() || "?"}</div>
                      <div className="member-info">
                        <div className="member-name">{m.name}</div>
                        <div className="member-role">{m.role}</div>
                      </div>
                      <span className="member-status inactive">inactive</span>
                    </div>
                    <div className="member-actions">
                      <button className="member-btn" onClick={() => openEdit(m)}>Edit</button>
                      <button className="member-btn" onClick={() => toggleStatus(m)}>Activate</button>
                      <button className="member-btn danger" onClick={() => deleteMember(m.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>)}
          </>
        )}
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "Edit Member" : "Add Team Member"}</h3>
            <div className="modal-grid">
              <div className="modal-field full">
                <label>Name *</label>
                <input placeholder="Alex Johnson" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="modal-field full">
                <label>Email</label>
                <input placeholder="alex@example.com" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="modal-field">
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="modal-confirm" onClick={saveMember}>{editing ? "Save" : "Add Member"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}