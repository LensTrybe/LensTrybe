import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function PortfolioPage() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    fetchPortfolio();
  }, [id]);

  const fetchPortfolio = async () => {
    const { data: prof, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !prof) { setNotFound(true); setLoading(false); return; }
    setProfile(prof);

    const [itemsRes, reviewsRes] = await Promise.all([
      supabase.from("portfolio_items").select("*").eq("creative_id", id).order("sort_order", { ascending: true }),
      supabase.from("reviews").select("*").eq("creative_id", id).order("created_at", { ascending: false }),
    ]);

    setItems(itemsRes.data || []);
    setReviews(reviewsRes.data || []);
    setLoading(false);
  };

  const categories = ["All", ...new Set(items.map((i) => i.category).filter(Boolean))];
  const filtered = activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory);
  const featured = items.filter((i) => i.featured);
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : null;

  if (loading) return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontFamily: "system-ui" }}>
      Loading portfolio...
    </div>
  );

  if (notFound) return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontFamily: "system-ui", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 48 }}></span>
      <p>Portfolio not found</p>
    </div>
  );

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0f0f; }
        .port-page { min-height: 100vh; background: #0f0f0f; color: #e8e8e8; font-family: 'DM Sans', system-ui, sans-serif; }
        .port-hero { background: linear-gradient(180deg, #141414 0%, #0f0f0f 100%); border-bottom: 1px solid #1e1e1e; padding: 60px 32px 40px; text-align: center; }
        .port-avatar { width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #39ff14, #a855f7); display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 700; color: #000; margin: 0 auto 16px; overflow: hidden; }
        .port-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .port-name { font-size: 32px; font-weight: 800; color: #fff; margin-bottom: 8px; }
        .port-tagline { font-size: 16px; color: #888; margin-bottom: 12px; }
        .port-meta { display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 13px; color: #555; flex-wrap: wrap; }
        .port-meta-item { display: flex; align-items: center; gap: 5px; }
        .port-rating { display: flex; align-items: center; gap: 6px; background: #1e1e1e; border-radius: 20px; padding: 4px 12px; }
        .port-rating-stars { color: #facc15; font-size: 12px; }
        .port-rating-num { font-size: 13px; color: #fff; font-weight: 600; }
        .port-skills { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 16px; }
        .port-skill { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 20px; padding: 4px 12px; font-size: 12px; color: #aaa; }
        .port-body { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
        .port-section-title { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 20px; }
        .featured-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-bottom: 48px; }
        .featured-card { position: relative; border-radius: 12px; overflow: hidden; aspect-ratio: 4/3; cursor: pointer; }
        .featured-card img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
        .featured-card:hover img { transform: scale(1.03); }
        .featured-card-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%); opacity: 0; transition: opacity 0.2s; display: flex; flex-direction: column; justify-content: flex-end; padding: 16px; }
        .featured-card:hover .featured-card-overlay { opacity: 1; }
        .featured-card-title { font-size: 15px; font-weight: 700; color: #fff; }
        .featured-card-cat { font-size: 11px; color: #aaa; margin-top: 3px; }
        .cat-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
        .cat-tab { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 20px; padding: 6px 16px; font-size: 12px; color: #666; cursor: pointer; transition: all 0.15s; }
        .cat-tab.active { background: #1e2a1e; border-color: #39ff14; color: #39ff14; }
        .portfolio-masonry { columns: 3; gap: 12px; }
        @media (max-width: 768px) { .portfolio-masonry { columns: 2; } }
        @media (max-width: 480px) { .portfolio-masonry { columns: 1; } }
        .masonry-item { break-inside: avoid; margin-bottom: 12px; border-radius: 10px; overflow: hidden; cursor: pointer; position: relative; }
        .masonry-item img { width: 100%; display: block; transition: transform 0.3s; }
        .masonry-item:hover img { transform: scale(1.02); }
        .masonry-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.2s; display: flex; flex-direction: column; justify-content: flex-end; padding: 12px; }
        .masonry-item:hover .masonry-overlay { opacity: 1; }
        .masonry-title { font-size: 13px; font-weight: 600; color: #fff; }
        .masonry-cat { font-size: 11px; color: #aaa; }
        .no-img-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 10px; padding: 20px; break-inside: avoid; margin-bottom: 12px; }
        .no-img-title { font-size: 14px; font-weight: 600; color: #fff; }
        .no-img-cat { font-size: 11px; color: #666; margin-top: 4px; }
        .no-img-desc { font-size: 12px; color: #888; margin-top: 8px; line-height: 1.5; }
        .reviews-section { margin-top: 48px; }
        .reviews-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
        .review-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 18px; }
        .review-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .review-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #39ff14, #a855f7); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #000; flex-shrink: 0; }
        .review-name { font-size: 14px; font-weight: 600; color: #fff; }
        .review-stars { color: #facc15; font-size: 12px; margin-top: 2px; }
        .review-comment { font-size: 13px; color: #888; line-height: 1.6; }
        .port-footer { text-align: center; padding: 40px 20px; color: #333; font-size: 12px; border-top: 1px solid #1a1a1a; margin-top: 60px; }
        .port-footer span { color: #39ff14; font-weight: 700; }
        .lightbox-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 1000; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .lightbox-img { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 8px; }
        .lightbox-close { position: absolute; top: 20px; right: 24px; font-size: 28px; color: #aaa; cursor: pointer; background: none; border: none; }
        .lightbox-info { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); text-align: center; color: #aaa; font-size: 14px; }
        .empty-portfolio { text-align: center; padding: 60px 20px; color: #444; font-size: 14px; }
      `}</style>

      <div className="port-page">
        <div className="port-hero">
          <div className="port-avatar">
            {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.business_name} /> : profile.business_name?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="port-name">{profile.business_name}</div>
          {profile.tagline && <div className="port-tagline">{profile.tagline}</div>}
          <div className="port-meta">
            {profile.location && <span className="port-meta-item"> {profile.location}</span>}
            {profile.years_experience && <span className="port-meta-item"> {profile.years_experience} years experience</span>}
            {avgRating && (
              <div className="port-rating">
                <span className="port-rating-stars"></span>
                <span className="port-rating-num">{avgRating}</span>
                <span style={{ color: "#555", fontSize: 11 }}>({reviews.length})</span>
              </div>
            )}
          </div>
          {(profile.skill_types?.length > 0 || profile.skills?.length > 0) && (
            <div className="port-skills">
              {[...(profile.skill_types || []), ...(profile.skills || [])].slice(0, 6).map((s, i) => (
                <span key={i} className="port-skill">{s}</span>
              ))}
            </div>
          )}
        </div>

        <div className="port-body">
          {featured.length > 0 && (
            <div style={{ marginBottom: 48 }}>
              <div className="port-section-title">Featured Work</div>
              <div className="featured-grid">
                {featured.map((item) => (
                  <div key={item.id} className="featured-card" onClick={() => item.image_url && setLightbox(item)}>
                    {item.image_url ? (
                      <>
                        <img src={item.image_url} alt={item.title} />
                        <div className="featured-card-overlay">
                          <div className="featured-card-title">{item.title}</div>
                          <div className="featured-card-cat">{item.category}</div>
                        </div>
                      </>
                    ) : (
                      <div style={{ background: "#141414", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="port-section-title">All Work ({items.length})</div>
          <div className="cat-tabs">
            {categories.map((c) => (
              <button key={c} className={"cat-tab " + (activeCategory === c ? "active" : "")} onClick={() => setActiveCategory(c)}>{c}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-portfolio">No work in this category yet</div>
          ) : (
            <div className="portfolio-masonry">
              {filtered.map((item) => (
                item.image_url ? (
                  <div key={item.id} className="masonry-item" onClick={() => setLightbox(item)}>
                    <img src={item.image_url} alt={item.title} />
                    <div className="masonry-overlay">
                      <div className="masonry-title">{item.title}</div>
                      <div className="masonry-cat">{item.category}</div>
                    </div>
                  </div>
                ) : (
                  <div key={item.id} className="no-img-card">
                    <div className="no-img-title">{item.title}</div>
                    <div className="no-img-cat">{item.category}</div>
                    {item.description && <div className="no-img-desc">{item.description}</div>}
                  </div>
                )
              ))}
            </div>
          )}

          {reviews.length > 0 && (
            <div className="reviews-section">
              <div className="port-section-title">Client Reviews</div>
              <div className="reviews-grid">
                {reviews.map((r) => (
                  <div key={r.id} className="review-card">
                    <div className="review-top">
                      <div className="review-avatar">{r.client_name?.[0]?.toUpperCase() || "?"}</div>
                      <div>
                        <div className="review-name">{r.client_name}</div>
                        <div className="review-stars">{"".repeat(r.rating || 0)}{"☆".repeat(5 - (r.rating || 0))}</div>
                      </div>
                    </div>
                    {r.comment && <div className="review-comment">{r.comment}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="port-footer">Powered by <span>LensTrybe</span></div>
      </div>

      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>×</button>
          <img src={lightbox.image_url} alt={lightbox.title} className="lightbox-img" />
          <div className="lightbox-info">
            <div>{lightbox.title}</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{lightbox.category}</div>
          </div>
        </div>
      )}
    </>
  );
}