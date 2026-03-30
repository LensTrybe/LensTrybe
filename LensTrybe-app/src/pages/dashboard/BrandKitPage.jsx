import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";

const GOOGLE_FONTS = [
  "Inter","Poppins","Montserrat","Raleway","Playfair Display",
  "DM Sans","Space Grotesk","Oswald","Lato","Nunito","Bebas Neue","Roboto Condensed"
];

export default function BrandKitPage() {
  const [user, setUser] = useState(null);
  const [kit, setKit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState({});
  const [form, setForm] = useState({
    primary_color: "#39ff14",
    secondary_color: "#a855f7",
    accent_color: "#ffffff",
    background_color: "#0f0f0f",
    heading_font: "Inter",
    body_font: "Inter",
    logo_url: "",
    logo_dark_url: "",
    logo_icon_url: "",
    tagline: "",
    assets: [],
  });

  const logoRef = useRef(null);
  const logoDarkRef = useRef(null);
  const logoIconRef = useRef(null);
  const assetsRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchKit();
  }, [user]);

  const fetchKit = async () => {
    const { data } = await supabase
      .from("brand_kit")
      .select("*")
      .eq("creative_id", user.id)
      .single();
    if (data) {
      setKit(data);
      setForm({
        primary_color: data.primary_color || "#39ff14",
        secondary_color: data.secondary_color || "#a855f7",
        accent_color: data.accent_color || "#ffffff",
        background_color: data.background_color || "#0f0f0f",
        heading_font: data.heading_font || "Inter",
        body_font: data.body_font || "Inter",
        logo_url: data.logo_url || "",
        logo_dark_url: data.logo_dark_url || "",
        logo_icon_url: data.logo_icon_url || "",
        tagline: data.tagline || "",
        assets: data.assets || [],
      });
    }
  };

  const saveKit = async () => {
    setSaving(true);
    const payload = { ...form, creative_id: user.id, updated_at: new Date().toISOString() };
    if (kit) {
      await supabase.from("brand_kit").update(payload).eq("creative_id", user.id);
    } else {
      await supabase.from("brand_kit").insert(payload);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchKit();
    setSaving(false);
  };

  const uploadFile = async (file, field) => {
    setUploading((p) => ({ ...p, [field]: true }));
    const ext = file.name.split(".").pop();
    const path = user.id + "/" + field + "-" + Date.now() + "." + ext;
    const { error } = await supabase.storage.from("brand-kit").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("brand-kit").getPublicUrl(path);
      setForm((p) => ({ ...p, [field]: data.publicUrl }));
    }
    setUploading((p) => ({ ...p, [field]: false }));
  };

  const uploadAssets = async (files) => {
    setUploading((p) => ({ ...p, assets: true }));
    const uploaded = [];
    for (const file of files) {
      const path = user.id + "/assets/" + Date.now() + "-" + file.name;
      const { error } = await supabase.storage.from("brand-kit").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("brand-kit").getPublicUrl(path);
        uploaded.push({ name: file.name, url: data.publicUrl, type: file.type });
      }
    }
    setForm((p) => ({ ...p, assets: [...(p.assets || []), ...uploaded] }));
    setUploading((p) => ({ ...p, assets: false }));
  };

  const removeAsset = (index) => {
    setForm((p) => ({ ...p, assets: p.assets.filter((_, i) => i !== index) }));
  };

  const f = (field, val) => setForm((p) => ({ ...p, [field]: val }));

  const styles = `
    .bk-wrap { padding: 28px 32px; background: #0f0f0f; min-height: 100vh; color: #e8e8e8; font-family: 'DM Sans', system-ui, sans-serif; max-width: 900px; }
    .bk-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
    .bk-title { font-size: 22px; font-weight: 700; color: #fff; }
    .bk-subtitle { font-size: 13px; color: #555; margin-top: 4px; }
    .save-btn { background: #39ff14; color: #000; border: none; border-radius: 8px; padding: 9px 22px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .save-btn:hover { opacity: 0.85; }
    .save-btn.saved { background: #22c55e; }
    .bk-section { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 22px; margin-bottom: 20px; }
    .bk-section-title { font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .color-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
    .color-field { display: flex; flex-direction: column; gap: 6px; }
    .color-field label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
    .color-input-row { display: flex; align-items: center; gap: 8px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 6px 10px; }
    .color-swatch { width: 28px; height: 28px; border-radius: 6px; border: none; cursor: pointer; padding: 0; flex-shrink: 0; }
    .color-hex { background: none; border: none; color: #e8e8e8; font-size: 13px; font-family: monospace; outline: none; width: 90px; }
    .font-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .font-field { display: flex; flex-direction: column; gap: 6px; }
    .font-field label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
    .font-select { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 9px 12px; color: #e8e8e8; font-size: 13px; outline: none; width: 100%; cursor: pointer; }
    .font-preview { margin-top: 12px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 14px 16px; }
    .font-preview-heading { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 6px; }
    .font-preview-body { font-size: 13px; color: #aaa; line-height: 1.6; }
    .logo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .logo-slot { display: flex; flex-direction: column; gap: 8px; }
    .logo-slot label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
    .logo-upload-area { background: #1a1a1a; border: 2px dashed #2a2a2a; border-radius: 10px; height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: border-color 0.15s; position: relative; overflow: hidden; }
    .logo-upload-area:hover { border-color: #39ff14; }
    .logo-upload-area img { width: 100%; height: 100%; object-fit: contain; padding: 8px; }
    .logo-placeholder { font-size: 11px; color: #444; text-align: center; }
    .upload-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; font-size: 12px; color: #39ff14; }
    .remove-link { background: none; border: none; color: #f87171; font-size: 11px; cursor: pointer; text-align: left; padding: 0; }
    .tagline-input { width: 100%; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 10px 14px; color: #e8e8e8; font-size: 14px; outline: none; font-family: inherit; box-sizing: border-box; }
    .tagline-input:focus { border-color: #39ff14; }
    .assets-drop { background: #1a1a1a; border: 2px dashed #2a2a2a; border-radius: 10px; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; margin-bottom: 14px; }
    .assets-drop:hover { border-color: #39ff14; }
    .assets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
    .asset-item { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden; position: relative; }
    .asset-item img { width: 100%; height: 80px; object-fit: cover; display: block; }
    .asset-file { width: 100%; height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; color: #666; gap: 4px; }
    .asset-name { font-size: 10px; color: #666; padding: 4px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .asset-remove { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); border: none; color: #f87171; border-radius: 4px; width: 18px; height: 18px; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="bk-wrap">
        <div className="bk-header">
          <div>
            <div className="bk-title">Brand Kit</div>
            <div className="bk-subtitle">Your colours, fonts and logo assets in one place</div>
          </div>
          <button
            className={"save-btn" + (saved ? " saved" : "")}
            onClick={saveKit}
            disabled={saving}
          >
            {saving ? "Saving..." : saved ? "Saved!" : "Save Brand Kit"}
          </button>
        </div>

        {/* Colours */}
        <div className="bk-section">
          <div className="bk-section-title">
            <span>🎨</span> Colour Palette
          </div>
          <div className="color-grid">
            {[
              { field: "primary_color", label: "Primary" },
              { field: "secondary_color", label: "Secondary" },
              { field: "accent_color", label: "Accent" },
              { field: "background_color", label: "Background" },
            ].map(({ field, label }) => (
              <div key={field} className="color-field">
                <label>{label}</label>
                <div className="color-input-row">
                  <input
                    type="color"
                    className="color-swatch"
                    value={form[field]}
                    onChange={(e) => f(field, e.target.value)}
                  />
                  <input
                    type="text"
                    className="color-hex"
                    value={form[field]}
                    onChange={(e) => f(field, e.target.value)}
                    maxLength={7}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
            {[form.primary_color, form.secondary_color, form.accent_color, form.background_color].map((c, i) => (
              <div key={i} style={{ width: 40, height: 40, borderRadius: 8, background: c, border: "1px solid #2a2a2a" }} />
            ))}
            <span style={{ fontSize: 12, color: "#555", marginLeft: 8 }}>Live preview</span>
          </div>
        </div>

        {/* Typography */}
        <div className="bk-section">
          <div className="bk-section-title">
            <span>✏️</span> Typography
          </div>
          <div className="font-grid">
            <div className="font-field">
              <label>Heading Font</label>
              <select className="font-select" value={form.heading_font} onChange={(e) => f("heading_font", e.target.value)}>
                {GOOGLE_FONTS.map((font) => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </div>
            <div className="font-field">
              <label>Body Font</label>
              <select className="font-select" value={form.body_font} onChange={(e) => f("body_font", e.target.value)}>
                {GOOGLE_FONTS.map((font) => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="font-preview">
            <div className="font-preview-heading" style={{ fontFamily: form.heading_font }}>
              {form.heading_font} — The quick brown fox
            </div>
            <div className="font-preview-body" style={{ fontFamily: form.body_font }}>
              Body text in {form.body_font}. Crafting beautiful visual stories for every moment worth remembering.
            </div>
          </div>
        </div>

        {/* Logos */}
        <div className="bk-section">
          <div className="bk-section-title">
            <span>🖼️</span> Logos
          </div>
          <div className="logo-grid">
            {[
              { field: "logo_url", label: "Primary Logo", ref: logoRef },
              { field: "logo_dark_url", label: "Dark Version", ref: logoDarkRef },
              { field: "logo_icon_url", label: "Icon / Favicon", ref: logoIconRef },
            ].map(({ field, label, ref }) => (
              <div key={field} className="logo-slot">
                <label>{label}</label>
                <div className="logo-upload-area" onClick={() => ref.current && ref.current.click()}>
                  {form[field] ? (
                    <img src={form[field]} alt={label} />
                  ) : (
                    <div className="logo-placeholder">
                      <div style={{ fontSize: 24, marginBottom: 4 }}>⬆️</div>
                      Upload {label}
                    </div>
                  )}
                  {uploading[field] && (
                    <div className="upload-overlay">Uploading...</div>
                  )}
                </div>
                <input
                  ref={ref}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files && e.target.files[0] && uploadFile(e.target.files[0], field)}
                />
                {form[field] && (
                  <button className="remove-link" onClick={() => f(field, "")}>Remove</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tagline */}
        <div className="bk-section">
          <div className="bk-section-title">
            <span>💬</span> Brand Tagline
          </div>
          <input
            className="tagline-input"
            placeholder="e.g. Capturing moments that last a lifetime"
            value={form.tagline}
            onChange={(e) => f("tagline", e.target.value)}
          />
        </div>

        {/* Assets */}
        <div className="bk-section">
          <div className="bk-section-title">
            <span>📁</span> Brand Assets
          </div>
          <div className="assets-drop" onClick={() => assetsRef.current && assetsRef.current.click()}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>
              {uploading.assets ? "⏳" : "⬆️"}
            </div>
            <p style={{ fontSize: 12, color: "#555" }}>
              {uploading.assets ? "Uploading..." : "Upload logos, watermarks, overlays, presets..."}
            </p>
          </div>
          <input
            ref={assetsRef}
            type="file"
            multiple
            accept="image/*,.pdf,.zip"
            style={{ display: "none" }}
            onChange={(e) => e.target.files && e.target.files.length && uploadAssets(Array.from(e.target.files))}
          />
          {form.assets && form.assets.length > 0 && (
            <div className="assets-grid">
              {form.assets.map((asset, i) => (
                <div key={i} className="asset-item">
                  {asset.type && asset.type.startsWith("image/") ? (
                    <img src={asset.url} alt={asset.name} />
                  ) : (
                    <div className="asset-file">
                      <span style={{ fontSize: 24 }}>📄</span>
                      {asset.name && asset.name.split(".").pop().toUpperCase()}
                    </div>
                  )}
                  <div className="asset-name">{asset.name}</div>
                  <button className="asset-remove" onClick={() => removeAsset(i)}>x</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
