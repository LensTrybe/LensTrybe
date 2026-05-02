import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Button from '../../components/ui/Button';
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

const IconCamera = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>);
const IconVideo = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>);
const IconDrone = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 4l4 4m8-4l-4 4m4 8l4 4m-12 0l4-4"/><circle cx="4" cy="4" r="1.5"/><circle cx="20" cy="4" r="1.5"/><circle cx="4" cy="20" r="1.5"/><circle cx="20" cy="20" r="1.5"/></svg>);
const IconEdit = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>);
const IconPhoto = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>);
const IconShare = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>);
const IconMakeup = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>);
const IconPhone = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>);
const IconStar = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>);
const IconPin = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>);

const CATEGORY_ICONS = {
  photographer: <IconCamera />, videographer: <IconVideo />, drone_pilot: <IconDrone />,
  video_editor: <IconEdit />, photo_editor: <IconPhoto />, social_media_manager: <IconShare />,
  hair_makeup_artist: <IconMakeup />, ugc_creator: <IconPhone />,
};

const FONT = "'Inter', sans-serif";
const GREEN = '#1DB954';
const PINK = '#FF2D78';

const GLASS_CARD = {
  backdropFilter: 'blur(40px) saturate(200%) brightness(1.1)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(1.1)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderTop: '1px solid rgba(255,255,255,0.2)',
  borderLeft: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '20px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
};

const GLASS_CARD_GREEN = {
  backdropFilter: 'blur(40px) saturate(200%) brightness(1.1)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(1.1)',
  background: 'linear-gradient(135deg, rgba(29,185,84,0.18) 0%, rgba(29,185,84,0.06) 100%)',
  border: '1px solid rgba(29,185,84,0.35)',
  borderTop: '1px solid rgba(29,185,84,0.5)',
  borderLeft: '1px solid rgba(29,185,84,0.4)',
  borderRadius: '20px',
  boxShadow: '0 8px 32px rgba(29,185,84,0.15), inset 0 1px 0 rgba(29,185,84,0.2)',
};

const DIVIDER_GRADIENT = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)';

function GlowBlob({ color, top, left, right, bottom, size = 400, opacity = 0.07 }) {
  return (
    <div style={{
      position: 'absolute',
      top, left, right, bottom,
      width: size, height: size,
      borderRadius: '50%',
      background: `radial-gradient(ellipse, ${color} 0%, transparent 70%)`,
      opacity,
      pointerEvents: 'none',
      transform: 'translate(-50%, -50%)',
    }} />
  );
}

