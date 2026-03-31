import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function PortfolioPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState({});
  const [form, setForm] = useState({
    business_name: "", tagline: "", bio: "", location: "",
    phone: "", website: "", years_experience: "",
    skill_types: "", specialties: "", avatar_url: "", cover_url: "",
  });
  const avatarRef = useRef(null);
  const coverRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      setForm({
        business_name: data.business_name || "",
        tagline: data.tagline || "",
        bio: data.bio || "",
        location: data.location || "",
        phone: data.phone || "",
        website: data.website || "",
        years_experience: data.years_experience || "",
        skill_types: (data.skill_types || []).join(", "),
        specialties: (data.specialties || []).join(", "),
        avatar_url: data.avatar_url || "",
        cover_url: data.cover_url || "",
      });
    }
    setLoading(false);
  };

  const saveProfile = async () => {
    setSaving(true);
    const payload = {
      ...form,
      skill_types: form.skill_types ? form.skill_types.split(",").map(s => s.trim()).filter(Boolean) : [],
      specialties: form.specialties ? form.specialties.split(",").map(s => s.trim()).filter(Boolean) : [],
      years_experience: form.years_experience ? parseInt(form.years_experience) : null,
    };
    await supabase.from("profiles").update(payload).eq("id", user.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  };

  const uploadImage = async (file, field) => {
    setUploading(p => ({ ...p, [field]: true }));
    const ext = file.name.split(".").pop();
    const path = user.id + "/" + field + "-" + Date.now() + "." + ext;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setForm(p => ({ ...p, [field]: data.publicUrl }));
    }
    setUploading(p => ({ ...p, [field]: false }));
  };

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }));

  if (loading) return <div style={{ padding: 40, color: "#444" }}>Loading...</div>;

  const initials = form.business_name?.[0]?.toUpperCase() || "?";

  return (
    <>
      <style>{`
        .pp-wrap { background: #0f0f0f; min-height: 100vh; color: #e8e8e8; font-family: 'DM Sans', system-ui, sans-serif; }
        .pp-header { display: flex; align-items: center; justify-content: space-between; padding: 24px 32px 20px; }
        .pp-title { font-size: 22px; font-weight: 700; color: #fff; }
        .pp-subtitle { font-size: 13px; color: #555; margin-top: 4px; }
        .save-btn { background: #39ff14; color: #000; border: none; border-radius: 8px; padding: 9px 22px; font-size: 13px; font-weight: 700; cursor: pointer; transition: opacity 0.15s; }
        .save-btn:hover { opacity: 0.85; }
        .save-btn.saved { background: #22c55e; }
        .pp-body { padding: 0 32px 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .pp-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 22px; }
        .pp-card.full { grid-column: 1 / -1; }
        .pp-card-title { font-size: 13px; font-weight: 700; color: #39ff14; margin-bottom: 18px; text-transform: uppercase; letter-spacing: 0.06em; }
        .pp-field { margin-bottom: 14px; }
        .pp-field label { display: block; font-size: 11px; color: #666; margin-bottom: 6px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .pp-field input, .pp-field textarea { width: 100%; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 9px 12px; color: #e8e8e8; font-size: 13px; outline: none; font-family: inherit; box-sizing: border-box; }
        .pp-field input:focus, .pp-field textarea:focus { border-color: #39ff14; }
        .pp-field textarea { resize: vertical; min-height: 90px; }

        /* ── Photos card ── */
        .photos-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; overflow: hidden; grid-column: 1 / -1; }
        .photos-card-header { padding: 18px 22px 14px; border-bottom: 1px solid #1e1e1e; }

        /* Cover */
        .cover-zone {
          position: relative;
          width: 100%;
          height: 220px;
          background: linear-gradient(135deg, #1a2a1a 0%, #0f1a2a 50%, #1e1a2a 100%);
          cursor: pointer;
          overflow: hidden;
        }
        .cover-zone:hover .cover-overlay { opacity: 1; }
        .cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cover-overlay {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.55);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; opacity: 0; transition: opacity 0.2s;
        }
        .cover-zone:not(.has-cover) .cover-overlay { opacity: 1; }
        .cover-overlay-icon { font-size: 28px; }
        .cover-overlay-text { font-size: 13px; color: #fff; font-weight: 600; }
        .cover-overlay-sub { font-size: 11px; color: #aaa; }
        .cover-edit-badge {
          position: absolute; top: 12px; right: 12px;
          background: rgba(0,0,0,0.7); border: 1px solid #333;
          border-radius: 6px; padding: 5px 10px;
          font-size: 12px; color: #ccc; display: flex; align-items: center; gap: 5px;
          pointer-events: none;
        }
        .cover-uploading {
          position: absolute; inset: 0; background: rgba(0,0,0,0.7);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; color: #39ff14; font-weight: 600; gap: 8px;
        }

        /* Avatar */
        .avatar-section {
          position: relative;
          padding: 0 22px 18px;
          display: flex; align-items: flex-end; gap: 16px;
          margin-top: -44px;
        }
        .avatar-zone {
          position: relative;
          width: 88px; height: 88px;
          border-radius: 50%;
          border: 4px solid #141414;
          background: linear-gradient(135deg, #39ff14, #a855f7);
          display: flex; align-items: center; justify-content: center;
          font-size: 32px; font-weight: 800; color: #000;
          cursor: pointer; overflow: hidden; flex-shrink: 0;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        .avatar-zone:hover .avatar-overlay { opacity: 1; }
        .avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .avatar-overlay {
          position: absolute; inset: 0; border-radius: 50%;
          background: rgba(0,0,0,0.6);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.2s; gap: 2px;
        }
        .avatar-overlay-icon { font-size: 18px; }
        .avatar-overlay-text { font-size: 9px; color: #fff; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .avatar-uploading {
          position: absolute; inset: 0; border-radius: 50%;
          background: rgba(0,0,0,0.75);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; color: #39ff14; font-weight: 700;
        }
        .avatar-info { padding-bottom: 6px; }
        .avatar-info-name { font-size: 18px; font-weight: 800; color: #fff; }
        .avatar-info-sub { font-size: 12px; color: #555; margin-top: 2px; }

        /* Remove links */
        .photo-actions { padding: 0 22px 18px; display: flex; gap: 12px; }
        .remove-link { background: none; border: 1px solid #2a2a2a; color: #888; border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; }
        .remove-link:hover { border-color: #f87171; color: #f87171; }

        /* Preview card */
        .preview-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; overflow: hidden; grid-column: 1 / -1; }
        .preview-cover { height: 100px; background: linear-gradient(135deg, #1a2a1a, #1e1e3a); position: relative; }
        .preview-cover img { width: 100%; height: 100%; object-fit: cover; }
        .preview-avatar { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #39ff14, #a855f7); border: 3px solid #141414; position: absolute; bottom: -20px; left: 20px; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: #000; }
        .preview-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .preview-body { padding: 28px 20px 20px; }
        .preview-name { font-size: 18px; font-weight: 800; color: #fff; }
        .preview-tagline { font-size: 13px; color: #888; margin-top: 4px; }
        .preview-bio { font-size: 13px; color: #aaa; margin-top: 10px; line-height: 1.6; }
        .preview-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .preview-tag { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 20px; padding: 3px 10px; font-size: 11px; color: #aaa; }
        .preview-meta { display: flex; gap: 16px; margin-top: 10px; font-size: 12px; color: #555; flex-wrap: wrap; }
      `}</style>

      <div className="pp-wrap">
        <div className="pp-header">
          <div>
            <div className="pp-title">Portfolio</div>
            <div className="pp-subtitle">Your public business profile</div>
          </div>
          <button className={"save-btn" + (saved ? " saved" : "")} onClick={saveProfile} disabled={saving}>
            {saving ? "Saving..." : saved ? "Saved!" : "Save Profile"}
          </button>
        </div>

        <div className="pp-body">

          {/* Live Preview */}
          <div className="preview-card">
            <div className="preview-cover">
              {form.cover_url && <img src={form.cover_url} alt="cover" />}
              <div className="preview-avatar">
                {form.avatar_url ? <img src={form.avatar_url} alt="avatar" /> : initials}
              </div>
            </div>
            <div className="preview-body">
              <div className="preview-name">{form.business_name || "Your Business Name"}</div>
              {form.tagline && <div className="preview-tagline">{form.tagline}</div>}
              {form.bio && <div className="preview-bio">{form.bio}</div>}
              <div className="preview-tags">
                {form.skill_types.split(",").filter(s => s.trim()).map((s, i) => (
                  <span key={i} className="preview-tag">{s.trim()}</span>
                ))}
              </div>
              <div className="preview-meta">
                {form.location && <span>{form.location}</span>}
                {form.years_experience && <span>{form.years_experience} yrs exp</span>}
                {form.website && <span>{form.website}</span>}
              </div>
            </div>
          </div>

          {/* Photos */}
          <div className="photos-card">
            <div className="photos-card-header">
              <div className="pp-card-title" style={{ margin: 0 }}>Photos</div>
            </div>

            {/* Cover zone */}
            <div
              className={"cover-zone" + (form.cover_url ? " has-cover" : "")}
              onClick={() => coverRef.current?.click()}
            >
              {form.cover_url && <img src={form.cover_url} alt="cover" className="cover-img" />}
              <div className="cover-overlay">
                <div className="cover-overlay-icon">+</div>
                <div className="cover-overlay-text">{form.cover_url ? "Change cover photo" : "Upload cover photo"}</div>
                <div className="cover-overlay-sub">Recommended: 1500 x 500px</div>
              </div>
              {form.cover_url && <div className="cover-edit-badge">Edit cover</div>}
              {uploading.cover_url && (
                <div className="cover-uploading">Uploading...</div>
              )}
            </div>

            {/* Avatar + name row */}
            <div className="avatar-section">
              <div className="avatar-zone" onClick={() => avatarRef.current?.click()}>
                {form.avatar_url
                  ? <img src={form.avatar_url} alt="avatar" className="avatar-img" />
                  : initials
                }
                <div className="avatar-overlay">
                  <div className="avatar-overlay-icon">+</div>
                  <div className="avatar-overlay-text">Change</div>
                </div>
                {uploading.avatar_url && (
                  <div className="avatar-uploading">...</div>
                )}
              </div>
              <div className="avatar-info">
                <div className="avatar-info-name">{form.business_name || "Your Business Name"}</div>
                <div className="avatar-info-sub">Click the photo to change it</div>
              </div>
            </div>

            {/* Remove links */}
            {(form.avatar_url || form.cover_url) && (
              <div className="photo-actions">
                {form.avatar_url && <button className="remove-link" onClick={() => f("avatar_url", "")}>Remove profile photo</button>}
                {form.cover_url && <button className="remove-link" onClick={() => f("cover_url", "")}>Remove cover photo</button>}
              </div>
            )}

            <input ref={coverRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], "cover_url")} />
            <input ref={avatarRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], "avatar_url")} />
          </div>

          {/* Business Info */}
          <div className="pp-card">
            <div className="pp-card-title">Business Info</div>
            <div className="pp-field">
              <label>Business Name</label>
              <input placeholder="Your Studio Name" value={form.business_name} onChange={e => f("business_name", e.target.value)} />
            </div>
            <div className="pp-field">
              <label>Tagline</label>
              <input placeholder="Capturing moments that last a lifetime" value={form.tagline} onChange={e => f("tagline", e.target.value)} />
            </div>
            <div className="pp-field">
              <label>Location</label>
              <input placeholder="Brisbane, QLD" value={form.location} onChange={e => f("location", e.target.value)} />
            </div>
            <div className="pp-field">
              <label>Years Experience</label>
              <input type="number" placeholder="5" value={form.years_experience} onChange={e => f("years_experience", e.target.value)} />
            </div>
          </div>

          {/* Contact */}
          <div className="pp-card">
            <div className="pp-card-title">Contact</div>
            <div className="pp-field">
              <label>Phone</label>
              <input placeholder="+61 400 000 000" value={form.phone} onChange={e => f("phone", e.target.value)} />
            </div>
            <div className="pp-field">
              <label>Website</label>
              <input placeholder="https://yourstudio.com" value={form.website} onChange={e => f("website", e.target.value)} />
            </div>
          </div>

          {/* Bio */}
          <div className="pp-card full">
            <div className="pp-card-title">Bio</div>
            <div className="pp-field">
              <textarea placeholder="Tell potential clients about yourself and your work..." value={form.bio} onChange={e => f("bio", e.target.value)} />
            </div>
          </div>

          {/* Skills */}
          <div className="pp-card full">
            <div className="pp-card-title">Skills and Specialties</div>
            <div className="pp-field">
              <label>Skill Types (comma separated)</label>
              <input placeholder="Photography, Videography, Editing" value={form.skill_types} onChange={e => f("skill_types", e.target.value)} />
            </div>
            <div className="pp-field">
              <label>Specialties (comma separated)</label>
              <input placeholder="Wedding, Portrait, Commercial" value={form.specialties} onChange={e => f("specialties", e.target.value)} />
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
