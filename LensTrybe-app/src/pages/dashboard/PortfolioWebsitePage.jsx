import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";

const CATEGORIES = ["Wedding", "Portrait", "Commercial", "Events", "Landscape", "Fashion", "Street", "Other"];

export default function PortfolioWebsitePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", category: "Wedding", tags: "", featured: false, image_url: "" });
  const [previewMode, setPreviewMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchItems();
    fetchProfile();
  }, [user]);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("portfolio_items")
      .select("*")
      .eq("creative_id", user.id)
      .order("sort_order", { ascending: true });
    setItems(data || []);
    setLoading(false);
  };

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("business_name, tagline, bio, location, avatar_url, website, skill_types")
      .eq("id", user.id)
      .single();
    setProfile(data);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", category: "Wedding", tags: "", featured: false, image_url: "" });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title || "",
      description: item.description || "",
      category: item.category || "Wedding",
      tags: (item.tags || []).join(", "),
      featured: item.featured || false,
      image_url: item.image_url || "",
    });
    setShowModal(true);
  };

  const uploadImage = async (file) => {
    setUploading(true);
    const path = user.id + "/" + Date.now() + "-" + file.name;
    const { error } = await supabase.storage.from("portfolio").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("portfolio").getPublicUrl(path);
      setForm((p) => ({ ...p, image_url: data.publicUrl }));
    }
    setUploading(false);
  };

  const saveItem = async () => {
    if (!form.title.trim()) return;
    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      creative_id: user.id,
      sort_order: editing ? editing.sort_order : items.length,
    };
    delete payload.tags_raw;
    if (editing) {
      const { data } = await supabase.from("portfolio_items").update(payload).eq("id", editing.id).select().single();
      setItems((prev) => prev.map((i) => i.id === editing.id ? data : i));
    } else {
      const { data } = await supabase.from("portfolio_items").insert(payload).select().single();
      setItems((prev) => [...prev, data]);
    }
    setShowModal(false);
  };

  const deleteItem = async (id) => {
    await supabase.from("portfolio_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const toggleFeatured = async (item) => {
    const val = !item.featured;
    await supabase.from("portfolio_items").update({ featured: val }).eq("id", item.id);
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, featured: val } : i));
  };

  const portfolioUrl = window.location.origin + "/portfolio/" + (user?.id || "");

  const copyLink = () => {
    navigator.clipboard.writeText(portfolioUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const featured = items.filter((i) => i.featured);
  const all = items;

  return (
    <>
      <style>{`
        .pw-wrap { padding: 28px 32px; background: #0f0f0f; min-height: 100vh; color: #e8e8e8; font-family: 'DM Sans', system-ui, sans-serif; }
        .pw-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .pw-title { font-size: 22px; font-weight: 700; color: #fff; }
        .pw-subtitle { font-size: 13px; color: #555; margin-top: 4px; }
        .pw-header-actions { display: flex; gap: 10px; align-items: center; }
        .add-btn { background: #39ff14; color: #000; border: none; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .preview-btn { background: #1e1e1e; border: 1px solid #2a2a2a; color: #aaa; border-radius: 8px; padding: 9px 18px; font-size: 13px; cursor: pointer; }
        .preview-btn:hover { border-color: #444; color: #fff; }
        .pw-link-bar { display: flex; align-items: center; gap: 10px; background: #141414; border: 1px solid #1e1e1e; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; }
        .pw-link-icon { font-size: 18px; }
        .pw-link-label { font-size: 12px; color: #555; }
        .pw-link-url { font-size: 13px; color: #aaa; font-family: monospace; flex: 1; }
        .copy-btn { background: #1e2a1e; border: 1px solid #2a4a2a; border-radius: 6px; padding: 6px 14px; font-size: 12px; color: #39ff14; cursor: pointer; font-weight: 600; white-space: nowrap; }
        .copy-btn:hover { background: #39ff14; color: #000; }
        .copy-btn.copied { background: #39ff14; color: #000; }
        .open-btn { background: none; border: 1px solid #2a2a2a; border-radius: 6px; padding: 6px 14px; font-size: 12px; color: #aaa; cursor: pointer; white-space: nowrap; text-decoration: none; display: inline-block; }
        .open-btn:hover { border-color: #444; color: #fff; }
        .pw-stats { display: flex; gap: 12px; margin-bottom: 24px; }
        .pw-stat { background: #141414; border: 1px solid #1e1e1e; border-radius: 8px; padding: 12px 18px; font-size: 12px; color: #888; }
        .pw-stat strong { font-size: 20px; color: #fff; display: block; font-weight: 800; }
        .section-label { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 12px; margin-top: 4px; }
        .portfolio-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; margin-bottom: 28px; }
        .portfolio-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; overflow: hidden; position: relative; }
        .portfolio-img { width: 100%; height: 160px; object-fit: cover; display: block; background: #1a1a1a; }
        .portfolio-img-placeholder { width: 100%; height: 160px; background: #1a1a1a; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #333; }
        .portfolio-card-body { padding: 12px 14px; }
        .portfolio-card-title { font-size: 14px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .portfolio-card-cat { font-size: 11px; color: #666; margin-top: 2px; }
        .portfolio-card-actions { display: flex; gap: 6px; margin-top: 10px; }
        .card-btn { flex: 1; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 6px; padding: 5px; font-size: 11px; color: #888; cursor: pointer; text-align: center; }
        .card-btn:hover { border-color: #444; color: #fff; }
        .card-btn.danger:hover { border-color: #f87171; color: #f87171; }
        .card-btn.featured-on { border-color: #facc15; color: #facc15; background: #2a2a1a; }
        .featured-badge { position: absolute; top: 8px; left: 8px; background: #facc15; color: #000; border-radius: 4px; padding: 2px 7px; font-size: 10px; font-weight: 800; }
        .empty-portfolio { text-align: center; padding: 60px 20px; color: #444; }
        .empty-portfolio span { font-size: 48px; display: block; margin-bottom: 12px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 28px; width: 480px; max-width: 90vw; max-height: 90vh; overflow-y: auto; }
        .modal h3 { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 20px; }
        .modal-field { margin-bottom: 14px; }
        .modal-field label { display: block; font-size: 11px; color: #888; margin-bottom: 6px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .modal-field input, .modal-field select, .modal-field textarea { width: 100%; background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 9px 12px; color: #e8e8e8; font-size: 13px; outline: none; font-family: inherit; box-sizing: border-box; }
        .modal-field input:focus, .modal-field select:focus, .modal-field textarea:focus { border-color: #39ff14; }
        .modal-field textarea { resize: vertical; min-height: 70px; }
        .modal-field select option { background: #1a1a1a; }
        .img-upload-area { background: #141414; border: 2px dashed #2a2a2a; border-radius: 10px; height: 140px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden; }
        .img-upload-area:hover { border-color: #39ff14; }
        .img-upload-area img { width: 100%; height: 100%; object-fit: cover; }
        .img-upload-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 12px; color: #39ff14; }
        .checkbox-row { display: flex; align-items: center; gap: 8px; }
        .checkbox-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: #39ff14; cursor: pointer; }
        .checkbox-row label { font-size: 13px; color: #aaa; cursor: pointer; }
        .modal-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
        .modal-cancel { background: none; border: 1px solid #2a2a2a; color: #888; border-radius: 8px; padding: 9px 18px; cursor: pointer; font-size: 13px; }
        .modal-confirm { background: #39ff14; border: none; color: #000; border-radius: 8px; padding: 9px 20px; font-size: 13px; font-weight: 700; cursor: pointer; }
      `}</style>

      <div className="pw-wrap">
        <div className="pw-header">
          <div>
            <div className="pw-title">Portfolio Website</div>
            <div className="pw-subtitle">Manage your public-facing portfolio</div>
          </div>
          <div className="pw-header-actions">
            <button className="add-btn" onClick={openNew}>+ Add Work</button>
          </div>
        </div>

        <div className="pw-link-bar">
          <span className="pw-link-icon">🔗</span>
          <div style={{ flex: 1 }}>
            <div className="pw-link-label">Your public portfolio URL</div>
            <div className="pw-link-url">{portfolioUrl}</div>
          </div>
          <button className={"copy-btn " + (copied ? "copied" : "")} onClick={copyLink}>
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" className="open-btn">Open</a>
        </div>

        {items.length > 0 && (
          <div className="pw-stats">
            <div className="pw-stat"><strong>{items.length}</strong>Total Works</div>
            <div className="pw-stat"><strong>{featured.length}</strong>Featured</div>
            <div className="pw-stat"><strong>{[...new Set(items.map((i) => i.category).filter(Boolean))].length}</strong>Categories</div>
          </div>
        )}

        {loading ? (
          <div className="empty-portfolio"><p>Loading...</p></div>
        ) : items.length === 0 ? (
          <div className="empty-portfolio">
            <span>🖼️</span>
            <p>No portfolio items yet</p>
            <p style={{ fontSize: 12, marginTop: 6, color: "#333" }}>Add your work to showcase on your public portfolio</p>
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <>
                <div className="section-label">Featured ({featured.length})</div>
                <div className="portfolio-grid">
                  {featured.map((item) => <PortfolioCard key={item.id} item={item} onEdit={openEdit} onDelete={deleteItem} onFeature={toggleFeatured} />)}
                </div>
              </>
            )}
            <div className="section-label">All Works ({all.length})</div>
            <div className="portfolio-grid">
              {all.map((item) => <PortfolioCard key={item.id} item={item} onEdit={openEdit} onDelete={deleteItem} onFeature={toggleFeatured} />)}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "Edit Work" : "Add Work"}</h3>
            <div className="modal-field">
              <label>Image</label>
              <div className="img-upload-area" onClick={() => fileRef.current && fileRef.current.click()}>
                {form.image_url ? (
                  <img src={form.image_url} alt="preview" />
                ) : (
                  <div style={{ textAlign: "center", color: "#444" }}>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>⬆️</div>
                    <div style={{ fontSize: 12 }}>Click to upload image</div>
                  </div>
                )}
                {uploading && <div className="img-upload-overlay">Uploading...</div>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => e.target.files && e.target.files[0] && uploadImage(e.target.files[0])} />
            </div>
            <div className="modal-field">
              <label>Title *</label>
              <input placeholder="Summer Wedding — Smith & Jones" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="modal-field">
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="modal-field">
              <label>Description</label>
              <textarea placeholder="A short description of this work..." value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="modal-field">
              <label>Tags (comma separated)</label>
              <input placeholder="outdoor, golden hour, candid" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} />
            </div>
            <div className="modal-field">
              <div className="checkbox-row">
                <input type="checkbox" id="featured" checked={form.featured} onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))} />
                <label htmlFor="featured">Feature this on my portfolio homepage</label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="modal-confirm" onClick={saveItem}>{editing ? "Save" : "Add Work"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PortfolioCard({ item, onEdit, onDelete, onFeature }) {
  return (
    <div className="portfolio-card">
      {item.featured && <div className="featured-badge">★ Featured</div>}
      {item.image_url ? (
        <img src={item.image_url} alt={item.title} className="portfolio-img" />
      ) : (
        <div className="portfolio-img-placeholder">🖼️</div>
      )}
      <div className="portfolio-card-body">
        <div className="portfolio-card-title">{item.title}</div>
        <div className="portfolio-card-cat">{item.category}</div>
        <div className="portfolio-card-actions">
          <button className="card-btn" onClick={() => onEdit(item)}>Edit</button>
          <button className={"card-btn " + (item.featured ? "featured-on" : "")} onClick={() => onFeature(item)}>
            {item.featured ? "★ Featured" : "Feature"}
          </button>
          <button className="card-btn danger" onClick={() => onDelete(item.id)}>Delete</button>
        </div>
      </div>
    </div>
  );
}