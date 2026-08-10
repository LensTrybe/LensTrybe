import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import CinematicEntrance from '../../components/ui/CinematicEntrance';

const CATEGORIES = [
  { key: 'photographer', label: 'Photographers' },
  { key: 'videographer', label: 'Videographers' },
  { key: 'drone_pilot', label: 'Drone Pilots' },
  { key: 'video_editor', label: 'Video Editors' },
  { key: 'photo_editor', label: 'Photo Editors' },
  { key: 'social_media_manager', label: 'Social Media Managers' },
  { key: 'hair_makeup_artist', label: 'Hair & Makeup Artists' },
  { key: 'ugc_creator', label: 'UGC Creators' },
];

const IconCamera = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>);
const IconVideo = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>);
const IconDrone = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 4l4 4m8-4l-4 4m4 8l4 4m-12 0l4-4"/><circle cx="4" cy="4" r="1.5"/><circle cx="20" cy="4" r="1.5"/><circle cx="4" cy="20" r="1.5"/><circle cx="20" cy="20" r="1.5"/></svg>);
const IconEdit = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>);
const IconPhoto = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>);
const IconShare = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>);
const IconMakeup = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>);
const IconPhone = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>);
const IconStar = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>);
const IconPin = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>);
const IconArrow = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>);

const CATEGORY_ICONS = {
  photographer: <IconCamera />, videographer: <IconVideo />, drone_pilot: <IconDrone />,
  video_editor: <IconEdit />, photo_editor: <IconPhoto />, social_media_manager: <IconShare />,
  hair_makeup_artist: <IconMakeup />, ugc_creator: <IconPhone />,
};

const FONT = "'Inter', sans-serif";
const SERIF = "'Instrument Serif', Georgia, serif";
const GREEN = '#1DB954';

const TEXT_PRIMARY = '#14111a';
const TEXT_SECONDARY = '#565560';
const TEXT_MUTED = '#8a8995';
const PAGE_TONE = '246,245,243';

const GLASS_CARD = {
  backdropFilter: 'blur(22px) saturate(150%)',
  WebkitBackdropFilter: 'blur(22px) saturate(150%)',
  background: 'linear-gradient(160deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.55) 100%)',
  border: '1px solid rgba(20,17,26,0.07)',
  borderRadius: '20px',
  boxShadow: '0 10px 30px -12px rgba(40,30,60,0.16), inset 0 1px 0 rgba(255,255,255,0.85)',
};

const GLASS_CARD_GREEN = {
  backdropFilter: 'blur(22px) saturate(150%)',
  WebkitBackdropFilter: 'blur(22px) saturate(150%)',
  background: 'linear-gradient(160deg, rgba(29,185,84,0.12) 0%, rgba(255,255,255,0.55) 100%)',
  border: '1px solid rgba(29,185,84,0.28)',
  borderRadius: '20px',
  boxShadow: '0 12px 34px -12px rgba(29,120,70,0.2), inset 0 1px 0 rgba(255,255,255,0.85)',
};

const GLASS_CARD_AURORA = {
  ...GLASS_CARD,
  background: 'radial-gradient(circle at 100% 0%, rgba(29,185,84,0.16), transparent 42%), radial-gradient(circle at 84% 8%, rgba(255,45,120,0.12), transparent 40%), linear-gradient(160deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%)',
  overflow: 'hidden',
};

const DIVIDER_GRADIENT = 'linear-gradient(90deg, transparent, rgba(20,17,26,0.08), transparent)';

const TILE_GRADS = [
  'linear-gradient(135deg,#3a4a5c,#6b8299)',
  'linear-gradient(135deg,#c9a48a,#8a6f5e)',
  'linear-gradient(135deg,#7a8b6f,#4d5f4a)',
  'linear-gradient(135deg,#d4a5b5,#a76d84)',
  'linear-gradient(135deg,#b0a89c,#847c70)',
];

const TILE_COLUMNS = [
  { dir: 'up', dur: 30, start: 0 },
  { dir: 'down', dur: 26, start: 3 },
  { dir: 'up', dur: 34, start: 1 },
  { dir: 'down', dur: 30, start: 4 },
  { dir: 'up', dur: 28, start: 2 },
];

