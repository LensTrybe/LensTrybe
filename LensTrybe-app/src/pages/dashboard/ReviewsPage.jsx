import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

const Stars = ({ rating, size = 14 }) => (
  <span>
    {[1,2,3,4,5].map((s) => (
      <span key={s} style={{ color: s <= rating ? "#facc15" : "#333", fontSize: size }}>★</span>
    ))}
  </span>
);

export default function ReviewsPage() {
  const [user, setUser] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ client_name: "", rating: 5, comment: "" });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchReviews();
  }, [user]);

  const fetchReviews = async () => {
    setLoading(true);
    const { data } = await supabase.from("reviews").select("*").eq("creative_id", user.id).order("created_at", { ascending: false });
    setReviews(data || []);
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ client_name: "", rating: 5, comment: "" });
    setShowModal(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({ client_name: r.client_name || "", rating: r.rating || 5, comment: r.comment || "" });
    setShowModal(true);
  };

  const saveReview = async () => {
    if (!form.client_name.trim()) return;
    const payload = { ...form, creative_id: user.id };
    if (editing) {
      const { data } = await supabase.from("reviews").update(payload).eq("id", editing.id).select().single();
      setReviews((prev) => prev.map((r) => r.id === editing.id ? data : r));
    } else {
      const { data } = await supabase.from("reviews").insert(payload).select().single();
      setReviews((prev) => [data, ...prev]);
    }
    setShowModal(false);
  };

  const deleteReview = async (id) => {
    await supabase.from("reviews").delete().eq("id", id);
    setReviews((prev) => prev.filter((r) => r.id !== id));
  };

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : "0.0";
  const dist = [5,4,3,2,1].map((n) => ({ star: n, count: reviews.filter((r) => r.rating === n).length, pct: reviews.length ? (reviews.filter((r) => r.rating === n).length / reviews.length) * 100 : 0 }));

  return (
    <>
      <style>{`
        .reviews-wrap { padding: 28px 32px; background: #0f0f0f; min-height: 100vh; color: #e8e8e8; font-family: 'DM Sans', system-ui, sans-serif; }
        .reviews-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .reviews-title { font-size: 22px; font-weight: 700; color: #fff; }
        .reviews-subtitle { font-size: 13px; color: #555; margin-top: 4px; }
        .add-btn { background: #39ff14; color: #000; border: none; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .reviews-summary { display: flex; gap: 20px; background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
        .avg-block { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 100px; border-right: 1px solid #222; padding-right: 24px; }
        .avg-number { font-size: 48px; font-weight: 800; color: #facc15; line-height: 1; }
        .avg-label { font-size: 12px; color: #555; margin-top: 4px; }
        .dist-block { flex: 1; display: flex; flex-direction: column; gap: 8px; justify-content: center; }
        .dist-row { display: flex; align-items: center; gap: 8px; }
        .dist-star { font-size: 11px; color: #888; width: 16px; text-align: right; }
        .dist-bar-bg { flex: 1; background: #1e1e1e; border-radius: 4px; height: 8px; }
        .dist-bar-fill { height: 100%; border-radius: 4px; background: #facc15; }
        .dist-count { font-size: 11px; color: #555; width: 20px; }
        .reviews-grid { display: flex; flex-direction: column; gap: 12px; }
        .review-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 18px 20px; }
        .review-top { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
        .review-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #39ff14, #a855f7); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #000; flex-shrink: 0; }
        .review-info { flex: 1; }
        .review-name { font-size: 14px; font-weight: 600; color: #fff; }
        .review-date { font-size: 11px; color: #555; margin-top: 2px; }
        .review-actions { display: flex; gap: 6px; }
        .review-btn { background: none; border: 1px solid #2a2a2a; border-radius: 6px; padding: 5px 10px; font-size: 11px; color: #666; cursor: pointer; }
        .review-btn.danger:hover { border-color: #f87171; color: #f87171; }
        .review-comment { font-size: 13px; color: #aaa; line-height: 1.6; }
        .empty-reviews { text-align: center; padding: 60px 20px; color: #444; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 28px; width: 440px; max-width: 90vw; }
        .modal h3 { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 20px; }
        .modal-field { margin-bottom: 14px; }
        .modal-field label { display: block; font-size: 11px; color: #888; margin-bottom: 6px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .modal-field input, .modal-field textarea { width: 100%; background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 9px 12px; color: #e8e8e8; font-size: 13px; outline: none; font-family: inherit; box-sizing: border-box; }
        .modal-field input:focus, .modal-field textarea:focus { border-color: #39ff14; }
        .modal-field textarea { resize: vertical; min-height: 80px; }
        .star-picker { display: flex; gap: 6px; margin-top: 4px; }
        .star-btn { background: none; border: none; font-size: 24px; cursor: pointer; padding: 0; }
        .modal-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
        .modal-cancel { background: none; border: 1px solid #2a2a2a; color: #888; border-radius: 8px; padding: 9px 18px; cursor: pointer; font-size: 13px; }
        .modal-confirm { background: #39ff14; border: none; color: #000; border-radius: 8px; padding: 9px 20px; font-size: 13px; font-weight: 700; cursor: pointer; }
      `}</style>
      <div className="reviews-wrap">
        <div className="reviews-header">
          <div>
            <div className="reviews-title">Reviews</div>
            <div className="reviews-subtitle">Manage and showcase client feedback</div>
          </div>
          <button className="add-btn" onClick={openNew}>+ Add Review</button>
        </div>
        {reviews.length > 0 && (
          <div className="reviews-summary">
            <div className="avg-block">
              <div className="avg-number">{avgRating}</div>
              <Stars rating={Math.round(Number(avgRating))} size={16} />
              <div className="avg-label">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="dist-block">
              {dist.map((d) => (
                <div key={d.star} className="dist-row">
                  <div className="dist-star">{d.star}</div>
                  <div className="dist-bar-bg"><div className="dist-bar-fill" style={{ width: d.pct + "%" }} /></div>
                  <div className="dist-count">{d.count}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {loading ? <div className="empty-reviews"><p>Loading...</p></div> : reviews.length === 0 ? (
          <div className="empty-reviews">
            <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
            <p>No reviews yet</p>
          </div>
        ) : (
          <div className="reviews-grid">
            {reviews.map((r) => (
              <div key={r.id} className="review-card">
                <div className="review-top">
                  <div className="review-avatar">{r.client_name?.[0]?.toUpperCase() || "?"}</div>
                  <div className="review-info">
                    <div className="review-name">{r.client_name}</div>
                    <div className="review-date">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <Stars rating={r.rating} />
                  <div className="review-actions">
                    <button className="review-btn" onClick={() => openEdit(r)}>Edit</button>
                    <button className="review-btn danger" onClick={() => deleteReview(r.id)}>Delete</button>
                  </div>
                </div>
                {r.comment && <div className="review-comment">{r.comment}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "Edit Review" : "Add Review"}</h3>
            <div className="modal-field">
              <label>Client Name *</label>
              <input placeholder="Jane Smith" value={form.client_name} onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))} />
            </div>
            <div className="modal-field">
              <label>Rating</label>
              <div className="star-picker">
                {[1,2,3,4,5].map((s) => (
                  <button key={s} className="star-btn" onClick={() => setForm((p) => ({ ...p, rating: s }))}>
                    <span style={{ color: s <= form.rating ? "#facc15" : "#333" }}>★</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-field">
              <label>Review</label>
              <textarea placeholder="What did the client say?" value={form.comment} onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="modal-confirm" onClick={saveReview}>{editing ? "Save" : "Add Review"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}