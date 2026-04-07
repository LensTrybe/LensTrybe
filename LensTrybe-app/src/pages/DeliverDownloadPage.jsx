import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useParams } from "react-router-dom";

const formatSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; }
  .ddl-wrap {
    min-height: 100vh;
    background: #0a0a0a;
    color: #e8e8e8;
    font-family: 'DM Sans', system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 20px 60px;
  }
  .ddl-logo {
    font-size: 20px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.5px;
    margin-bottom: 40px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ddl-logo span { color: #39ff14; }
  .ddl-card {
    background: #141414;
    border: 1px solid #1e1e1e;
    border-radius: 20px;
    padding: 36px 40px;
    width: 100%;
    max-width: 580px;
  }
  .ddl-icon {
    width: 56px;
    height: 56px;
    background: #1e2a1e;
    border: 1px solid #2a4a2a;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    margin-bottom: 20px;
  }
  .ddl-title {
    font-size: 22px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 6px;
  }
  .ddl-from {
    font-size: 13px;
    color: #555;
    margin-bottom: 20px;
  }
  .ddl-from strong { color: #888; }
  .ddl-message {
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 10px;
    padding: 14px 16px;
    font-size: 13px;
    color: #aaa;
    line-height: 1.6;
    margin-bottom: 24px;
  }
  .ddl-files-label {
    font-size: 11px;
    color: #555;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 10px;
  }
  .ddl-files {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 28px;
  }
  .ddl-file {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 10px;
    padding: 12px 14px;
    text-decoration: none;
    transition: border-color 0.15s;
  }
  .ddl-file:hover { border-color: #39ff14; }
  .ddl-file-icon { font-size: 20px; flex-shrink: 0; }
  .ddl-file-info { flex: 1; min-width: 0; }
  .ddl-file-name {
    font-size: 13px;
    color: #e8e8e8;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ddl-file-size { font-size: 11px; color: #555; margin-top: 2px; }
  .ddl-file-arrow { font-size: 16px; color: #39ff14; flex-shrink: 0; }
  .ddl-download-all {
    width: 100%;
    background: #39ff14;
    color: #000;
    border: none;
    border-radius: 10px;
    padding: 13px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: opacity 0.15s;
  }
  .ddl-download-all:hover { opacity: 0.88; }
  .ddl-footer {
    margin-top: 32px;
    font-size: 11px;
    color: #333;
    text-align: center;
  }
  .ddl-footer strong { color: #444; }
  .ddl-state {
    text-align: center;
    padding: 60px 20px;
    color: #444;
  }
  .ddl-state span { font-size: 48px; display: block; margin-bottom: 16px; }
  .ddl-state h2 { font-size: 18px; color: #666; margin-bottom: 8px; }
  .ddl-state p { font-size: 13px; color: #444; }
`;

export default function DeliverDownloadPage() {
  const { token } = useParams();
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    fetchDelivery();
  }, [token]);

  const fetchDelivery = async () => {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("download_token", token)
      .single();

    if (error || !data) {
      setNotFound(true);
    } else {
      setDelivery(data);
      // Mark as downloaded if not already
      if (!data.downloaded_at) {
        await supabase
          .from("deliveries")
          .update({ downloaded_at: new Date().toISOString() })
          .eq("download_token", token);
      }
    }
    setLoading(false);
  };

  const downloadAll = () => {
    if (!delivery?.files) return;
    delivery.files.forEach((f, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = f.url;
        a.download = f.name;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 300);
    });
  };

  return (
    <>
      <style>{styles}</style>
      <div className="ddl-wrap">
        <div className="ddl-logo">
          Lens<span>Trybe</span>
        </div>

        {loading && (
          <div className="ddl-state">
            <span>⏳</span>
            <h2>Loading your delivery...</h2>
          </div>
        )}

        {!loading && notFound && (
          <div className="ddl-state">
            <span>📭</span>
            <h2>Delivery not found</h2>
            <p>This link may have expired or been removed.<br />Contact your creative for a new link.</p>
          </div>
        )}

        {!loading && delivery && (
          <div className="ddl-card">
            <div className="ddl-icon">📦</div>
            <div className="ddl-title">{delivery.title}</div>
            <div className="ddl-from">
              Delivered to <strong>{delivery.client_name}</strong>
            </div>

            {delivery.message && (
              <div className="ddl-message">{delivery.message}</div>
            )}

            {delivery.files && delivery.files.length > 0 && (
              <>
                <div className="ddl-files-label">
                  {delivery.files.length} {delivery.files.length === 1 ? "file" : "files"} ready to download
                </div>
                <div className="ddl-files">
                  {delivery.files.map((f, i) => (
                    
                      key={i}
                      href={f.url}
                      download={f.name}
                      target="_blank"
                      rel="noreferrer"
                      className="ddl-file"
                    >
                      <span className="ddl-file-icon">{fileIcon(f.type)}</span>
                      <div className="ddl-file-info">
                        <div className="ddl-file-name">{f.name}</div>
                        {f.size && <div className="ddl-file-size">{formatSize(f.size)}</div>}
                      </div>
                      <span className="ddl-file-arrow">↓</span>
                    </a>
                  ))}
                </div>

                {delivery.files.length > 1 && (
                  <button className="ddl-download-all" onClick={downloadAll}>
                    ↓ Download All Files
                  </button>
                )}
              </>
            )}

            {(!delivery.files || delivery.files.length === 0) && (
              <div style={{ color: "#444", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                No files attached to this delivery.
              </div>
            )}

            <div className="ddl-footer">
              Delivered via <strong>LensTrybe</strong> · lenstrybe.com
            </div>
          </div>
        )}
      </div>
    </>
  );
}