function DriftingTiles() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', padding: '8px', zIndex: 0 }}>
      {TILE_COLUMNS.map((col, ci) => {
        const seq = Array.from({ length: 6 }, (_, i) => TILE_GRADS[(col.start + i) % TILE_GRADS.length]);
        const tiles = [...seq, ...seq];
        return (
          <div key={ci} style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', willChange: 'transform', animation: `${col.dir === 'up' ? 'ltHeroUp' : 'ltHeroDown'} ${col.dur}s linear infinite` }}>
              {tiles.map((bg, i) => (
                <div key={i} style={{ height: '136px', marginBottom: '8px', borderRadius: '11px', background: bg }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HeroSolidButton({ onClick, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? '#2a2733' : '#14111a', color: '#fff', border: 'none', borderRadius: '9px',
        padding: '13px 24px', fontWeight: 500, fontSize: '14px', fontFamily: FONT, cursor: 'pointer', lineHeight: 1.4,
        boxShadow: '0 6px 20px -6px rgba(20,17,26,0.4), inset 0 1px 0 rgba(255,255,255,0.14)',
        transition: 'background 0.15s ease', whiteSpace: 'nowrap',
      }}>{children}</button>
  );
}

function HeroGlassButton({ onClick, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: hover
          ? 'linear-gradient(160deg, rgba(255,255,255,1), rgba(255,255,255,0.8))'
          : 'linear-gradient(160deg, rgba(255,255,255,0.9), rgba(255,255,255,0.65))',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(20,17,26,0.1)', color: TEXT_PRIMARY, borderRadius: '9px',
        padding: '13px 24px', fontWeight: 500, fontSize: '14px', fontFamily: FONT, cursor: 'pointer', lineHeight: 1.4,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)', transition: 'background 0.15s ease', whiteSpace: 'nowrap',
      }}>{children}</button>
  );
}

function HeroTextButton({ onClick, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: 'transparent', border: 'none', color: TEXT_PRIMARY, cursor: 'pointer',
        fontWeight: 500, fontSize: '14px', fontFamily: FONT, lineHeight: 1.4, padding: '13px 8px',
        display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: hover ? 0.6 : 1,
        transition: 'opacity 0.15s ease', whiteSpace: 'nowrap',
      }}>{children}<IconArrow /></button>
  );
}

function CreativeCard({ creative, isCenter }) {
  const tierColor = creative.subscription_tier === 'elite' ? '#B45309' : '#7C3AED';
  const tierBg = creative.subscription_tier === 'elite' ? 'rgba(245,158,11,0.14)' : 'rgba(124,58,237,0.12)';
  const tierBorder = creative.subscription_tier === 'elite' ? 'rgba(245,158,11,0.3)' : 'rgba(124,58,237,0.28)';
  const tierLabel = creative.subscription_tier === 'elite' ? 'ELITE' : 'EXPERT';
  const skillLabel = (creative.skill_types?.[0] ?? '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Creative';
  const location = [creative.city, creative.state].filter(Boolean).join(', ');
  return (
    <div style={{
      ...(isCenter ? GLASS_CARD_GREEN : GLASS_CARD),
      padding: '0 16px 16px', minWidth: '240px',
      pointerEvents: 'none', fontFamily: FONT,
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px', paddingTop: '14px' }}>
        <span style={{
          fontSize: '10px', fontWeight: 600, letterSpacing: '0.02em', lineHeight: 1.6, color: tierColor,
          background: tierBg, border: `1px solid ${tierBorder}`,
          borderRadius: '20px', padding: '3px 10px',
        }}
        >{tierLabel}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 8px' }}>
        {creative.avatar_url
          ? <img src={creative.avatar_url} alt={creative.business_name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: isCenter ? '2px solid rgba(29,185,84,0.45)' : '2px solid rgba(20,17,26,0.08)' }} />
          : <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(29,185,84,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', border: isCenter ? '2px solid rgba(29,185,84,0.45)' : '2px solid rgba(20,17,26,0.08)' }}></div>
        }
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.6, color: TEXT_PRIMARY, textAlign: 'center', marginBottom: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{creative.business_name}</div>
      <div style={{ fontSize: '12px', fontWeight: 500, lineHeight: 1.6, color: '#0f7a37', textAlign: 'center', marginBottom: '10px' }}>{skillLabel}</div>
      {location && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', marginBottom: '10px' }}>
          <span style={{ color: TEXT_MUTED, display: 'flex' }}><IconPin /></span>
          <span style={{ fontSize: '12px', fontWeight: 400, lineHeight: 1.6, color: TEXT_SECONDARY }}>{location}</span>
        </div>
      )}
      {creative.bio && isCenter && (
        <div style={{ fontSize: '12px', color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 1.6, fontWeight: 400, marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{creative.bio}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
        <span style={{ color: '#F59E0B', display: 'flex' }}><IconStar /></span>
        <span style={{ fontSize: '13px', color: TEXT_PRIMARY, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.6 }}>{Number(creative.avg_rating || 0).toFixed(1)}</span>
        <span style={{ fontSize: '12px', fontWeight: 400, lineHeight: 1.6, color: TEXT_MUTED }}>({creative.review_count || 0})</span>
      </div>
    </div>
  );
}

function FanCarousel({ creatives, autoPlay = true }) {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const intervalRef = useRef(null);
  const trackRef = useRef(null);
  const dragStartX = useRef(null);
  const dragStartY = useRef(null);
  const dragDelta = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const CARD_WIDTH = 240;
  const CARD_GAP = 24;
  const STEP = CARD_WIDTH + CARD_GAP;

  const goTo = useCallback((index) => {
    setActiveIndex(((index) % creatives.length + creatives.length) % creatives.length);
    setDragOffset(0);
  }, [creatives.length]);

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  const startAuto = useCallback(() => {
    clearInterval(intervalRef.current);
    if (!autoPlay || creatives.length < 2) return;
    intervalRef.current = setInterval(next, 3000);
  }, [autoPlay, creatives.length, next]);

  useEffect(() => { startAuto(); return () => clearInterval(intervalRef.current); }, [startAuto]);

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragDelta.current = 0;
    clearInterval(intervalRef.current);
  };
  const onPointerMove = (e) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    const dy = e.clientY - (dragStartY.current ?? e.clientY);
    if (Math.abs(dy) > Math.abs(dx) + 5) {
      dragStartX.current = null;
      dragDelta.current = 0;
      setDragOffset(0);
      return;
    }
    if (Math.abs(dx) > 5) {
      e.preventDefault();
    }
    dragDelta.current = dx;
    setDragOffset(dx);
  };
  const onPointerUp = () => {
    if (dragStartX.current === null) return;
    if (dragDelta.current < -60) next();
    else if (dragDelta.current > 60) prev();
    else setDragOffset(0);
    dragStartX.current = null;
    dragStartY.current = null;
    startAuto();
  };

  const handleCardClick = (creative) => {
    if (Math.abs(dragDelta.current) > 8) return;
    if (!creative?.id) return;
    navigate(`/creatives/${creative.id}`);
  };

  const getCardProps = (offset) => {
    const abs = Math.abs(offset);
    const sign = offset < 0 ? -1 : offset > 0 ? 1 : 0;
    const baseX = sign * (abs === 1 ? STEP * 1.1 : abs === 2 ? STEP * 2.0 : 0);
    const x = baseX + dragOffset * (1 - abs * 0.2);
    const scale = abs === 0 ? 1 : abs === 1 ? 0.86 : 0.74;
    const opacity = abs === 0 ? 1 : abs === 1 ? 0.72 : 0.4;
    const z = abs === 0 ? 0 : abs === 1 ? -60 : -140;
    const rotateY = sign * (abs === 1 ? 8 : 16);
    return {
      transform: `translateX(${x}px) translateZ(${z}px) rotateY(${rotateY}deg) scale(${scale})`,
      opacity, zIndex: 5 - abs,
      transition: dragStartX.current !== null ? 'none' : 'transform 0.45s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.45s ease',
    };
  };

  const visibleCards = [-2, -1, 0, 1, 2].map(offset => {
    const idx = ((activeIndex + offset) % creatives.length + creatives.length) % creatives.length;
    return { creative: creatives[idx], offset, idx };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
      <div ref={trackRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
        style={{ position: 'relative', height: '360px', width: '100%', perspective: '1400px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'grab', userSelect: 'none', touchAction: 'pan-y', willChange: 'transform' }}>
        {visibleCards.map(({ creative, offset, idx }) => (
          <div key={idx} onClick={() => handleCardClick(creative)} style={{ position: 'absolute', width: `${CARD_WIDTH}px`, cursor: creative?.id ? 'pointer' : 'default', ...getCardProps(offset) }}>
            <CreativeCard creative={creative} isCenter={offset === 0} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {creatives.map((_, i) => (
          <button key={i} type="button" onClick={() => { clearInterval(intervalRef.current); goTo(i); startAuto(); }}
            style={{
              width: i === activeIndex ? '24px' : '8px', height: '8px', borderRadius: '4px',
              border: i === activeIndex ? '1px solid rgba(29,185,84,0.45)' : '1px solid rgba(20,17,26,0.12)',
              cursor: 'pointer',
              background: i === activeIndex ? 'rgba(29,185,84,0.35)' : 'rgba(20,17,26,0.06)',
              boxShadow: i === activeIndex ? '0 2px 8px rgba(29,185,84,0.2)' : 'none',
              transition: 'all 0.3s ease', padding: 0,
            }} aria-label={i === activeIndex ? `Slide ${i + 1} of ${creatives.length}, current` : `Go to slide ${i + 1}`} />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [showEntrance, setShowEntrance] = useState(() => {
    try {
      return !sessionStorage.getItem('lt_entrance_played');
    } catch {
      return true;
    }
  });
  const [featuredCreatives, setFeaturedCreatives] = useState([]);
  const [eliteCreatives, setEliteCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => { fetchCreatives(); }, []);
  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768); }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchCreatives = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles').select('id, business_name, subscription_tier, skill_types, city, state, bio, avatar_url, tagline')
        .in('subscription_tier', ['elite', 'expert']).eq('is_admin', false).not('avatar_url', 'is', null)
        .order('subscription_tier', { ascending: false });
      if (error) throw error;
      const filteredProfiles = (data || []).filter((p) => String(p.avatar_url || '').trim() !== '');
      const ids = filteredProfiles.map(p => p.id);
      let reviewMap = {};
      if (ids.length > 0) {
        const { data: reviews } = await supabase.from('reviews').select('creative_id, rating').in('creative_id', ids);
        (reviews || []).forEach(r => {
          if (!reviewMap[r.creative_id]) reviewMap[r.creative_id] = { sum: 0, count: 0 };
          reviewMap[r.creative_id].sum += r.rating;
          reviewMap[r.creative_id].count += 1;
        });
      }
      const enriched = filteredProfiles.map(p => ({ ...p, avg_rating: reviewMap[p.id] ? (reviewMap[p.id].sum / reviewMap[p.id].count) : 0, review_count: reviewMap[p.id]?.count || 0 }));
      setFeaturedCreatives(enriched);
      setEliteCreatives(enriched.filter(c => c.subscription_tier === 'elite'));
    } catch (err) {
      console.error('Error fetching creatives:', err);
      setFeaturedCreatives([]);
      setEliteCreatives([]);
    } finally {
      setLoading(false);
    }
  };

  const sectionHeading = (text) => (
    <h2 style={{ fontSize: isMobile ? '28px' : '36px', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2, margin: '0 0 10px', fontFamily: FONT, color: TEXT_PRIMARY }}>{text}</h2>
  );

  const sectionSubtitle = (text) => (
    <p style={{ color: TEXT_SECONDARY, fontSize: '15px', fontWeight: 400, margin: 0, lineHeight: 1.6, fontFamily: FONT }}>{text}</p>
  );

  return (
    <div style={{ background: 'transparent', color: TEXT_PRIMARY, fontFamily: FONT, overflowX: 'hidden' }}>
      {showEntrance && <CinematicEntrance onComplete={() => setShowEntrance(false)} />}

      {/* HERO */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        minHeight: isMobile ? 'auto' : '520px',
        padding: isMobile ? '56px 20px 56px' : '0',
      }}>
        {!isMobile && <DriftingTiles />}
        {!isMobile && (
          <div aria-hidden style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: `linear-gradient(90deg, rgba(${PAGE_TONE},1) 0%, rgba(${PAGE_TONE},1) 32%, rgba(${PAGE_TONE},0.82) 50%, rgba(${PAGE_TONE},0.34) 78%, rgba(${PAGE_TONE},0.1) 100%)`,
          }} />
        )}

        <div style={{
          position: 'relative', zIndex: 2,
          maxWidth: isMobile ? '100%' : '620px',
          padding: isMobile ? '0' : '72px 40px',
          textAlign: isMobile ? 'center' : 'left',
          margin: isMobile ? '0 auto' : '0',
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a8478', marginBottom: '22px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: GREEN, display: 'inline-block', boxShadow: '0 0 6px rgba(29,185,84,0.6)' }} />
            Australia's creative platform · Live
          </div>

          <h1 style={{
            fontSize: isMobile ? 'clamp(38px, 12vw, 52px)' : 'clamp(48px, 5.5vw, 56px)',
            fontWeight: 600, lineHeight: 1.04, margin: '0 0 22px',
            letterSpacing: '-0.02em', fontFamily: FONT, color: TEXT_PRIMARY,
          }}>
            Connect. Capture.<br />
            <span style={{ fontFamily: SERIF, fontWeight: 400, fontStyle: 'italic', fontSize: '1.16em', letterSpacing: 0 }}>Create.</span>
          </h1>

          <p style={{ fontSize: isMobile ? '16px' : '15.5px', color: TEXT_SECONDARY, maxWidth: '440px', lineHeight: 1.6, fontWeight: 400, margin: isMobile ? '0 auto 30px' : '0 0 30px', fontFamily: FONT }}>
            Australia's home for visual creatives. No commissions, ever. Your marketplace profile, invoicing, contracts, portfolio, and client delivery. One subscription. Everything you need to run your creative business.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start' }}>
            <HeroSolidButton onClick={() => navigate('/join')}>Join as a Creative</HeroSolidButton>
            <HeroGlassButton onClick={() => navigate('/creatives')}>Find a Creative</HeroGlassButton>
            <HeroTextButton onClick={() => navigate('/jobs')}>Post a Job</HeroTextButton>
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '18px', marginTop: '34px',
            ...GLASS_CARD, borderRadius: '13px', padding: '13px 22px',
          }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 700, fontSize: '16px', color: TEXT_PRIMARY }}>0%</div><div style={{ fontSize: '11px', color: TEXT_MUTED, letterSpacing: '0.03em' }}>Commission</div></div>
            <div style={{ width: '1px', height: '26px', background: 'rgba(20,17,26,0.1)' }} />
            <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 700, fontSize: '16px', color: TEXT_PRIMARY }}>8</div><div style={{ fontSize: '11px', color: TEXT_MUTED, letterSpacing: '0.03em' }}>Creative types</div></div>
            <div style={{ width: '1px', height: '26px', background: 'rgba(20,17,26,0.1)' }} />
            <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 700, fontSize: '16px', color: TEXT_PRIMARY }}>AU</div><div style={{ fontSize: '11px', color: TEXT_MUTED, letterSpacing: '0.03em' }}>Australia-wide</div></div>
          </div>
        </div>
      </section>

      <div style={{ height: '1px', width: '100%', maxWidth: '960px', margin: '0 auto', background: DIVIDER_GRADIENT }} aria-hidden />

      {/* VALUE PROPS */}
      <section style={{ padding: isMobile ? '56px 16px 72px' : '80px 24px 96px', position: 'relative' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
          {[
            { title: 'No commissions, ever', desc: 'Keep 100% of what you earn. We charge a flat subscription, nothing more. No hidden fees, no surprises.' },
            { title: 'Built for Australian creatives', desc: 'Designed specifically for the Australian market. Find local clients, work with local businesses, grow locally.' },
            { title: 'Everything in one place', desc: 'Bookings, invoices, contracts, file delivery, CRM, portfolio. Your whole creative business, one platform.' },
          ].map(item => (
            <div key={item.title} style={{ ...GLASS_CARD_AURORA, padding: '28px 24px', fontFamily: FONT }}>
              <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.4, color: TEXT_PRIMARY, marginBottom: '10px' }}>{item.title}</div>
              <div style={{ fontSize: '14px', fontWeight: 400, color: TEXT_SECONDARY, lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: '1px', width: '100%', maxWidth: '1100px', margin: '0 auto', background: DIVIDER_GRADIENT }} aria-hidden />

      {/* FEATURED CREATIVES — only show if there are creatives */}
      {!loading && featuredCreatives.length > 0 && (
        <section style={{ padding: isMobile ? '56px 16px 72px' : '80px 24px 96px', position: 'relative' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              {sectionHeading('Featured Creatives')}
              {sectionSubtitle('Rotating selection of Expert and Elite tier creators')}
            </div>
            <FanCarousel creatives={featuredCreatives} />
          </div>
        </section>
      )}

      {(!loading && featuredCreatives.length > 0) && (
        <div style={{ height: '1px', width: '100%', maxWidth: '1100px', margin: '0 auto', background: DIVIDER_GRADIENT }} aria-hidden />
      )}

      {/* ELITE CREATIVES — only show if there are elite creatives */}
      {!loading && eliteCreatives.length > 0 && (
        <section style={{ padding: isMobile ? '56px 16px 72px' : '80px 24px 96px', position: 'relative' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              {sectionHeading('Meet Our Elite Creatives')}
              {sectionSubtitle('Handpicked excellence. The most accomplished and reviewed creatives on LensTrybe, always visible and ready to elevate your project.')}
            </div>
            <FanCarousel creatives={eliteCreatives} />
          </div>
        </section>
      )}

      {(!loading && eliteCreatives.length > 0) && (
        <div style={{ height: '1px', width: '100%', maxWidth: '1100px', margin: '0 auto', background: DIVIDER_GRADIENT }} aria-hidden />
      )}

      {/* BROWSE BY SPECIALTY */}
      <section style={{ padding: isMobile ? '56px 16px 72px' : '80px 24px 96px', position: 'relative' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            {sectionHeading('Browse by Specialty')}
            {sectionSubtitle('Find exactly the creative talent you need for your project')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, 1fr)', gap: '12px' }}>
            {CATEGORIES.map(cat => (
              <button key={cat.key} type="button" onClick={() => navigate(`/creatives?type=${cat.key}`)} style={{
                ...GLASS_CARD_AURORA,
                borderRadius: '14px',
                padding: isMobile ? '16px 12px' : '24px 16px',
                cursor: 'pointer', textAlign: 'left', color: TEXT_PRIMARY,
                minHeight: isMobile ? '140px' : '160px', display: 'flex', flexDirection: 'column',
                fontFamily: FONT, transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 18px 44px -14px rgba(40,30,60,0.28), inset 0 1px 0 rgba(255,255,255,0.9)';
                e.currentTarget.style.borderColor = 'rgba(20,17,26,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = GLASS_CARD.boxShadow;
                e.currentTarget.style.borderColor = 'rgba(20,17,26,0.07)';
              }}
              >
                <div style={{
                  width: isMobile ? '38px' : '44px', height: isMobile ? '38px' : '44px', borderRadius: '12px',
                  background: '#ffffff', border: '1px solid rgba(20,17,26,0.05)',
                  boxShadow: '0 6px 16px -6px rgba(40,30,60,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isMobile ? '12px' : '16px', color: TEXT_PRIMARY,
                }}>
                  {CATEGORY_ICONS[cat.key]}
                </div>
                <div style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: 600, letterSpacing: '-0.01em', marginBottom: '4px', lineHeight: 1.35, color: TEXT_PRIMARY }}>{cat.label}</div>
                <div style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: TEXT_MUTED, marginTop: 'auto', lineHeight: 1.6 }}>Browse all →</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        @keyframes ltHeroUp { from { transform: translateY(0); } to { transform: translateY(-864px); } }
        @keyframes ltHeroDown { from { transform: translateY(-864px); } to { transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
