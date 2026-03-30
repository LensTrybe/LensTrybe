import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";

const formatSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

const formatDate = (ts) => {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

export default function DeliverPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    title: "",
    message: "",
    notify: true,
  });
  const [copied, setCopied] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchDeliveries();
    fetchProfile();
  }, [user]);

  const fetchDeliveries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("deliveries")
      .select("*")
      .eq("creative_id", user.id)
      .order("created_at", { ascending: false });
    setDeliveries(data || []);
    setLoading(false);
  };

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("business_name, business_email")
      .eq("id", user.id)
      .single();
    setProfile(data);
  };

  const handleFiles = (selectedFiles) => {
    const arr = Array.from(selectedFiles).map((f) => ({
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    setFiles((prev) => [...prev, ...arr]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const createDelivery = async () => {
    if (!form.client_name || !form.title) return;
    setSending(true);

    // Upload files
    setUploading(true);
    const uploadedFiles = [];
    for (const f of files) {
      const path = user.id + "/" + Date.now() + "-" + f.name;
      const { error } = await supabase.storage.from("deliveries").upload(path, f.file);
      if (!error) {
        const { data: urlData } = supabase.storage.from("deliveries").getPublicUrl(path);
        uploadedFiles.push({ name: f.name, url: urlData.publicUrl, size: f.size, type: f.type });
      }
    }
    setUploading(false);

    // Create delivery record
    const { data: delivery, error } = await supabase
      .from("deliveries")
      .insert({
        creative_id: user.id,
        client_name: form.client_name,
        client_email: form.client_email,
        title: form.title,
        message: form.message,
        files: uploadedFiles,
      })
      .select()
      .single();

    if (!error && delivery) {
      // Send email if requested
      if (form.notify && form.client_email) {
        const downloadUrl = window.location.origin + "/deliver/" + delivery.download_token;
        await supabase.functions.invoke("send-delivery", {
          body: {
            client_name: form.client_name,
            client_email: form.client_email,
            title: form.title,
            message: form.message,
            download_url: downloadUrl,
            business_name: profile?.business_name || "Your Creative",
          },
        });
      }

      setDeliveries((prev) => [delivery, ...prev]);
      setShowModal(false);
      setForm({ client_name: "", client_email: "", title: "", message: "", notify: true });
      setFiles([]);
    }

    setSending(false);
  };

  const copyLink = (token) => {
    const url = window.location.origin + "/deliver/" + token;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const deleteDelivery = async (id) => {
    await supabase.from("deliveries").delete().eq("id", id);
    setDeliveries((prev) => prev.filter((d) => d.id !== id));
  };

  const fileIcon = (type) => {
    if (!type) return "📎";
    if (type.startsWith("image/")) return "🖼️";
    if (type.startsWith("video/")) return "🎬";
    if (type === "application/pdf") return "📄";
    if (type.includes("zip") || type.includes("rar")) return "🗜️";
    return "📎";
  };

  const styles = `
    .deliver-wrap { padding: 28px 32px; background: #0f0f0f; min-height: 100vh; color: #e8e8e8; font-family: 'DM Sans', system-ui, sans-serif; }
    .deliver-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .deliver-title { font-size: 22px; font-weight: 700; color: #fff; }
    .deliver-subtitle { font-size: 13px; color: #555; margin-top: 4px; }
    .new-btn { background: #39ff14; color: #000; border: none; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .new-btn:hover { opacity: 0.85; }
    .deliveries-grid { display: flex; flex-direction: column; gap: 12px; }
    .delivery-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 18px 20px; }
    .delivery-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .delivery-icon { width: 42px; height: 42px; background: #1e2a1e; border: 1px solid #2a4a2a; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .delivery-info { flex: 1; }
    .delivery-title-text { font-size: 15px; font-weight: 600; color: #fff; }
    .delivery-client { font-size: 12px; color: #666; margin-top: 2px; }
    .delivery-status { display: flex; align-items: center; gap: 6px; }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; }
    .status-dot.downloaded { background: #39ff14; }
    .status-dot.pending { background: #facc15; }
    .status-text { font-size: 11px; color: #666; }
    .delivery-files { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .file-chip { display: inline-flex; align-items: center; gap: 5px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 6px; padding: 4px 8px; font-size: 11px; color: #aaa; }
    .delivery-actions { display: flex; gap: 8px; align-items: center; }
    .delivery-link-row { display: flex; flex: 1; align-items: center; gap: 8px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 6px 10px; }
    .delivery-url { flex: 1; font-size: 11px; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
    .copy-btn { background: #1e2a1e; border: 1px solid #2a4a2a; border-radius: 6px; padding: 4px 10px; font-size: 11px; color: #39ff14; cursor: pointer; white-space: nowrap; font-weight: 600; }
    .copy-btn:hover { background: #39ff14; color: #000; }
    .copy-btn.copied { background: #39ff14; color: #000; }
    .del-btn { background: none; border: 1px solid #2a2a2a; border-radius: 8px; padding: 6px 10px; font-size: 12px; color: #555; cursor: pointer; }
    .del-btn:hover { border-color: #f87171; color: #f87171; }
    .delivery-date { font-size: 11px; color: #444; margin-top: 8px; }
    .empty-deliver { text-align: center; padding: 60px 20px; color: #444; }
    .empty-deliver span { font-size: 48px; display: block; margin-bottom: 12px; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .modal { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 28px; width: 520px; max-width: 90vw; max-height: 90vh; overflow-y: auto; }
    .modal h3 { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 20px; }
    .modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .modal-field { display: flex; flex-direction: column; gap: 6px; }
    .modal-field.full { grid-column: 1 / -1; }
    .modal-field label { font-size: 11px; color: #888; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
    .modal-field input, .modal-field textarea { background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 9px 12px; color: #e8e8e8; font-size: 13px; outline: none; font-family: inherit; }
    .modal-field input:focus, .modal-field textarea:focus { border-color: #39ff14; }
    .modal-field textarea { resize: vertical; min-height: 70px; }
    .file-drop { background: #141414; border: 2px dashed #2a2a2a; border-radius: 10px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; margin-bottom: 10px; }
    .file-drop:hover { border-color: #39ff14; }
    .file-drop p { font-size: 12px; color: #555; margin-top: 6px; }
    .selected-files { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .selected-file { display: flex; align-items: center; gap: 8px; background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 7px 10px; }
    .selected-file-info { flex: 1; font-size: 12px; color: #aaa; }
    .selected-file-size { font-size: 11px; color: #555; }
    .remove-file { background: none; border: none; color: #555; cursor: pointer; font-size: 14px; }
    .remove-file:hover { color: #f87171; }
    .notify-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; }
    .notify-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: #39ff14; cursor: pointer; }
    .notify-row label { font-size: 13px; color: #aaa; cursor: pointer; }
    .modal-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
    .modal-cancel { background: none; border: 1px solid #2a2a2a; color: #888; border-radius: 8px; padding: 9px 18px; cursor: pointer; font-size: 13px; }
    .modal-confirm { background: #39ff14; border: none; color: #000; border-radius: 8px; padding: 9px 20px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .modal-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="deliver-wrap">
        <div className="deliver-header">
          <div>
            <div className="deliver-title">Deliver</div>
            <div className="deliver-subtitle">Send files to clients with a secure download link</div>
          </div>
          <button className="new-btn" onClick={() => setShowModal(true)}>+ New Delivery</button>
        </div>

        {loading ? (
          <div className="empty-deliver"><p>Loading...</p></div>
        ) : deliveries.length === 0 ? (
          <div className="empty-deliver">
            <span>📦</span>
            <p>No deliveries yet</p>
            <p style={{ fontSize: 12, marginTop: 6, color: "#333" }}>Click + New Delivery to send files to a client</p>
          </div>
        ) : (
          <div className="deliveries-grid">
            {deliveries.map((d) => {
              const url = window.location.origin + "/deliver/" + d.download_token;
              return (
                <div key={d.id} className="delivery-card">
                  <div className="delivery-card-top">
                    <div className="delivery-icon">📦</div>
                    <div className="delivery-info">
                      <div className="delivery-title-text">{d.title}</div>
                      <div className="delivery-client">{d.client_name} {d.client_email ? "· " + d.client_email : ""}</div>
                    </div>
                    <div className="delivery-status">
                      <div className={"status-dot " + (d.downloaded_at ? "downloaded" : "pending")} />
                      <span className="status-text">{d.downloaded_at ? "Downloaded" : "Pending"}</span>
                    </div>
                  </div>

                  {d.files && d.files.length > 0 && (
                    <div className="delivery-files">
                      {d.files.map((f, i) => (
                        <span key={i} className="file-chip">
                          {fileIcon(f.type)} {f.name} {f.size ? "(" + formatSize(f.size) + ")" : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="delivery-actions">
                    <div className="delivery-link-row">
                      <span className="delivery-url">{url}</span>
                      <button
                        className={"copy-btn " + (copied === d.download_token ? "copied" : "")}
                        onClick={() => copyLink(d.download_token)}
                      >
                        {copied === d.download_token ? "Copied!" : "Copy Link"}
                      </button>
                    </div>
                    <button className="del-btn" onClick={() => deleteDelivery(d.id)}>🗑</button>
                  </div>
                  <div className="delivery-date">Sent {formatDate(d.created_at)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New Delivery</h3>
            <div className="modal-grid">
              <div className="modal-field">
                <label>Client Name *</label>
                <input
                  placeholder="Jane Smith"
                  value={form.client_name}
                  onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))}
                />
              </div>
              <div className="modal-field">
                <label>Client Email</label>
                <input
                  placeholder="jane@example.com"
                  value={form.client_email}
                  onChange={(e) => setForm((p) => ({ ...p, client_email: e.target.value }))}
                />
              </div>
              <div className="modal-field full">
                <label>Delivery Title *</label>
                <input
                  placeholder="Wedding Photos — June 2026"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="modal-field full">
                <label>Message to Client</label>
                <textarea
                  placeholder="Hi! Your photos are ready. Hope you love them!"
                  value={form.message}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                />
              </div>
              <div className="modal-field full">
                <label>Files</label>
                <div className="file-drop" onClick={() => fileRef.current && fileRef.current.click()}>
                  <div style={{ fontSize: 28 }}>⬆️</div>
                  <p>Click to select files — photos, videos, ZIPs, PDFs</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
                {files.length > 0 && (
                  <div className="selected-files">
                    {files.map((f, i) => (
                      <div key={i} className="selected-file">
                        <span>{fileIcon(f.type)}</span>
                        <div className="selected-file-info">
                          {f.name}
                          <span className="selected-file-size"> ({formatSize(f.size)})</span>
                        </div>
                        <button className="remove-file" onClick={() => removeFile(i)}>x</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {form.client_email && (
              <div className="notify-row">
                <input
                  type="checkbox"
                  id="notify"
                  checked={form.notify}
                  onChange={(e) => setForm((p) => ({ ...p, notify: e.target.checked }))}
                />
                <label htmlFor="notify">Send email notification to {form.client_email}</label>
              </div>
            )}

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className="modal-confirm"
                onClick={createDelivery}
                disabled={sending || !form.client_name || !form.title}
              >
                {uploading ? "Uploading..." : sending ? "Sending..." : "Send Delivery"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
