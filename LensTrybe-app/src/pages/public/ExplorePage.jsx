import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { logSearchImpressions } from '../../lib/visibility'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import {
  GLASS_CARD,
  GLASS_NATIVE_FIELD,
  TYPO,
  glassCardAccentBorder,
  LIQUID_GLASS,
  LIQUID_GLASS_CARD,
  LIQUID_FIELD,
} from '../../lib/glassTokensLight'
import { LiquidLensFilter, LiquidSelect, LiquidPill } from '../../components/ui/liquidGlass'
import TileField from '../../components/ui/TileField'

const CATEGORIES = [
  { value: 'Photographer', label: 'Photographer' },
  { value: 'Videographer', label: 'Videographer' },
  { value: 'Drone Pilot', label: 'Drone Pilot' },
  { value: 'Video Editor', label: 'Video Editor' },
  { value: 'Photo Editor', label: 'Photo Editor' },
  { value: 'Social Media Manager', label: 'Social Media Manager' },
  { value: 'Hair & Makeup Artist', label: 'Hair & Makeup Artist' },
  { value: 'UGC Creator', label: 'UGC Creator' },
]

const SPECIALTIES = {
  'Photographer': ['Wedding', 'Portrait', 'Commercial', 'Real Estate', 'Events', 'Fashion', 'Product', 'Sports', 'Street', 'Architecture'],
  'Videographer': ['Wedding', 'Brand Film', 'Documentary', 'Events', 'Music Video', 'Social Media', 'Corporate', 'Sport'],
  'Drone Pilot': ['Real Estate', 'Cinematic', 'Surveying', 'Events', 'Agriculture', 'Construction', 'Infrastructure'],
  'Video Editor': ['Colour Grading', 'Short-form/Reels', 'Wedding Films', 'VFX', 'Motion Graphics', 'Corporate', 'Music Video'],
  'Photo Editor': ['Retouching', 'Culling', 'Compositing', 'Product Editing', 'Restoration', 'Fashion'],
  'Social Media Manager': ['Instagram & TikTok', 'Reels & Short-form', 'Brand Content', 'Content Strategy', 'YouTube Management', 'LinkedIn', 'Facebook & Meta'],
  'Hair & Makeup Artist': ['Bridal & Wedding', 'Editorial & Fashion', 'Commercial', 'Film & TV', 'Portrait & Headshots', 'Special Effects', 'Hair Styling', 'Airbrush', 'Natural & Lifestyle', 'Events'],
  'UGC Creator': ['E-commerce & Product', 'App & Software', 'Food & Beverage', 'Beauty & Skincare', 'Health & Fitness', 'Travel & Lifestyle', 'Fashion & Apparel', 'Home & Interiors', 'Unboxing & Reviews', 'Paid Ad Creative'],
}

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']
const TIER_ORDER = { elite: 0, expert: 1, pro: 2, basic: 3 }

/** Dark select styling for Find a Creative filters (matches page chrome). */
const SELECT_DARK = {
  background: '#ffffff',
  color: '#14111a',
  border: '1px solid rgba(20,17,26,0.12)',
  borderRadius: '10px',
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'var(--font-ui)',
  fontSize: '14px',
  fontWeight: 400,
  lineHeight: 1.6,
}
const SELECT_CLASS = 'explore-page-select'

function normaliseCity(value) {
  return (value || '').trim().toLowerCase()
}

function filterCreativesByLocationPreference(creatives, preference, f) {
  const pref = preference || 'australiaWide'
  return creatives.filter((p) => {
    if (pref === 'australiaWide') {
      // Show all tiers — higher tiers are already sorted to the top via TIER_ORDER
      return true
    }

    if (pref === 'local') {
      const searchCity = normaliseCity(f.city)
      const creativeCity = normaliseCity(p.city)
      if (!searchCity || creativeCity !== searchCity) return false
      // Show all tiers locally
      return true
    }

    if (pref === 'state') {
      const searchState = (f.state || '').trim().toUpperCase()
      const creativeState = (p.state || '').trim().toUpperCase()
      if (!searchState || creativeState !== searchState) return false
      // Show all tiers at state level
      return true
    }

    return true
  })
}