function CreativeCard({ creative, isCenter }) {
  const tierColor = creative.subscription_tier === 'elite' ? '#F59E0B' : '#A855F7';
  const tierLabel = creative.subscription_tier === 'elite' ? '⭐ ELITE' : 'EXPERT';
  const skillLabel = (creative.skill_types?.[0] ?? '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Creative';
  const location = [creative.city, creative.state].filter(Boolean).join(', ');
  return (
    <div style={{
      ...(isCenter ? GLASS_CARD_GREEN : GLASS_CARD),
      padding: '0 16px 16px', minWidth: '240px',
      pointerEvents: 'none', fontFamily: FONT,
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <span style={{
          fontSize: '10px', fontWeight: 600, letterSpacing: '-0.2px', lineHeight: 1.6, color: tierColor,
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          background: tierColor === '#F59E0B' ? 'rgba(245,158,11,0.15)' : 'rgba(168,85,247,0.15)',
          border: `1px solid ${tierColor === '#F59E0B' ? 'rgba(245,158,11,0.3)' : 'rgba(168,85,247,0.3)'}`,
          borderTop: `1px solid ${tierColor === '#F59E0B' ? 'rgba(245,158,11,0.42)' : 'rgba(168,85,247,0.42)'}`,
          borderRadius: '20px', padding: '3px 10px',
        }}
        >{tierLabel}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 8px' }}>
        {creative.avatar_url
          ? <img src={creative.avatar_url} alt={creative.business_name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: isCenter ? '2px solid rgba(29,185,84,0.5)' : '2px solid rgba(255,255,255,0.1)' }} />
          : <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(29,185,84,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', border: isCenter ? '2px solid rgba(29,185,84,0.5)' : '2px solid rgba(255,255,255,0.1)' }}>📷</div>
        }
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.3px', lineHeight: 1.6, color: '#fff', textAlign: 'center', marginBottom: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{creative.business_name}</div>
      <div style={{ fontSize: '12px', fontWeight: 400, lineHeight: 1.6, color: GREEN, textAlign: 'center', marginBottom: '10px' }}>{skillLabel}</div>
      {location && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', marginBottom: '10px' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', display: 'flex' }}><IconPin /></span>
          <span style={{ fontSize: '12px', fontWeight: 400, lineHeight: 1.6, color: 'rgba(255,255,255,0.65)' }}>{location}</span>
        </div>
      )}
      {creative.bio && isCenter && (
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 1.6, fontWeight: 400, marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{creative.bio}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
        <span style={{ color: '#F59E0B', display: 'flex' }}><IconStar /></span>
        <span style={{ fontSize: '13px', color: '#fff', fontWeight: 700, letterSpacing: '-1px', lineHeight: 1.6 }}>{Number(creative.avg_rating || 0).toFixed(1)}</span>
        <span style={{ fontSize: '12px', fontWeight: 400, lineHeight: 1.6, color: 'rgba(255,255,255,0.35)' }}>({creative.review_count || 0})</span>
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

  const onPointerDown = (e) => { dragStartX.current = e.clientX; dragDelta.current = 0; clearInterval(intervalRef.current); };
  const onPointerMove = (e) => { if (dragStartX.current === null) return; dragDelta.current = e.clientX - dragStartX.current; setDragOffset(dragDelta.current); };
  const onPointerUp = () => {
    if (dragStartX.current === null) return;
    if (dragDelta.current < -60) next();
    else if (dragDelta.current > 60) prev();
    else setDragOffset(0);
    dragStartX.current = null;
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
        style={{ position: 'relative', height: '360px', width: '100%', perspective: '1400px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'grab', userSelect: 'none' }}>
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
              border: i === activeIndex ? '1px solid rgba(29,185,84,0.45)' : '1px solid rgba(255,255,255,0.12)',
              cursor: 'pointer',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              background: i === activeIndex ? 'linear-gradient(135deg, rgba(29,185,84,0.35), rgba(29,185,84,0.15))' : 'rgba(255,255,255,0.06)',
              boxShadow: i === activeIndex ? '0 2px 8px rgba(29,185,84,0.2), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
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
  const heroCanvasRef = useRef(null);
  const heroSectionRef = useRef(null);

  useEffect(() => { fetchCreatives(); }, []);
  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768); }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const canvas = heroCanvasRef.current;
    const hero = heroSectionRef.current;
    if (!canvas || !hero) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = ['#FF4D8D', '#1DB954', '#ffffff', '#a855f7'];
    const particles = [];
    let rafId = 0;
    let running = true;
    let lastSpawn = 0;

    const random = (min, max) => Math.random() * (max - min) + min;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = hero.clientWidth;
      const height = hero.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnParticle = () => {
      const width = hero.clientWidth;
      const height = hero.clientHeight;
      particles.push({
        x: random(0, width),
        y: random(height * 0.88, height + 6),
        size: random(0.5, 2),
        alpha: random(0.3, 0.6),
        speedY: random(0.15, 0.45),
        speedX: random(-0.12, 0.12),
        color: colors[Math.floor(random(0, colors.length))],
      });
    };

    resizeCanvas();
    for (let i = 0; i < 80; i += 1) spawnParticle();

    const draw = (time) => {
      if (!running) return;
      const width = hero.clientWidth;
      const height = hero.clientHeight;
      ctx.clearRect(0, 0, width, height);

      if (time - lastSpawn > 50 && particles.length < 220) {
        spawnParticle();
        lastSpawn = time;
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.y -= p.speedY;
        p.x += p.speedX;
        const progress = Math.max(0, Math.min(1, p.y / height));
        const fade = progress * progress;
        ctx.globalAlpha = p.alpha * fade;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        if (p.y < -6 || p.x < -20 || p.x > width + 20) particles.splice(i, 1);
      }
      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    window.addEventListener('resize', resizeCanvas);
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
    };
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
    <h2 style={{ fontSize: isMobile ? '28px' : '36px', fontWeight: 600, letterSpacing: '-0.3px', lineHeight: 1.6, margin: '0 0 10px', fontFamily: FONT, color: '#fff' }}>{text}</h2>
  );

  const sectionSubtitle = (text) => (
    <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '15px', fontWeight: 400, margin: 0, lineHeight: 1.6, fontFamily: FONT }}>{text}</p>
  );

  return (
    <div style={{ background: 'transparent', color: '#fff', fontFamily: FONT, overflowX: 'hidden' }}>
      {showEntrance && <CinematicEntrance onComplete={() => setShowEntrance(false)} />}

      {/* HERO */}
      <section ref={heroSectionRef} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: isMobile ? '72px 16px 64px' : '120px 24px 100px',
        position: 'relative', overflow: 'hidden',
      }}>
        <canvas
          ref={heroCanvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
        />
        <GlowBlob color={`rgba(29,185,84,0.5)`} top="40%" left="50%" size={700} opacity={0.08} />
        <GlowBlob color={`rgba(255,45,120,0.5)`} top="20%" left="15%" size={400} opacity={0.07} />
        <GlowBlob color={`rgba(29,185,84,0.5)`} top="70%" left="80%" size={350} opacity={0.06} />

        <div style={{ position: 'relative', zIndex: 1 }}>
        <h1 style={{
          fontSize: isMobile ? 'clamp(36px, 11vw, 52px)' : 'clamp(52px, 6vw, 80px)',
          fontWeight: 700, lineHeight: 1.0, margin: isMobile ? '0 0 24px' : '0 0 28px',
          letterSpacing: '-0.5px', fontFamily: FONT,
          whiteSpace: isMobile ? 'normal' : 'nowrap',
        }}>
          <span style={{ color: PINK }}>Connect.</span>{' '}
          <span style={{ color: '#C0C8D8' }}>Capture.</span>{' '}
          <span style={{ color: GREEN, textShadow: `0 0 60px rgba(29,185,84,0.5), 0 0 120px rgba(29,185,84,0.2)` }}>Create</span>
        </h1>

        <p style={{ fontSize: isMobile ? '16px' : '18px', color: 'rgba(255,255,255,0.85)', maxWidth: '640px', lineHeight: 1.6, fontWeight: 400, margin: '0 auto', fontFamily: FONT, textAlign: 'center' }}>
          Australia's home for visual creatives. No commissions, ever. Your marketplace profile, invoicing, contracts, portfolio, and client delivery. One subscription. Everything you need to run your creative business.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', width: isMobile ? '100%' : 'auto' }}>
          <Button variant="primary" size="lg" onClick={() => navigate('/join')} style={{ minHeight: '44px', width: isMobile ? '100%' : 'auto' }}>Join as a Creative</Button>
          <Button variant="ghost" size="lg" onClick={() => navigate('/creatives')} style={{ minHeight: '44px', width: isMobile ? '100%' : 'auto' }}>Find a Creative</Button>
          <Button variant="ghost" size="lg" onClick={() => navigate('/jobs')} style={{ minHeight: '44px', width: isMobile ? '100%' : 'auto' }}>Post a Job</Button>
        </div>
        </div>
      </section>

      <div style={{ height: '1px', width: '100%', maxWidth: '960px', margin: '0 auto', background: DIVIDER_GRADIENT }} aria-hidden />

      {/* VALUE PROPS */}
      <section style={{ padding: isMobile ? '0 16px 72px' : '0 24px 96px', position: 'relative' }}>
        <GlowBlob color={`rgba(255,45,120,0.5)`} top="50%" left="10%" size={500} opacity={0.05} />
        <GlowBlob color={`rgba(29,185,84,0.5)`} top="50%" left="90%" size={400} opacity={0.05} />
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
          {[
            { icon: '🚫', title: 'No commissions, ever', desc: 'Keep 100% of what you earn. We charge a flat subscription, nothing more. No hidden fees, no surprises.' },
            { icon: '🇦🇺', title: 'Built for Australian creatives', desc: 'Designed specifically for the Australian market. Find local clients, work with local businesses, grow locally.' },
            { icon: '⚡', title: 'Everything in one place', desc: 'Bookings, invoices, contracts, file delivery, CRM, portfolio. Your whole creative business, one platform.' },
          ].map(item => (
            <div key={item.title} style={{ ...GLASS_CARD, padding: '28px 24px', fontFamily: FONT }}>
              <div style={{ fontSize: '28px', marginBottom: '14px', lineHeight: 1 }}>{item.icon}</div>
              <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.3px', lineHeight: 1.6, color: '#fff', marginBottom: '10px' }}>{item.title}</div>
              <div style={{ fontSize: '14px', fontWeight: 400, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: '1px', width: '100%', maxWidth: '1100px', margin: '0 auto', background: DIVIDER_GRADIENT }} aria-hidden />

      {/* FEATURED CREATIVES — only show if there are creatives */}
      {!loading && featuredCreatives.length > 0 && (
        <section style={{ padding: isMobile ? '0 16px 72px' : '0 24px 96px', position: 'relative' }}>
          <GlowBlob color={`rgba(29,185,84,0.5)`} top="50%" left="50%" size={800} opacity={0.05} />
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
        <section style={{ padding: isMobile ? '0 16px 72px' : '0 24px 96px', position: 'relative' }}>
          <GlowBlob color={`rgba(255,45,120,0.5)`} top="30%" left="20%" size={500} opacity={0.05} />
          <GlowBlob color={`rgba(29,185,84,0.5)`} top="70%" left="80%" size={400} opacity={0.05} />
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
      <section style={{ padding: isMobile ? '0 16px 72px' : '0 24px 96px', position: 'relative' }}>
        <GlowBlob color={`rgba(29,185,84,0.5)`} top="50%" left="50%" size={700} opacity={0.05} />
        <GlowBlob color={`rgba(255,45,120,0.5)`} top="20%" left="80%" size={350} opacity={0.05} />
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            {sectionHeading('Browse by Specialty')}
            {sectionSubtitle('Find exactly the creative talent you need for your project')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, 1fr)', gap: '12px' }}>
            {CATEGORIES.map(cat => (
              <button key={cat.key} type="button" onClick={() => navigate(`/creatives?type=${cat.key}`)} style={{
                ...GLASS_CARD,
                borderRadius: '12px',
                padding: isMobile ? '16px 12px' : '24px 16px',
                cursor: 'pointer', textAlign: 'left', color: '#fff',
                minHeight: isMobile ? '140px' : '160px', display: 'flex', flexDirection: 'column',
                fontFamily: FONT, transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)';
              }}
              onMouseLeave={(e) => {
                const s = e.currentTarget.style;
                s.background = GLASS_CARD.background;
                s.backdropFilter = GLASS_CARD.backdropFilter;
                s.webkitBackdropFilter = GLASS_CARD.WebkitBackdropFilter;
                s.border = GLASS_CARD.border;
                s.borderTop = GLASS_CARD.borderTop;
                s.borderLeft = GLASS_CARD.borderLeft;
                s.borderRadius = '12px';
                s.boxShadow = GLASS_CARD.boxShadow;
                s.transform = '';
              }}
              >
                <div style={{
                  width: isMobile ? '36px' : '40px', height: isMobile ? '36px' : '40px', borderRadius: '10px',
                  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '1px solid rgba(255,255,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isMobile ? '10px' : '14px', color: 'rgba(255,255,255,0.85)',
                }}>
                  {CATEGORY_ICONS[cat.key]}
                </div>
                <div style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: 600, letterSpacing: '-0.3px', marginBottom: '4px', lineHeight: 1.35 }}>{cat.label}</div>
                <div style={{ fontSize: '13px', fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginTop: 'auto', lineHeight: 1.6 }}>Browse all →</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
