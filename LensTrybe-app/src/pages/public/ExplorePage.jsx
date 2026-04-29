import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'

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

function normaliseCity(value) {
  return (value || '').trim().toLowerCase()
}

function filterCreativesByLocationPreference(creatives, preference, f) {
  const pref = preference || 'australiaWide'
  return creatives.filter((p) => {
    const t = (p.subscription_tier || 'basic').toLowerCase()
    const isBasic = t === 'basic'
    const isPro = t === 'pro'
    const isHigh = t === 'expert' || t === 'elite'

    if (pref === 'australiaWide') {
      return isHigh
    }

    if (pref === 'local') {
      const searchCity = normaliseCity(f.city)
      const creativeCity = normaliseCity(p.city)
      if (!searchCity || creativeCity !== searchCity) return false
      return isBasic || isPro || isHigh
    }

    if (pref === 'state') {
      const searchState = (f.state || '').trim().toUpperCase()
      const creativeState = (p.state || '').trim().toUpperCase()
      if (!searchState || creativeState !== searchState) return false
      return isPro || isHigh
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
        background: hovered ? 'var(--bg-overlay)' : 'var(--bg-elevated)',
        border: `1px solid ${hovered ? 'var(--green)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all var(--transition-base)',
        minWidth: 0,
      }}
    >
      {profile.avatar_url
        ? <img src={profile.avatar_url} alt={displayName} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
        : <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>📷</div>
      }
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
          {badge && (
            <div style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, fontFamily: 'var(--font-ui)', flexShrink: 0 }}>
              {badge.label}
            </div>
          )}
        </div>
        {(profile.city || profile.state) && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📍 {[profile.city, profile.state].filter(Boolean).join(', ')}
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

export default function ExplorePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [creatives, setCreatives] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState([])
  const [filters, setFilters] = useState({
    specialty: '',
    state: '',
    city: '',
    name: '',
    locationPreference: 'australiaWide',
  })

  const availableSpecialties = [...new Set(selectedTypes.flatMap(t => SPECIALTIES[t] ?? []))]

  useEffect(() => {
    const type = searchParams.get('type')
    if (type) {
      const label = CATEGORIES.find(c => c.value === type)?.label ?? type
      setSelectedTypes([label])
      handleSearch([label], filters)
    }
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
    setFilters(prev => ({ ...prev, specialty: '' }))
  }

  function updateFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  async function handleSearch(types = selectedTypes, currentFilters = filters) {
    setLoading(true)
    setSearched(true)

    let query = supabase.from('profiles').select('*').eq('is_admin', false)

    if (types.length > 0) {
      query = query.overlaps('skill_types', types)
    }

    if (currentFilters.specialty) {
      query = query.contains('specialties', [currentFilters.specialty])
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

    const tierLocationFiltered = filterCreativesByLocationPreference(
      sorted,
      currentFilters.locationPreference,
      { city: currentFilters.city, state: currentFilters.state },
    )

    setCreatives(tierLocationFiltered)
    setLoading(false)
  }

  const styles = {
    page: { background: 'var(--bg-base)', minHeight: '100vh', paddingBottom: '80px' },
    inner: { maxWidth: '1280px', margin: '0 auto', padding: isMobile ? '0 16px' : '0 40px' },
    header: { padding: isMobile ? '32px 0 24px' : '48px 0 32px' },
    title: { fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--text-primary)', fontWeight: 400, marginBottom: '8px' },
    subtitle: { fontSize: '16px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
    filterCard: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: isMobile ? '16px' : '24px', marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '20px' },
    filterSection: { display: 'flex', flexDirection: 'column', gap: '10px' },
    filterLabel: { fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase' },
    typeGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    typeChip: (selected) => ({
      padding: '7px 16px',
      borderRadius: 'var(--radius-full)',
      border: `1px solid ${selected ? 'var(--green)' : 'var(--border-default)'}`,
      background: selected ? 'var(--green-dim)' : 'transparent',
      color: selected ? 'var(--green)' : 'var(--text-secondary)',
      fontSize: '14px',
      fontWeight: selected ? 500 : 400,
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      fontFamily: 'var(--font-ui)',
    }),
    filterRow: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr 1fr', gap: '16px', alignItems: 'flex-end' },
    select: { background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', width: '100%' },
    textInput: { background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' },
    filterGroupInner: { display: 'flex', flexDirection: 'column', gap: '6px' },
    resultsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' },
    resultsCount: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    grid: { display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(160px, 1fr))' : 'repeat(4, 1fr)', gap: isMobile ? '12px' : '16px' },
    emptyState: { padding: '80px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
    emptyTitle: { fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 400 },
    emptyText: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', maxWidth: '360px' },
  }

  return (
    <div style={styles.page}>
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
                multiple
                size={CATEGORIES.length}
                value={selectedTypes}
                onChange={(e) => {
                  const next = Array.from(e.target.selectedOptions, (opt) => opt.value)
                  setSelectedTypes(next)
                  setFilters((prev) => ({ ...prev, specialty: '' }))
                }}
                aria-label="Creative types (select one or more)"
                style={{
                  ...styles.select,
                  width: '100%',
                  minHeight: '44px',
                  padding: '8px 12px',
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            ) : (
              <div style={styles.typeGrid}>
                {CATEGORIES.map((cat) => (
                  <div
                    key={cat.value}
                    style={styles.typeChip(selectedTypes.includes(cat.value))}
                    onClick={() => toggleType(cat.value)}
                  >
                    {cat.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.filterSection}>
            <label style={styles.filterLabel}>Location preference</label>
            <select
              style={styles.select}
              value={filters.locationPreference}
              onChange={(e) => updateFilter('locationPreference', e.target.value)}
              aria-label="Location preference"
            >
              <option value="australiaWide">Australia Wide (all creatives)</option>
              <option value="local">Local (same city as the client's search city)</option>
              <option value="state">State (same state)</option>
            </select>
          </div>

          <div style={styles.filterRow}>
            <div style={styles.filterGroupInner}>
              <label style={styles.filterLabel}>Specialty</label>
              <select
                style={styles.select}
                value={filters.specialty}
                onChange={e => updateFilter('specialty', e.target.value)}
                disabled={availableSpecialties.length === 0}
              >
                <option value="">All specialties</option>
                {availableSpecialties.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={styles.filterGroupInner}>
              <label style={styles.filterLabel}>State</label>
              <select style={styles.select} value={filters.state} onChange={e => updateFilter('state', e.target.value)}>
                <option value="">All states</option>
                {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={styles.filterGroupInner}>
              <label style={styles.filterLabel}>City</label>
              <input style={styles.textInput} placeholder="e.g. Brisbane" value={filters.city} onChange={e => updateFilter('city', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <div style={styles.filterGroupInner}>
              <label style={styles.filterLabel}>Name Search</label>
              <input style={styles.textInput} placeholder="Search by name…" value={filters.name} onChange={e => updateFilter('name', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => handleSearch()} disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </Button>
            {(selectedTypes.length > 0 || filters.specialty || filters.state || filters.city || filters.name || filters.locationPreference !== 'australiaWide') && (
              <Button variant="ghost" size="sm" onClick={() => { setSelectedTypes([]); setFilters({ specialty: '', state: '', city: '', name: '', locationPreference: 'australiaWide' }); setSearched(false); setCreatives([]) }}>
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
            <div style={{ fontSize: '32px' }}>🔍</div>
            <div style={styles.emptyTitle}>Search for creatives above</div>
            <div style={styles.emptyText}>Select a creative type, filter by location and hit Search to find the right person for your project.</div>
            <Button variant="secondary" onClick={() => handleSearch()}>Browse All Creatives</Button>
          </div>
        ) : loading ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '32px' }}>🔍</div>
            <div style={styles.emptyTitle}>Searching…</div>
          </div>
        ) : creatives.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '32px' }}>😕</div>
            <div style={styles.emptyTitle}>No creatives found</div>
            <div style={styles.emptyText}>Try adjusting your filters or searching a different location.</div>
            <Button variant="secondary" onClick={() => { setSelectedTypes([]); setFilters({ specialty: '', state: '', city: '', name: '', locationPreference: 'australiaWide' }); handleSearch([], { specialty: '', state: '', city: '', name: '', locationPreference: 'australiaWide' }) }}>
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