function CreativeCard({ profile, onClick }) {
  const [hovered, setHovered] = useState(false)

  const tierBadge = {
    elite: { label: 'Elite', color: '#EAB308', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)' },
    expert: { label: 'Expert', color: 'var(--green)', bg: 'var(--green-dim)', border: 'rgba(29,185,84,0.3)' },
    pro: { label: 'Pro', color: 'var(--green)', bg: 'var(--green-dim)', border: 'rgba(29,185,84,0.3)' },
    basic: null,
  }

  const badge = tierBadge[profile.subscription_tier?.toLowerCase()]
  const displayName = profile.business_name ?? profile.full_name ?? 'Creative'
  const skills = profile.skill_types ?? []

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...(hovered ? { ...LIQUID_GLASS_CARD, border: '1px solid rgba(29,185,84,0.5)' } : LIQUID_GLASS_CARD),
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform var(--transition-base), box-shadow var(--transition-base)',
        minWidth: 0,
      }}
    >
      {profile.avatar_url
        ? <img src={profile.avatar_url} alt={displayName} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
        : <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}></div>
      }
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...TYPO.heading }}>{displayName}</div>
          {badge && (
            <div style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, fontFamily: 'var(--font-ui)', flexShrink: 0 }}>
              {badge.label}
            </div>
          )}
        </div>
        {(profile.city || profile.state) && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[profile.city, profile.state].filter(Boolean).join(', ')}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {skills.slice(0, 2).map((s, i) => <Badge key={i} variant="default" size="sm">{s}</Badge>)}
          {skills.length > 2 && <Badge variant="default" size="sm">+{skills.length - 2}</Badge>}
        </div>
        {profile.founding_member && profile.show_founding_badge !== false && (
          <div style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'linear-gradient(90deg, rgba(29,185,84,0.15), rgba(234,179,8,0.15))', border: '1px solid rgba(234,179,8,0.3)', color: '#EAB308', fontFamily: 'var(--font-ui)', display: 'inline-block', width: 'fit-content' }}>
            ✦ Founding Member
          </div>
        )}
      </div>
    </div>
  )
}

/* A selected creative type shown as a green dropdown; opens a checkable list of
   that type's specialties (choose one or more), plus a Remove option. */
