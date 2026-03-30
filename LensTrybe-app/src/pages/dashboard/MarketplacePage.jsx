import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

const CATEGORIES = ["All","Photography","Videography","Editing","Wedding","Portrait","Commercial","Events"];

export default function MarketplacePage() {
  const [user, setUser] = useState(null);
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    fetchCreatives();
  }, []);

  const fetchCreatives = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, business_name, tagline, bio, location, avatar_url, skill_types, specialties, skills, subscription_tier")
      .not("business_name", "is", null)
      .limit(50);
    setCreatives(data || []);
    setLoading(false);
  };

  const filtered = creatives.filter((c) => {
    const matchSearch =
      c.business_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.location?.toLowerCase().includes(search.toLowerCase()) ||
      c.tagline?.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      category === "All" ||
      c.skill_types?.some((s) => s.toLowerCase().includes(category.toLowerCase())) ||
      c.specialties?.some((s) => s.toLowerCase().includes(category.toLowerCase())) ||
      c.skills?.some((s) => s.toLowerCase().includes(category.toLowerCase()));
    return matchSearch && matchCat;
  });

  return (
    <>
      <style>{`
        .market-wrap { display: flex; height: calc(100vh - 60px); background: #0f0f0f; color: #e8e8e8; font-family: 'DM Sans', system-ui, sans-serif; overflow: hidden; }
        .market-sidebar { width: 320px; min-width: 320px; background: #141414; border-right: 1px solid #1e1e1e; display: flex; flex-direction: column; }
        .market-sidebar-header { padding: 20px 16px 12px; border-bottom: 1px solid #1e1e1e; }
        .market-title { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 12px; }
        .market-search { width: 100%; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 8px 12px; color: #e8e8e8; font-size: 13px; outline: none; box-sizing: border-box; margin-bottom: 10px; }
        .market-search:focus { border-color: #39ff14; }
        .market-search::placeholder { color: #444; }
        .cat-scroll { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
        .cat-btn { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 6px; padding: 5px 10px; font-size: 11px; color: #666; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
        .cat-btn.active { border-color: #39ff14; color: #39ff14; background: #1a2a1a; }
        .market-list { flex: 1; overflow-y: auto; }
        .creative-item { padding: 14px 16px; border-bottom: 1px solid #1a1a1a; cursor: pointer; transition: background 0.1s; }
        .creative-item:hover { background: #1a1a1a; }
        .creative-item.active { background: #1e2a1e; border-left: 3px solid #39ff14; }
        .creative-item-top { display: flex; align-items: center; gap: 10px; }
        .creative-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #39ff14, #a855f7); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; color: #000; flex-shrink: 0; overflow: hidden; }
        .creative-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .creative-item-info { flex: 1; min-width: 0; }
        .creative-item-name { font-size: 14px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .creative-item-loc { font-size: 11px; color: #666; margin-top: 2px; }
        .pro-badge { font-size: 9px; background: #2a1a2a; border: 1px solid #4a1a4a; color: #e879f9; border-radius: 4px; padding: 2px 5px; font-weight: 700; }
        .creative-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
        .creative-tag { background: #1e1e1e; border-radius: 4px; padding: 2px 6px; font-size: 10px; color: #666; }
        .empty-market { padding: 40px 20px; text-align: center; color: #444; font-size: 13px; }
        .market-detail { flex: 1; overflow-y: auto; padding: 28px 32px; }
        .no-creative { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #333; gap: 12px; }
        .detail-hero { display: flex; align-items: center; gap: 20px; margin-bottom: 28px; }
        .detail-avatar { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, #39ff14, #a855f7); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: #000; flex-shrink: 0; overflow: hidden; }
        .detail-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .detail-name { font-size: 24px; font-weight: 800; color: #fff; }
        .detail-loc { font-size: 13px; color: #666; margin-top: 4px; }
        .detail-tagline { font-size: 14px; color: #aaa; margin-top: 6px; font-style: italic; }
        .detail-section { margin-bottom: 20px; }
        .detail-section-title { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 10px; }
        .detail-bio { font-size: 14px; color: #aaa; line-height: 1.7; background: #141414; border: 1px solid #1e1e1e; border-radius: 10px; padding: 14px 16px; }
        .detail-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .detail-tag { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 6px; padding: 4px 10px; font-size: 12px; color: #aaa; }
        .connect-btn { background: #39ff14; color: #000; border: none; border-radius: 8px; padding: 10px 22px; font-size: 13px; font-weight: 700; cursor: pointer; margin-top: 8px; }
        .me-badge { background: #1e2a1e; border: 1px solid #2a4a2a; color: #39ff14; border-radius: 8px; padding: 8px 16px; font-size: 12px; font-weight: 600; display: inline-block; }
      `}</style>
      <div className="market-wrap">
        <div className="market-sidebar">
          <div className="market-sidebar-header">
            <div className="market-title">Marketplace</div>
            <input className="market-search" placeholder="Search creatives..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="cat-scroll">
              {CATEGORIES.map((c) => (
                <button key={c} className={"cat-btn " + (category === c ? "active" : "")} onClick={() => setCategory(c)}>{c}</button>
              ))}
            </div>
          </div>
          <div className="market-list">
            {loading ? (
              <div className="empty-market">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="empty-market">
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                <p>No creatives found</p>
              </div>
            ) : (
              filtered.map((c) => (
                <div key={c.id} className={"creative-item " + (selected?.id === c.id ? "active" : "")} onClick={() => setSelected(c)}>
                  <div className="creative-item-top">
                    <div className="creative-avatar">
                      {c.avatar_url ? <img src={c.avatar_url} alt={c.business_name} /> : c.business_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="creative-item-info">
                      <div className="creative-item-name">{c.business_name}</div>
                      <div className="creative-item-loc">{c.location || "Location not set"}</div>
                    </div>
                    {(c.subscription_tier === "pro" || c.subscription_tier === "vip") && <span className="pro-badge">PRO</span>}
                  </div>
                  {([...(c.skill_types || []), ...(c.skills || [])]).length > 0 && (
                    <div className="creative-tags">
                      {[...(c.skill_types || []), ...(c.skills || [])].slice(0, 3).map((t, i) => (
                        <span key={i} className="creative-tag">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="market-detail">
          {!selected ? (
            <div className="no-creative">
              <span style={{ fontSize: 48 }}>🛍️</span>
              <p style={{ color: "#444", fontSize: 14 }}>Select a creative to view their profile</p>
            </div>
          ) : (
            <>
              <div className="detail-hero">
                <div className="detail-avatar">
                  {selected.avatar_url ? <img src={selected.avatar_url} alt={selected.business_name} /> : selected.business_name?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <div className="detail-name">{selected.business_name}</div>
                  {selected.location && <div className="detail-loc">📍 {selected.location}</div>}
                  {selected.tagline && <div className="detail-tagline">"{selected.tagline}"</div>}
                </div>
              </div>
              {selected.bio && (
                <div className="detail-section">
                  <div className="detail-section-title">About</div>
                  <div className="detail-bio">{selected.bio}</div>
                </div>
              )}
              {([...(selected.skill_types || []), ...(selected.skills || []), ...(selected.specialties || [])]).length > 0 && (
                <div className="detail-section">
                  <div className="detail-section-title">Skills and Specialties</div>
                  <div className="detail-tags">
                    {[...(selected.skill_types || []), ...(selected.skills || []), ...(selected.specialties || [])].map((t, i) => (
                      <span key={i} className="detail-tag">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="detail-section">
                {selected.id === user?.id ? (
                  <div className="me-badge">This is your profile</div>
                ) : (
                  <button className="connect-btn">Message {selected.business_name}</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}