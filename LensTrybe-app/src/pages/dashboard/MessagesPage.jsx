import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";

const formatTime = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const AttachmentPreview = ({ attachment }) => {
  const isImage = attachment.type?.startsWith("image/");
  const isPDF = attachment.type === "application/pdf";
  return (
    <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="attachment-chip">
      <span className="attachment-icon">{isImage ? "ðŸ–¼ï¸" : isPDF ? "ðŸ“„" : "ðŸ“Ž"}</span>
      <span className="attachment-name">{attachment.name}</span>
    </a>
  );
};

const LinkedDocBadge = ({ type }) => {
  const icons = { invoice: "ðŸ’°", quote: "ðŸ“‹", contract: "ðŸ“" };
  return (
    <span className="linked-doc-badge">
      {icons[type]} {type.charAt(0).toUpperCase() + type.slice(1)} attached
    </span>
  );
};

export default function Messages() {
  const [user, setUser] = useState(null);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadForm, setNewThreadForm] = useState({ client_name: "", client_email: "", subject: "" });
  const [invoices, setInvoices] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [showLinkDoc, setShowLinkDoc] = useState(false);
  const [linkedDoc, setLinkedDoc] = useState(null);
  const [search, setSearch] = useState("");
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchThreads();
    fetchDocs();
  }, [user]);

  useEffect(() => {
    if (!activeThread) return;
    fetchMessages(activeThread.id);
    markThreadRead(activeThread.id);
  }, [activeThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchThreads = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("message_threads")
      .select("*")
      .eq("creative_id", user.id)
      .order("last_message_at", { ascending: false });
    setThreads(data || []);
    setLoading(false);
  };

  const fetchMessages = async (threadId) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  };

  const fetchDocs = async () => {
    const [inv, quo, con] = await Promise.all([
      supabase.from("invoices").select("id, client_name, amount, status").eq("creative_id", user.id),
      supabase.from("quotes").select("id, client_name, amount, status").eq("creative_id", user.id),
      supabase.from("contracts").select("id, client_name, title, status").eq("creative_id", user.id),
    ]);
    setInvoices(inv.data || []);
    setQuotes(quo.data || []);
    setContracts(con.data || []);
  };

  const markThreadRead = async (threadId) => {
    await supabase.from("message_threads").update({ unread_count: 0 }).eq("id", threadId);
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread_count: 0 } : t)));
  };

  const createThread = async () => {
    if (!newThreadForm.client_name || !newThreadForm.subject) return;
    const { data, error } = await supabase
      .from("message_threads")
      .insert({ ...newThreadForm, creative_id: user.id })
      .select()
      .single();
    if (!error && data) {
      setThreads((prev) => [data, ...prev]);
      setActiveThread(data);
      setShowNewThread(false);
      setNewThreadForm({ client_name: "", client_email: "", subject: "" });
    }
  };

  const handleFileUpload = async (files) => {
    if (!files.length) return;
    setUploading(true);
    const uploaded = [];
    for (const file of files) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("message-attachments").upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from("message-attachments").getPublicUrl(path);
        uploaded.push({ name: file.name, url: urlData.publicUrl, type: file.type });
      }
    }
    setAttachments((prev) => [...prev, ...uploaded]);
    setUploading(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && !attachments.length && !linkedDoc) return;
    if (!activeThread) return;
    const msgData = {
      thread_id: activeThread.id,
      creative_id: user.id,
      sender_type: "creative",
      sender_name: "You",
      sender_email: user.email,
      body: newMessage,
      attachments: attachments,
      linked_doc_type: linkedDoc?.type || null,
      linked_doc_id: linkedDoc?.id || null,
      subject: activeThread.subject,
      read: true,
    };
    const { data, error } = await supabase.from("messages").insert(msgData).select().single();
    if (!error) {
      setMessages((prev) => [...prev, data]);
      await supabase
        .from("message_threads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", activeThread.id);
      setNewMessage("");
      setAttachments([]);
      setLinkedDoc(null);
      if (activeThread.client_email && newMessage.trim()) {
        fetch("https://lqafxisymvrazipaozfk.supabase.co/functions/v1/send-reply-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYWZ4aXN5bXZyYXppcGFvemZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNDM3NTIsImV4cCI6MjA4OTgxOTc1Mn0.FPcNjzMkHSjFEMQvXrpVMvggBDzaKBf4JqbEpDVuoms", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYWZ4aXN5bXZyYXppcGFvemZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNDM3NTIsImV4cCI6MjA4OTgxOTc1Mn0.FPcNjzMkHSjFEMQvXrpVMvggBDzaKBf4JqbEpDVuoms" },
          body: JSON.stringify({ thread_id: activeThread.id, reply_body: newMessage.trim() }),
        }).catch(console.error);
      }
    }
  };

  const filteredThreads = threads.filter(
    (t) =>
      t.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.subject?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <style>{`
        .messages-layout { display: flex; height: calc(100vh - 60px); background: #0f0f0f; color: #e8e8e8; font-family: 'DM Sans', system-ui, sans-serif; overflow: hidden; }
        .thread-sidebar { width: 300px; min-width: 300px; background: #141414; border-right: 1px solid #222; display: flex; flex-direction: column; }
        .sidebar-header { padding: 20px 16px 12px; border-bottom: 1px solid #222; display: flex; align-items: center; justify-content: space-between; }
        .sidebar-title { font-size: 16px; font-weight: 600; color: #fff; }
        .new-thread-btn { background: #39ff14; color: #000; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .new-thread-btn:hover { opacity: 0.85; }
        .search-bar { padding: 10px 12px; border-bottom: 1px solid #1e1e1e; }
        .search-bar input { width: 100%; background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 8px; padding: 7px 12px; color: #e8e8e8; font-size: 13px; outline: none; box-sizing: border-box; }
        .search-bar input:focus { border-color: #39ff14; }
        .thread-list { flex: 1; overflow-y: auto; }
        .thread-item { padding: 14px 16px; border-bottom: 1px solid #1a1a1a; cursor: pointer; transition: background 0.1s; }
        .thread-item:hover { background: #1a1a1a; }
        .thread-item.active { background: #1e2a1e; border-left: 3px solid #39ff14; }
        .thread-name { font-size: 14px; font-weight: 600; color: #fff; display: flex; align-items: center; justify-content: space-between; }
        .thread-time { font-size: 11px; color: #555; }
        .thread-subject { font-size: 12px; color: #888; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .unread-badge { background: #39ff14; color: #000; border-radius: 10px; font-size: 10px; font-weight: 800; padding: 1px 6px; }
        .empty-threads { padding: 40px 20px; text-align: center; color: #444; font-size: 13px; }
        .chat-area { flex: 1; display: flex; flex-direction: column; background: #0f0f0f; min-width: 0; }
        .chat-header { padding: 16px 24px; border-bottom: 1px solid #1e1e1e; background: #141414; display: flex; align-items: center; gap: 12px; }
        .chat-avatar { width: 38px; height: 38px; background: linear-gradient(135deg, #39ff14, #a855f7); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; color: #000; flex-shrink: 0; }
        .chat-header-info h3 { font-size: 15px; font-weight: 600; color: #fff; margin: 0; }
        .chat-header-info p { font-size: 12px; color: #666; margin: 2px 0 0; }
        .no-chat-selected { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #333; gap: 12px; }
        .no-chat-selected span { font-size: 48px; }
        .messages-scroll { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 12px; }
        .message-row { display: flex; gap: 10px; max-width: 72%; }
        .message-row.from-creative { align-self: flex-end; flex-direction: row-reverse; }
        .message-row.from-client { align-self: flex-start; }
        .msg-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; margin-top: 2px; }
        .msg-avatar.creative { background: linear-gradient(135deg, #39ff14, #22c55e); color: #000; }
        .msg-avatar.client { background: #2a2a2a; color: #aaa; }
        .msg-content { display: flex; flex-direction: column; gap: 4px; }
        .msg-bubble { padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5; word-break: break-word; }
        .from-creative .msg-bubble { background: #1a3a1a; border: 1px solid #2a4a2a; color: #d4f5d4; border-bottom-right-radius: 4px; }
        .from-client .msg-bubble { background: #1e1e1e; border: 1px solid #2a2a2a; color: #e8e8e8; border-bottom-left-radius: 4px; }
        .msg-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
        .attachment-chip { display: inline-flex; align-items: center; gap: 6px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 5px 10px; font-size: 12px; color: #aaa; text-decoration: none; }
        .attachment-chip:hover { border-color: #39ff14; color: #39ff14; }
        .attachment-name { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .linked-doc-badge { display: inline-flex; align-items: center; gap: 6px; background: #1e1e3a; border: 1px solid #3a3a6a; border-radius: 8px; padding: 5px 10px; font-size: 12px; color: #a78bfa; margin-top: 4px; }
        .msg-time { font-size: 10px; color: #444; padding: 0 4px; }
        .from-creative .msg-time { text-align: right; }
        .compose-area { border-top: 1px solid #1e1e1e; background: #141414; padding: 12px 20px 16px; }
        .attachment-preview-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
        .attachment-preview-item { display: flex; align-items: center; gap: 6px; background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 8px; padding: 4px 10px; font-size: 12px; color: #aaa; }
        .remove-attachment { background: none; border: none; color: #555; cursor: pointer; font-size: 14px; padding: 0; }
        .remove-attachment:hover { color: #f87171; }
        .linked-doc-preview { display: flex; align-items: center; gap: 8px; background: #1e1e3a; border: 1px solid #3a3a6a; border-radius: 8px; padding: 6px 12px; font-size: 12px; color: #a78bfa; margin-bottom: 10px; }
        .linked-doc-preview button { background: none; border: none; color: #555; cursor: pointer; font-size: 14px; margin-left: auto; }
        .compose-row { display: flex; gap: 8px; align-items: flex-end; }
        .compose-input { flex: 1; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 10px 14px; color: #e8e8e8; font-size: 14px; resize: none; outline: none; font-family: inherit; min-height: 44px; max-height: 120px; line-height: 1.5; }
        .compose-input:focus { border-color: #39ff14; }
        .compose-input::placeholder { color: #444; }
        .compose-actions { display: flex; gap: 6px; align-items: center; }
        .action-btn { width: 38px; height: 38px; background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 10px; color: #666; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; }
        .action-btn:hover { border-color: #444; color: #aaa; }
        .send-btn { width: 38px; height: 38px; background: #39ff14; border: none; border-radius: 10px; color: #000; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; }
        .send-btn:hover { opacity: 0.85; }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 28px; width: 420px; max-width: 90vw; }
        .modal h3 { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 20px; }
        .modal-field { margin-bottom: 14px; }
        .modal-field label { display: block; font-size: 12px; color: #888; margin-bottom: 6px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .modal-field input { width: 100%; background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 10px 12px; color: #e8e8e8; font-size: 14px; outline: none; box-sizing: border-box; }
        .modal-field input:focus { border-color: #39ff14; }
        .modal-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
        .modal-cancel { background: none; border: 1px solid #2a2a2a; color: #888; border-radius: 8px; padding: 9px 18px; cursor: pointer; font-size: 14px; }
        .modal-confirm { background: #39ff14; border: none; color: #000; border-radius: 8px; padding: 9px 20px; font-size: 14px; font-weight: 700; cursor: pointer; }
        .link-doc-list { max-height: 260px; overflow-y: auto; margin-top: 10px; }
        .link-doc-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid #2a2a2a; border-radius: 8px; margin-bottom: 6px; cursor: pointer; }
        .link-doc-item:hover { border-color: #a78bfa; background: #1e1e3a; }
        .doc-name { font-size: 14px; color: #e8e8e8; }
        .doc-meta { font-size: 11px; color: #666; margin-top: 2px; }
        .doc-type-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
        .doc-type-tab { flex: 1; background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 7px; font-size: 12px; color: #888; cursor: pointer; text-align: center; }
        .doc-type-tab.active { background: #1e1e3a; border-color: #a78bfa; color: #a78bfa; font-weight: 600; }
      `}</style>

      <div className="messages-layout">
        <div className="thread-sidebar">
          <div className="sidebar-header">
            <span className="sidebar-title">Messages</span>
            <button className="new-thread-btn" onClick={() => setShowNewThread(true)}>+ New</button>
          </div>
          <div className="search-bar">
            <input placeholder="Search conversations..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="thread-list">
            {loading ? (
              <div className="empty-threads"><p>Loading...</p></div>
            ) : filteredThreads.length === 0 ? (
              <div className="empty-threads">
                <div style={{ fontSize: 32, marginBottom: 8 }}>ðŸ’¬</div>
                <p>No conversations yet</p>
                <p style={{ fontSize: 11, marginTop: 4 }}>Click + New to start one</p>
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <div
                  key={thread.id}
                  className={`thread-item ${activeThread?.id === thread.id ? "active" : ""}`}
                  onClick={() => setActiveThread(thread)}
                >
                  <div className="thread-name">
                    <span>{thread.client_name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {thread.unread_count > 0 && <span className="unread-badge">{thread.unread_count}</span>}
                      <span className="thread-time">{formatTime(thread.last_message_at)}</span>
                    </div>
                  </div>
                  <div className="thread-subject">{thread.subject}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="chat-area">
          {!activeThread ? (
            <div className="no-chat-selected">
              <span>ðŸ“¨</span>
              <p style={{ color: "#444", fontSize: 14 }}>Select a conversation or start a new one</p>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <div className="chat-avatar">{activeThread.client_name?.[0]?.toUpperCase() || "?"}</div>
                <div className="chat-header-info">
                  <h3>{activeThread.client_name}</h3>
                  <p>{activeThread.client_email} Â· {activeThread.subject}</p>
                </div>
              </div>

              <div className="messages-scroll">
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", color: "#333", fontSize: 13, marginTop: 40 }}>
                    No messages yet â€” send the first one!
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={`message-row ${msg.sender_type === "creative" ? "from-creative" : "from-client"}`}>
                    <div className={`msg-avatar ${msg.sender_type}`}>
                      {msg.sender_type === "creative" ? "Y" : activeThread.client_name?.[0]?.toUpperCase() || "C"}
                    </div>
                    <div className="msg-content">
                      {msg.body && <div className="msg-bubble">{msg.body}</div>}
                      {msg.attachments?.length > 0 && (
                        <div className="msg-attachments">
                          {msg.attachments.map((a, i) => <AttachmentPreview key={i} attachment={a} />)}
                        </div>
                      )}
                      {msg.linked_doc_type && <LinkedDocBadge type={msg.linked_doc_type} />}
                      <div className="msg-time">{formatTime(msg.created_at)}</div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="compose-area">
                {attachments.length > 0 && (
                  <div className="attachment-preview-row">
                    {attachments.map((a, i) => (
                      <div key={i} className="attachment-preview-item">
                        <span>{a.type?.startsWith("image/") ? "ðŸ–¼ï¸" : "ðŸ“„"}</span>
                        <span>{a.name}</span>
                        <button className="remove-attachment" onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}>Ã—</button>
                      </div>
                    ))}
                  </div>
                )}
                {linkedDoc && (
                  <div className="linked-doc-preview">
                    <span>{linkedDoc.type === "invoice" ? "ðŸ’°" : linkedDoc.type === "quote" ? "ðŸ“‹" : "ðŸ“"}</span>
                    <span>Attaching {linkedDoc.type}: {linkedDoc.label}</span>
                    <button onClick={() => setLinkedDoc(null)}>Ã—</button>
                  </div>
                )}
                <div className="compose-row">
                  <textarea
                    className="compose-input"
                    placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    rows={1}
                  />
                  <div className="compose-actions">
                    <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" style={{ display: "none" }} onChange={(e) => handleFileUpload(Array.from(e.target.files))} />
                    <button className="action-btn" title="Attach file" onClick={() => fileInputRef.current?.click()}>{uploading ? "â³" : "ðŸ“Ž"}</button>
                    <button className="action-btn" title="Link document" onClick={() => setShowLinkDoc(true)}>ðŸ“‹</button>
                    <button className="send-btn" onClick={sendMessage} disabled={!newMessage.trim() && !attachments.length && !linkedDoc}>â†‘</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showNewThread && (
        <div className="modal-overlay" onClick={() => setShowNewThread(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New Conversation</h3>
            <div className="modal-field">
              <label>Client Name</label>
              <input placeholder="Jane Smith" value={newThreadForm.client_name} onChange={(e) => setNewThreadForm((p) => ({ ...p, client_name: e.target.value }))} />
            </div>
            <div className="modal-field">
              <label>Client Email</label>
              <input placeholder="jane@example.com" value={newThreadForm.client_email} onChange={(e) => setNewThreadForm((p) => ({ ...p, client_email: e.target.value }))} />
            </div>
            <div className="modal-field">
              <label>Subject</label>
              <input placeholder="Wedding shoot â€“ June 2026" value={newThreadForm.subject} onChange={(e) => setNewThreadForm((p) => ({ ...p, subject: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowNewThread(false)}>Cancel</button>
              <button className="modal-confirm" onClick={createThread}>Start Conversation</button>
            </div>
          </div>
        </div>
      )}

      {showLinkDoc && (
        <div className="modal-overlay" onClick={() => setShowLinkDoc(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Link a Document</h3>
            <LinkDocPicker invoices={invoices} quotes={quotes} contracts={contracts} onSelect={(doc) => { setLinkedDoc(doc); setShowLinkDoc(false); }} />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowLinkDoc(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LinkDocPicker({ invoices, quotes, contracts, onSelect }) {
  const [tab, setTab] = useState("invoice");
  const docs = { invoice: invoices, quote: quotes, contract: contracts };
  const current = docs[tab] || [];
  return (
    <div>
      <div className="doc-type-tabs">
        {["invoice", "quote", "contract"].map((t) => (
          <button key={t} className={`doc-type-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "invoice" ? "ðŸ’°" : t === "quote" ? "ðŸ“‹" : "ðŸ“"} {t.charAt(0).toUpperCase() + t.slice(1)}s
          </button>
        ))}
      </div>
      <div className="link-doc-list">
        {current.length === 0 ? (
          <div style={{ color: "#444", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No {tab}s found</div>
        ) : (
          current.map((doc) => (
            <div key={doc.id} className="link-doc-item" onClick={() => onSelect({ type: tab, id: doc.id, label: doc.client_name + (doc.amount ? ` â€“ $${doc.amount}` : doc.title ? ` â€“ ${doc.title}` : "") })}>
              <span>{tab === "invoice" ? "ðŸ’°" : tab === "quote" ? "ðŸ“‹" : "ðŸ“"}</span>
              <div>
                <div className="doc-name">{doc.client_name}{doc.title ? ` â€“ ${doc.title}` : ""}</div>
                <div className="doc-meta">{doc.amount ? `$${doc.amount}` : ""} Â· {doc.status}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}