function TypeSpecialtyPicker({ type, specialties, selected, onChange, onRemove }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const count = selected.length
  const toggle = (s) => onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s])
  return (
    <div ref={ref} style={{ position: 'relative', flex: '0 0 auto' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ ...LIQUID_FIELD, width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderRadius: '999px', padding: '9px 16px', fontWeight: 600, color: '#0f7a37', border: '1px solid rgba(29,185,84,0.4)', background: 'linear-gradient(135deg, rgba(29,185,84,0.18) 0%, rgba(29,185,84,0.06) 100%)' }}>
        <span style={{ whiteSpace: 'nowrap' }}>{type}{count > 0 ? ` · ${count}` : ''}</span>
        <span style={{ fontSize: '10px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 40, minWidth: '230px', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(22px) saturate(140%)', WebkitBackdropFilter: 'blur(22px) saturate(140%)', border: '1px solid rgba(20,17,26,0.08)', borderRadius: '16px', boxShadow: '0 24px 54px -16px rgba(40,30,60,0.32)', padding: '6px', maxHeight: '288px', overflowY: 'auto' }}>
          <div style={{ padding: '6px 11px 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8995' }}>{type} specialties</div>
          {specialties.map(s => {
            const on = selected.includes(s)
            return (
              <div key={s} onClick={() => toggle(s)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 11px', borderRadius: '11px', cursor: 'pointer', fontSize: '14px', fontFamily: "'Inter', sans-serif", color: '#14111a', background: on ? 'rgba(29,185,84,0.1)' : 'transparent' }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'rgba(20,17,26,0.05)' }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent' }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '5px', border: `1.5px solid ${on ? '#1DB954' : 'rgba(20,17,26,0.25)'}`, background: on ? '#1DB954' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {on && <span style={{ color: '#fff', fontSize: '11px', lineHeight: 1 }}>✓</span>}
                </span>
                {s}
              </div>
            )
          })}
          <div style={{ height: '1px', background: 'rgba(20,17,26,0.08)', margin: '6px 4px' }} />
          <div onClick={onRemove} style={{ padding: '9px 11px', borderRadius: '11px', cursor: 'pointer', fontSize: '13px', fontFamily: "'Inter', sans-serif", color: '#b4232a', fontWeight: 500 }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(180,35,42,0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            Remove {type}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExplorePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [creatives, setCreatives] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState([])
  const [specialtiesByType, setSpecialtiesByType] = useState({})
  const [filters, setFilters] = useState({
    state: '',
    city: '',
    name: '',
  })

  function setSpecialtiesForType(type, arr) {
    setSpecialtiesByType(prev => ({ ...prev, [type]: arr }))
  }

  useEffect(() => {
    const type = searchParams.get('type')
    const qState = searchParams.get('state') || ''
    const qCity = searchParams.get('city') || ''
    const qName = searchParams.get('name') || ''
    if (!type && !qState && !qCity && !qName) return
    const nextFilters = { ...filters, state: qState, city: qCity, name: qName }
    let types = selectedTypes
    if (type) {
      const label = CATEGORIES.find(c => c.value === type)?.label ?? type
      types = [label]
      setSelectedTypes([label])
    }
    setFilters(nextFilters)
    handleSearch(types, nextFilters)
  }, [])

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function toggleType(value) {
    setSelectedTypes(prev =>
      prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
    )
    setSpecialtiesByType(prev => {
      const next = { ...prev }
      if (next[value]) delete next[value]
      else next[value] = []
      return next
    })
  }

  function updateFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  async function handleSearch(types = selectedTypes, currentFilters = filters, spByType = specialtiesByType) {
    setLoading(true)
    setSearched(true)

    let query = supabase.from('profiles').select('*').eq('is_admin', false)

    if (types.length > 0) {
      query = query.overlaps('skill_types', types)
    }

    const specialties = Object.values(spByType).flat()
    if (specialties.length > 0) {
      query = query.overlaps('specialties', specialties)
    }

    if (currentFilters.state) query = query.eq('state', currentFilters.state)
    if (currentFilters.city) query = query.ilike('city', `%${currentFilters.city}%`)
    if (currentFilters.name) {
      query = query.or(`business_name.ilike.%${currentFilters.name}%,business_email.ilike.%${currentFilters.name}%`)
    }

    const { data } = await query.limit(48)

    const sorted = (data ?? []).sort((a, b) => {
      const aOrder = TIER_ORDER[a.subscription_tier?.toLowerCase()] ?? 4
      const bOrder = TIER_ORDER[b.subscription_tier?.toLowerCase()] ?? 4
      return aOrder - bOrder
    })

    setCreatives(sorted)
    void logSearchImpressions(sorted.map((p) => p.id))
    setLoading(false)
  }

  const styles = {
    page: { background: 'transparent', minHeight: '100vh', paddingBottom: '80px', position: 'relative', overflow: 'hidden' },
    inner: { maxWidth: '1280px', margin: '0 auto', padding: isMobile ? '0 16px' : '0 40px', position: 'relative', zIndex: 2 },
    header: { padding: isMobile ? '32px 0 24px' : '48px 0 32px' },
    title: { fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.04, fontSize: 'clamp(34px, 4.4vw, 60px)', color: 'var(--text-primary)', marginBottom: '10px' },
    subtitle: { fontSize: '16px', color: 'var(--text-secondary)', ...TYPO.body },
    filterCard: { ...LIQUID_GLASS, position: 'relative', zIndex: 1, padding: isMobile ? '16px' : '28px', marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '20px' },
    filterSection: { display: 'flex', flexDirection: 'column', gap: '10px' },
    filterLabel: { fontSize: '11px', ...TYPO.label },
    typeGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    typeChip: (selected) => ({
      padding: '7px 16px',
      ...(selected ? glassCardAccentBorder('var(--green)') : GLASS_CARD),
      borderRadius: 'var(--radius-full)',
      background: selected
        ? 'linear-gradient(135deg, rgba(29,185,84,0.14) 0%, rgba(29,185,84,0.05) 100%)'
        : GLASS_CARD.background,
      color: selected ? 'var(--green)' : 'var(--text-secondary)',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      fontFamily: 'var(--font-ui)',
      ...TYPO.body,
      fontWeight: selected ? 500 : 400,
    }),
    filterRow: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '16px', alignItems: 'flex-end' },
    select: { ...SELECT_DARK, padding: '10px 14px', cursor: 'pointer', width: '100%' },
    textInput: { ...GLASS_NATIVE_FIELD, padding: '10px 14px', width: '100%' },
    filterGroupInner: { display: 'flex', flexDirection: 'column', gap: '6px' },
    resultsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' },
    resultsCount: { fontSize: '14px', color: 'var(--text-muted)', ...TYPO.body },
    grid: { display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(160px, 1fr))' : 'repeat(4, 1fr)', gap: isMobile ? '12px' : '16px' },
    emptyState: { padding: '80px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
    emptyTitle: { fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', ...TYPO.heading },
    emptyText: { fontSize: '14px', color: 'var(--text-muted)', maxWidth: '360px', ...TYPO.body },
  }

  return (
    <div style={styles.page} className="explore-page-root">
      <LiquidLensFilter />
      {!isMobile && <TileField animated={false} opacity={0.22} />}
      {!isMobile && (
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '200px', zIndex: 1, background: 'linear-gradient(180deg, rgba(246,245,243,0.9) 0%, rgba(246,245,243,0.5) 55%, rgba(246,245,243,0) 100%)' }} />
      )}
      <style>{`
        .${SELECT_CLASS},
        .${SELECT_CLASS} option {
          background: #ffffff;
          color: #14111a;
          border: 1px solid rgba(20,17,26,0.12);
        }
        .${SELECT_CLASS} {
          color-scheme: light;
        }
        .${SELECT_CLASS}:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
      `}</style>
      <div style={styles.inner}>
        <div style={styles.header}>
          <h1 style={styles.title}>Find a Creative</h1>
          <p style={styles.subtitle}>Discover photographers, videographers and visual creatives across Australia.</p>
        </div>

        <div style={styles.filterCard}>
          <div style={styles.filterSection}>
            <div style={styles.filterLabel}>Creative type: select one or more</div>
            {isMobile ? (
              <select
                className={SELECT_CLASS}
                value={selectedTypes[0] || ''}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedTypes(val ? [val] : [])
                  setSpecialtiesByType(val ? { [val]: [] } : {})
                }}
                aria-label="Creative type"
                style={{ ...styles.select, width: '100%' }}
              >
                <option value="">All creative types</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            ) : (
              <div style={styles.typeGrid}>
                {CATEGORIES.map((cat) => (
                  selectedTypes.includes(cat.value) ? (
                    <TypeSpecialtyPicker
                      key={cat.value}
                      type={cat.value}
                      specialties={SPECIALTIES[cat.value] ?? []}
                      selected={specialtiesByType[cat.value] ?? []}
                      onChange={(arr) => setSpecialtiesForType(cat.value, arr)}
                      onRemove={() => toggleType(cat.value)}
                    />
                  ) : (
                    <LiquidPill
                      key={cat.value}
                      onClick={() => toggleType(cat.value)}
                      style={{ flex: '0 0 auto', padding: '9px 18px', fontSize: '13px', fontWeight: 500, color: '#565560' }}
                    >
                      {cat.label}
                    </LiquidPill>
                  )
                ))}
              </div>
            )}
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' }}>
              Pick a creative type, then choose its specialties.
            </div>
          </div>

          <div style={styles.filterRow}>
            <div style={styles.filterGroupInner}>
              <label style={styles.filterLabel}>State</label>
              <LiquidSelect
                value={filters.state}
                onChange={(v) => updateFilter('state', v)}
                ariaLabel="State"
                placeholder="All states"
                style={{ flex: '1 1 100%' }}
                options={[{ value: '', label: 'All states' }, ...AU_STATES.map(s => ({ value: s, label: s }))]}
              />
            </div>
            <div style={styles.filterGroupInner}>
              <label style={styles.filterLabel}>City</label>
              <input style={{ ...LIQUID_FIELD, flex: '1 1 100%' }} placeholder="e.g. Brisbane" value={filters.city} onChange={e => updateFilter('city', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <div style={styles.filterGroupInner}>
              <label style={styles.filterLabel}>Name Search</label>
              <input style={{ ...LIQUID_FIELD, flex: '1 1 100%' }} placeholder="Search by name…" value={filters.name} onChange={e => updateFilter('name', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => handleSearch()} disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </Button>
            {(selectedTypes.length > 0 || filters.state || filters.city || filters.name) && (
              <Button variant="ghost" size="sm" onClick={() => { setSelectedTypes([]); setSpecialtiesByType({}); setFilters({ state: '', city: '', name: '' }); setSearched(false); setCreatives([]) }}>
                Clear all
              </Button>
            )}
            {selectedTypes.length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                {selectedTypes.length} type{selectedTypes.length > 1 ? 's' : ''} selected
              </div>
            )}
          </div>
        </div>

        {!searched ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '32px' }}></div>
            <div style={styles.emptyTitle}>Search for creatives above</div>
            <div style={styles.emptyText}>Select a creative type, filter by location and hit Search to find the right person for your project.</div>
            <Button variant="secondary" onClick={() => handleSearch()}>Browse All Creatives</Button>
          </div>
        ) : loading ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '32px' }}></div>
            <div style={styles.emptyTitle}>Searching…</div>
          </div>
        ) : creatives.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '32px' }}></div>
            <div style={styles.emptyTitle}>No creatives found</div>
            <div style={styles.emptyText}>Try adjusting your filters or searching a different location.</div>
            <Button variant="secondary" onClick={() => { setSelectedTypes([]); setSpecialtiesByType({}); setFilters({ state: '', city: '', name: '' }); handleSearch([], { state: '', city: '', name: '' }, {}) }}>
              Clear Filters & Browse All
            </Button>
          </div>
        ) : (
          <>
            <div style={styles.resultsHeader}>
              <div style={styles.resultsCount}>{creatives.length} creative{creatives.length !== 1 ? 's' : ''} found, sorted by tier</div>
            </div>
            <div style={styles.grid}>
              {creatives.map(profile => (
                <CreativeCard
                  key={profile.id}
                  profile={profile}
                  onClick={() => navigate(`/creatives/${profile.id}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
