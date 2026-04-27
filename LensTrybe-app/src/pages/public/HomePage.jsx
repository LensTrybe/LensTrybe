import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

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
const BG = '#080810';

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
      background: isCenter ? 'linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' : '#13131f',
      border: isCenter ? '1px solid rgba(29,185,84,0.4)' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: '20px', padding: '0 16px 16px', minWidth: '240px',
      boxShadow: isCenter ? '0 24px 64px rgba(29,185,84,0.2), 0 0 40px rgba(29,185,84,0.1)' : '0 4px 20px rgba(0,0,0,0.4)',
      pointerEvents: 'none', fontFamily: FONT,
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <span style={{ fontSize: '10px', fontWeight: '700', color: tierColor, background: `${tierColor}1A`, border: `1px solid ${tierColor}40`, borderRadius: '20px', padding: '3px 10px', letterSpacing: '0.05em' }}>{tierLabel}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 8px' }}>
        {creative.avatar_url
          ? <img src={creative.avatar_url} alt={creative.business_name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: isCenter ? '2px solid rgba(29,185,84,0.5)' : '2px solid rgba(255,255,255,0.1)' }} />
          : <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(29,185,84,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', border: isCenter ? '2px solid rgba(29,185,84,0.5)' : '2px solid rgba(255,255,255,0.1)' }}>📷</div>
        }
      </div>
      <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', textAlign: 'center', marginBottom: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{creative.business_name}</div>
      <div style={{ fontSize: '12px', color: GREEN, textAlign: 'center', marginBottom: '10px' }}>{skillLabel}</div>
      {location && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', marginBottom: '10px' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', display: 'flex' }}><IconPin /></span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{location}</span>
        </div>
      )}
      {creative.bio && isCenter && (
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: '1.5', marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{creative.bio}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
        <span style={{ color: '#F59E0B', display: 'flex' }}><IconStar /></span>
        <span style={{ fontSize: '13px', color: '#fff', fontWeight: '600' }}>{Number(creative.avg_rating || 0).toFixed(1)}</span>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>({creative.review_count || 0})</span>
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
            style={{ width: i === activeIndex ? '24px' : '8px', height: '8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: i === activeIndex ? GREEN : 'rgba(255,255,255,0.25)', transition: 'all 0.3s ease', padding: 0 }} aria-label={i === activeIndex ? `Slide ${i + 1} of ${creatives.length}, current` : `Go to slide ${i + 1}`} />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
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
        .in('subscription_tier', ['elite', 'expert']).or('is_admin.is.null,is_admin.eq.false').not('avatar_url', 'is', null)
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
    <h2 style={{ fontSize: isMobile ? '28px' : '36px', fontWeight: '700', margin: '0 0 10px', fontFamily: FONT, color: '#fff', letterSpacing: '-0.02em' }}>{text}</h2>
  );

  const sectionSubtitle = (text) => (
    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', margin: 0, lineHeight: 1.6, fontFamily: FONT }}>{text}</p>
  );

  return (
    <div style={{ background: BG, color: '#fff', fontFamily: FONT, overflowX: 'hidden' }}>

      {/* HERO */}
      <section style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: isMobile ? '72px 16px 64px' : '120px 24px 100px',
        position: 'relative', overflow: 'hidden',
      }}>
        <GlowBlob color={`rgba(29,185,84,0.5)`} top="40%" left="50%" size={700} opacity={0.08} />
        <GlowBlob color={`rgba(255,45,120,0.5)`} top="20%" left="15%" size={400} opacity={0.07} />
        <GlowBlob color={`rgba(29,185,84,0.5)`} top="70%" left="80%" size={350} opacity={0.06} />

        <h1 style={{
          fontSize: isMobile ? 'clamp(36px, 11vw, 52px)' : 'clamp(52px, 6vw, 80px)',
          fontWeight: '800', lineHeight: 1.0, margin: isMobile ? '0 0 24px' : '0 0 28px',
          letterSpacing: '-0.03em', fontFamily: FONT,
          whiteSpace: isMobile ? 'normal' : 'nowrap',
        }}>
          <span style={{ color: PINK }}>Connect.</span>{' '}
          <span style={{ color: '#C0C8D8' }}>Capture.</span>{' '}
          <span style={{ color: GREEN, textShadow: `0 0 60px rgba(29,185,84,0.5), 0 0 120px rgba(29,185,84,0.2)` }}>Create</span>
        </h1>

        <p style={{ fontSize: isMobile ? '16px' : '18px', color: 'rgba(192,200,216,0.8)', maxWidth: '520px', lineHeight: '1.7', margin: '0 0 44px', fontFamily: FONT }}>
          Australia's home for visual creatives. Showcase your work, connect with clients, and build a career on your own terms.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', width: isMobile ? '100%' : 'auto' }}>
          <button type="button" onClick={() => navigate('/join')} style={{ background: GREEN, color: '#000', border: 'none', borderRadius: '100px', padding: '14px 28px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', boxShadow: `0 0 24px rgba(29,185,84,0.35)`, minHeight: '44px', width: isMobile ? '100%' : 'auto', fontFamily: FONT }}>Join as a Creative</button>
          <button type="button" onClick={() => navigate('/creatives')} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '100px', padding: '14px 28px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', minHeight: '44px', width: isMobile ? '100%' : 'auto', fontFamily: FONT }}>Find a Creative</button>
          <button type="button" onClick={() => navigate('/jobs')} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '100px', padding: '14px 28px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', minHeight: '44px', width: isMobile ? '100%' : 'auto', fontFamily: FONT }}>Post a Job</button>
        </div>
      </section>

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
            <div key={item.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '28px 24px', fontFamily: FONT }}>
              <div style={{ fontSize: '28px', marginBottom: '14px' }}>{item.icon}</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '10px' }}>{item.title}</div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

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
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px', padding: isMobile ? '16px 12px' : '24px 16px',
                cursor: 'pointer', textAlign: 'left', color: '#fff',
                minHeight: isMobile ? '140px' : '160px', display: 'flex', flexDirection: 'column',
                fontFamily: FONT, transition: 'all 0.2s ease',
              }}>
                <div style={{ width: isMobile ? '36px' : '40px', height: isMobile ? '36px' : '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isMobile ? '10px' : '14px', color: 'rgba(255,255,255,0.7)' }}>
                  {CATEGORY_ICONS[cat.key]}
                </div>
                <div style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '600', marginBottom: '4px', lineHeight: 1.35 }}>{cat.label}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: 'auto' }}>Browse all →</div>
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
