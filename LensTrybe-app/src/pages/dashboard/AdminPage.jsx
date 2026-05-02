import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import {
  GLASS_CARD,
  GLASS_CARD_GREEN,
  GLASS_MODAL_PANEL,
  GLASS_MODAL_OVERLAY_BASE,
  GLASS_NATIVE_FIELD,
  TYPO,
} from '../../lib/glassTokens';
import Button from '../../components/ui/Button';

const COLORS = {
  bg: '#0a0a0f',
  panel: '#111118',
  panelAlt: '#16161f',
  border: '#1e1e2e',
  green: '#1DB954',
  greenDim: 'rgba(29,185,84,0.12)',
  pink: '#FF2D78',
  pinkDim: 'rgba(255,45,120,0.12)',
  yellow: '#F5A623',
  yellowDim: 'rgba(245,166,35,0.12)',
  blue: '#4A9EFF',
  blueDim: 'rgba(74,158,255,0.12)',
  white: '#ffffff',
  muted: '#8888aa',
  dim: '#444466',
};

const FONT = { fontFamily: 'Inter, sans-serif' };

const MRR_BASIC = 0;
const MRR_PRO = 24.99;
const MRR_EXPERT = 74.99;
const MRR_ELITE = 149.99;

const TIER_COLORS = {
  basic: { bg: 'rgba(136,136,170,0.12)', color: '#8888aa', bar: COLORS.muted },
  pro: { bg: 'rgba(74,158,255,0.12)', color: '#4A9EFF', bar: COLORS.blue },
  expert: { bg: 'rgba(245,166,35,0.12)', color: '#F5A623', bar: COLORS.yellow },
  elite: { bg: 'rgba(29,185,84,0.12)', color: '#1DB954', bar: COLORS.green },
};

function TierBadge({ tier }) {
  const t = (tier || 'basic').toLowerCase();
  const cfg = TIER_COLORS[t] || TIER_COLORS.basic;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 20,
        background: cfg.bg,
        color: cfg.color,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {t}
    </span>
  );
}

const ROLE_BADGE_STYLES = {
  user: { bg: 'rgba(136,136,170,0.12)', color: COLORS.muted },
  staff: { bg: COLORS.blueDim, color: COLORS.blue },
  admin: { bg: COLORS.yellowDim, color: COLORS.yellow },
};

function RoleBadge({ role }) {
  const r = (role || 'user').toLowerCase();
  const cfg = ROLE_BADGE_STYLES[r] || ROLE_BADGE_STYLES.user;
  const label = r.charAt(0).toUpperCase() + r.slice(1);
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 20,
        background: cfg.bg,
        color: cfg.color,
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  );
}

const ADMIN_FLAGS_DISMISSED_KEY = 'lenstrybe_admin_flags_dismissed_v1';

/** @returns {Set<string>} */
function readDismissedAdminFlags() {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(ADMIN_FLAGS_DISMISSED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function persistDismissedAdminFlags(set) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADMIN_FLAGS_DISMISSED_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'guerrillamail.net',
  'sharklasers.com',
  'yopmail.com',
  'yopmail.fr',
  'tempmail.com',
  'tempmail.net',
  'tempmailo.com',
  'throwam.com',
  'trashmail.com',
  'getnada.com',
  'maildrop.cc',
  '10minutemail.com',
  '10minutemail.net',
];

function emailLocalAndDomain(email) {
  const e = String(email ?? '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return { local: e, domain: '' };
  return { local: e.slice(0, at), domain: e.slice(at + 1) };
}

function isDisposableEmailDomain(domain) {
  const d = domain.toLowerCase();
  if (!d) return false;
  return DISPOSABLE_EMAIL_DOMAINS.some((block) => d === block || d.endsWith(`.${block}`));
}

function numericSpamLocalPartReason(local) {
  if (!local) return null;
  if (/\d{6,}/.test(local)) {
    return 'Email local part contains 6 or more consecutive digits (possible automated signup).';
  }
  const digits = (local.match(/\d/g) || []).length;
  if (local.length >= 10 && digits >= 6 && digits / local.length >= 0.45) {
    return 'Email local part is 10 or more characters with 45% or more digits.';
  }
  return null;
}

function getSuspiciousEmailFlagReason(email) {
  const { local, domain } = emailLocalAndDomain(email);
  if (isDisposableEmailDomain(domain)) {
    return `Disposable or throwaway email domain (${domain}).`;
  }
  return numericSpamLocalPartReason(local);
}

function formatAuDate(iso) {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

function formatAuDateTime(iso) {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'N/A';
  }
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Last 6 calendar months, oldest first, each with { key, label } */
function getLast6MonthBuckets(now = new Date()) {
  const out = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: monthKey(d),
      label: d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }),
    });
  }
  return out;
}

function countSignupsByMonth(users, buckets) {
  const counts = Object.fromEntries(buckets.map((b) => [b.key, 0]));
  for (const u of users) {
    if (!u?.created_at) continue;
    const c = new Date(u.created_at);
    const k = monthKey(c);
    if (k in counts) counts[k] += 1;
  }
  return buckets.map((b) => ({ ...b, count: counts[b.key] || 0 }));
}

function computeTierCounts(users) {
  let basic = 0;
  let pro = 0;
  let expert = 0;
  let elite = 0;
  for (const u of users) {
    if (!u?.profile) continue;
    const t = String(u.profile.subscription_tier || 'basic').toLowerCase();
    if (t === 'elite') elite += 1;
    else if (t === 'expert') expert += 1;
    else if (t === 'pro') pro += 1;
    else basic += 1;
  }
  return { basic, pro, expert, elite, total: basic + pro + expert + elite };
}

function formatSkillTypes(profile) {
  const st = profile?.skill_types;
  if (st == null) return 'N/A';
  if (Array.isArray(st)) return st.filter(Boolean).join(', ') || 'N/A';
  if (typeof st === 'string') return st || 'N/A';
  return String(st);
}

function bioSnippet(profile, max = 150) {
  const raw = String(profile?.bio ?? '').trim();
  if (!raw) return 'N/A';
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…`;
}

function subscriptionStatusLabel(profile) {
  if (!profile) return 'No creative profile';
  const st = profile.subscription_status || profile.stripe_subscription_status;
  if (st && typeof st === 'string') return st;
  const tier = (profile.subscription_tier || 'basic').toLowerCase();
  return `Creative account (${tier} tier)`;
}

function initialsFromUser(u) {
  const name = (u?.profile?.business_name || u?.email || '?').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  return name.slice(0, 2).toUpperCase() || '?';
}

function csvEscape(val) {
  const s = String(val ?? '');
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadUsersCsv(users) {
  const headers = [
    'Email',
    'Business Name',
    'Tier',
    'Role',
    'Joined Date',
    'Last Sign In',
    'Location',
  ];
  const rows = users.map((u) => {
    const tier = u.profile ? (u.profile.subscription_tier || 'basic') : '';
    const role = u.profile ? (u.profile.role || 'user') : '';
    const loc =
      u.profile?.location ||
      [u.profile?.city, u.profile?.state].filter(Boolean).join(', ') ||
      '';
    return [
      csvEscape(u.email),
      csvEscape(u.profile?.business_name || ''),
      csvEscape(tier),
      csvEscape(role),
      csvEscape(formatAuDate(u.created_at)),
      csvEscape(u.last_sign_in_at ? formatAuDateTime(u.last_sign_in_at) : 'Never'),
      csvEscape(loc),
    ].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lenstrybe-users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * @param {Array<{ id: string, email?: string, created_at?: string, profile?: object }>} users
 * @param {Set<string>} dismissedIds
 */
function buildAdminInvestigationFlags(users, dismissedIds) {
  /** @type {{ id: string, userId: string, email: string, reason: string, kind: string, createdAt: string }[]} */
  const out = [];
  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;

  for (const u of users) {
    if (!u?.id || !u.email) continue;
    const createdAt = formatAuDate(u.created_at);

    const ghost =
      !u.profile && u.created_at && now - new Date(u.created_at).getTime() > ms24h;
    if (ghost) {
      const id = `ghost:${u.id}`;
      if (!dismissedIds.has(id)) {
        out.push({
          id,
          userId: u.id,
          email: u.email,
          kind: 'Ghost account',
          reason:
            'Auth user is older than 24 hours with no profile row (incomplete signup).',
          createdAt,
        });
      }
    }

    const suspiciousReason = getSuspiciousEmailFlagReason(u.email);
    if (suspiciousReason) {
      const id = `suspicious:${u.id}`;
      if (!dismissedIds.has(id)) {
        out.push({
          id,
          userId: u.id,
          email: u.email,
          kind: 'Suspicious email',
          reason: suspiciousReason,
          createdAt,
        });
      }
    }
  }

  return out;
}

function ConfirmModal({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  danger = true,
  onConfirm,
  onCancel,
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        ...GLASS_MODAL_OVERLAY_BASE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300,
      }}
    >
      <div
        style={{
          ...GLASS_MODAL_PANEL,
          borderRadius: 14,
          padding: 28,
          maxWidth: 420,
          width: '90%',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, color: COLORS.white, marginBottom: 8, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 24, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            style={{ padding: '9px 20px', borderRadius: 8, color: COLORS.white, fontSize: 13, ...FONT }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            style={{ padding: '9px 20px', borderRadius: 8, color: COLORS.white, fontSize: 13, fontWeight: 700, ...FONT }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CollapsibleHeader({ title, open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        background: COLORS.panelAlt,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: '12px 16px',
        cursor: 'pointer',
        marginBottom: open ? 12 : 10,
        ...FONT,
      }}
    >
      <span
        style={{
          ...TYPO.heading,
          fontSize: 13,
          fontWeight: 700,
          color: COLORS.muted,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
      <span style={{ fontSize: 12, color: COLORS.green, fontWeight: 700 }}>{open ? 'Hide' : 'Show'}</span>
    </button>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [callerRole, setCallerRole] = useState(null);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmRoleChange, setConfirmRoleChange] = useState(null);
  const [roleDropdownUserId, setRoleDropdownUserId] = useState(null);
  const [editingTier, setEditingTier] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [dismissedFlagIds, setDismissedFlagIds] = useState(() => readDismissedAdminFlags());
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const [flagsOpen, setFlagsOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(true);
  const [panelUserId, setPanelUserId] = useState(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastAudience, setBroadcastAudience] = useState('all');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const panelUser = useMemo(() => users.find((u) => u.id === panelUserId) ?? null, [users, panelUserId]);

  const investigationFlags = useMemo(
    () => buildAdminInvestigationFlags(users, dismissedFlagIds),
    [users, dismissedFlagIds],
  );

  const dismissInvestigationFlag = useCallback((flagId) => {
    setDismissedFlagIds((prev) => {
      const next = new Set(prev);
      next.add(flagId);
      persistDismissedAdminFlags(next);
      return next;
    });
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const callEdge = useCallback(async (body) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(`${supabaseUrl}/functions/v1/admin-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }, [supabaseUrl]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate('/login');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('role, is_admin').eq('id', session.user.id).single();
      const allowed = ['admin', 'staff'].includes(profile?.role) || profile?.is_admin;
      if (!allowed) {
        navigate('/dashboard');
        return;
      }
      loadUsers();
    });
  }, [navigate]);

  useEffect(() => {
    if (!panelUserId) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setPanelUserId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelUserId]);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await callEdge({ action: 'list_users' });
      if (data.callerRole === 'admin' || data.callerRole === 'staff') {
        setCallerRole(data.callerRole);
      } else {
        setCallerRole(null);
        setUsers([]);
        navigate('/dashboard');
        return;
      }
      setUsers(data.users || []);
    } catch (e) {
      console.error('Failed to load users', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteUser(userId, email) {
    setConfirmDelete(null);
    setActionLoading(userId);
    try {
      const data = await callEdge({ action: 'delete_user', userId });
      if (data.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        if (panelUserId === userId) setPanelUserId(null);
        showToast(`${email} deleted successfully`);
      } else {
        showToast(data.error || 'Failed to delete user', 'error');
      }
    } catch (e) {
      showToast('Failed to delete user', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUpdateTier(userId, tier) {
    setEditingTier(null);
    setActionLoading(userId);
    try {
      const data = await callEdge({ action: 'update_tier', userId, tier });
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, profile: { ...u.profile, subscription_tier: tier } } : u,
          ),
        );
        showToast('Tier updated');
      } else {
        showToast(data.error || 'Failed to update tier', 'error');
      }
    } catch (e) {
      showToast('Failed to update tier', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUpdateRole(userId, roleSlug) {
    setConfirmRoleChange(null);
    setRoleDropdownUserId(null);
    setActionLoading(userId);
    try {
      const data = await callEdge({ action: 'update_role', userId, role: roleSlug });
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, profile: { ...u.profile, role: roleSlug } } : u)),
        );
        showToast('Role updated');
      } else {
        showToast(data.error || 'Failed to update role', 'error');
      }
    } catch (e) {
      showToast('Failed to update role', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  const ms7 = 7 * 24 * 60 * 60 * 1000;
  const ms30 = 30 * 24 * 60 * 60 * 1000;
  const ms90 = 90 * 24 * 60 * 60 * 1000;

  const filtered = useMemo(() => {
    const now = Date.now();
    function matchesActive(u) {
      const last = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : null;
      if (activeFilter === 'all') return true;
      if (activeFilter === '7d') return last != null && now - last <= ms7;
      if (activeFilter === '30d') return last != null && now - last <= ms30;
      if (activeFilter === '90d') return last != null && now - last <= ms90;
      if (activeFilter === 'inactive90') {
        if (last == null) return true;
        return now - last > ms90;
      }
      return true;
    }
    return users.filter((u) => {
      const matchSearch =
        !search ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.profile?.business_name?.toLowerCase().includes(search.toLowerCase());
      const matchTier =
        tierFilter === 'all' || (u.profile?.subscription_tier || 'basic').toLowerCase() === tierFilter;
      const r = (u.profile?.role || 'user').toLowerCase();
      const matchRole = roleFilter === 'all' || r === roleFilter;
      return matchSearch && matchTier && matchRole && matchesActive(u);
    });
  }, [users, search, tierFilter, roleFilter, activeFilter, ms7, ms30, ms90]);

  const stats = useMemo(() => {
    const creatives = users.filter((u) => u.profile).length;
    const clients = users.filter((u) => !u.profile).length;
    const elite = users.filter((u) => u.profile?.subscription_tier === 'elite').length;
    const expert = users.filter((u) => u.profile?.subscription_tier === 'expert').length;
    const pro = users.filter((u) => u.profile?.subscription_tier === 'pro').length;
    const basic = users.filter((u) => u.profile && (u.profile.subscription_tier || 'basic').toLowerCase() === 'basic').length;
    const mrr = elite * MRR_ELITE + expert * MRR_EXPERT + pro * MRR_PRO + basic * MRR_BASIC;
    const payingUsers = pro + expert + elite;
    const arpu = payingUsers > 0 ? mrr / payingUsers : 0;
    const conversionRate = creatives > 0 ? (payingUsers / creatives) * 100 : 0;
    return {
      total: users.length,
      creatives,
      clients,
      elite,
      expert,
      pro,
      basic,
      mrr,
      payingUsers,
      arpu,
      conversionRate,
    };
  }, [users]);

  const signupBuckets = useMemo(() => countSignupsByMonth(users, getLast6MonthBuckets()), [users]);
  const maxSignupCount = useMemo(() => Math.max(1, ...signupBuckets.map((b) => b.count)), [signupBuckets]);

  const tierBar = useMemo(() => computeTierCounts(users), [users]);
  const tierBarTotal = tierBar.total || 0;

  const platformAnalytics = useMemo(() => {
    const now = Date.now();
    const active30 = users.filter((u) => {
      if (!u.last_sign_in_at) return false;
      return now - new Date(u.last_sign_in_at).getTime() <= ms30;
    }).length;
    const weekAgo = now - ms7;
    const signupsWeek = users.filter((u) => u.created_at && new Date(u.created_at).getTime() >= weekAgo).length;
    const startMonth = new Date();
    startMonth.setDate(1);
    startMonth.setHours(0, 0, 0, 0);
    const signupsMonth = users.filter((u) => u.created_at && new Date(u.created_at) >= startMonth).length;
    const mrrEstimate = stats.elite * MRR_ELITE + stats.expert * MRR_EXPERT + stats.pro * MRR_PRO;
    return { active30, signupsWeek, signupsMonth, mrrEstimate };
  }, [users, ms30, ms7, stats.elite, stats.expert, stats.pro]);

  const exportCsv = () => {
    downloadUsersCsv(users);
    showToast('CSV downloaded');
  };

  const queueBroadcast = () => {
    setBroadcastOpen(false);
    setBroadcastTitle('');
    setBroadcastBody('');
    setBroadcastAudience('all');
    showToast('Broadcast queued - feature coming soon');
  };

  const isAdmin = callerRole === 'admin';

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', ...FONT, padding: '24px 28px' }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 2000,
            padding: '12px 20px',
            borderRadius: 10,
            background: toast.type === 'error' ? COLORS.pink : COLORS.green,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          {toast.msg}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete user?"
          message={`You are about to permanently delete the account for ${confirmDelete.email}. All data for this user will be removed. This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDeleteUser(confirmDelete.id, confirmDelete.email)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmRoleChange && (
        <ConfirmModal
          title="Confirm role change"
          message={`Change ${confirmRoleChange.email} role from ${confirmRoleChange.fromLabel} to ${confirmRoleChange.toLabel}?`}
          confirmLabel="Confirm"
          danger={false}
          onConfirm={() => handleUpdateRole(confirmRoleChange.userId, confirmRoleChange.toRole)}
          onCancel={() => setConfirmRoleChange(null)}
        />
      )}

      {broadcastOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            ...GLASS_MODAL_OVERLAY_BASE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1250,
          }}
          onClick={() => setBroadcastOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              ...GLASS_MODAL_PANEL,
              borderRadius: 14,
              padding: 24,
              maxWidth: 480,
              width: '92%',
              textAlign: 'left',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.white, marginBottom: 16 }}>Broadcast message</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 12, color: COLORS.muted, ...TYPO.label }}>Target audience</label>
              <select
                value={broadcastAudience}
                onChange={(e) => setBroadcastAudience(e.target.value)}
                style={{
                  ...GLASS_NATIVE_FIELD,
                  padding: '10px 12px',
                  borderRadius: 8,
                  color: COLORS.white,
                  fontSize: 13,
                  ...FONT,
                }}
              >
                <option value="all">All users</option>
                <option value="basic">Basic only</option>
                <option value="pro">Pro only</option>
                <option value="expert">Expert only</option>
                <option value="elite">Elite only</option>
                <option value="creatives">Creatives only</option>
              </select>
              <label style={{ fontSize: 12, color: COLORS.muted, ...TYPO.label }}>Message title</label>
              <input
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="Title"
                style={{
                  ...GLASS_NATIVE_FIELD,
                  padding: '10px 12px',
                  borderRadius: 8,
                  color: COLORS.white,
                  fontSize: 13,
                  ...FONT,
                }}
              />
              <label style={{ fontSize: 12, color: COLORS.muted, ...TYPO.label }}>Message body</label>
              <textarea
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                placeholder="Write your message…"
                rows={5}
                style={{
                  ...GLASS_NATIVE_FIELD,
                  padding: '10px 12px',
                  borderRadius: 8,
                  color: COLORS.white,
                  fontSize: 13,
                  resize: 'vertical',
                  ...FONT,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setBroadcastOpen(false)}
                style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, ...FONT }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={queueBroadcast}
                style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, ...FONT }}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      )}

      {panelUserId && panelUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setPanelUserId(null)}
        >
          <aside
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 360,
              maxWidth: '100%',
              background: COLORS.panel,
              borderLeft: `1px solid ${COLORS.border}`,
              boxShadow: '-8px 0 32px rgba(0,0,0,0.45)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '16px 18px',
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.white }}>User details</div>
              <button
                type="button"
                aria-label="Close panel"
                onClick={() => setPanelUserId(null)}
                style={{
                  background: COLORS.panelAlt,
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.muted,
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1,
                  ...FONT,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 24px' }}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
                {panelUser.profile?.avatar_url ? (
                  <img
                    src={panelUser.profile.avatar_url}
                    alt=""
                    style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: `1px solid ${COLORS.border}` }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      background: COLORS.pinkDim,
                      border: `1px solid ${COLORS.pink}`,
                      color: COLORS.pink,
                      fontWeight: 800,
                      fontSize: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {initialsFromUser(panelUser)}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: COLORS.white, fontWeight: 600, wordBreak: 'break-word' }}>{panelUser.email}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
                    {panelUser.profile?.business_name || 'No business name'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {panelUser.profile ? (
                      <TierBadge tier={panelUser.profile.subscription_tier || 'basic'} />
                    ) : (
                      <span style={{ fontSize: 11, color: COLORS.dim }}>No tier</span>
                    )}
                    <RoleBadge role={panelUser.profile?.role || 'user'} />
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: COLORS.dim, lineHeight: 1.6, marginBottom: 16 }}>
                <div>
                  <span style={{ color: COLORS.muted }}>Joined: </span>
                  {formatAuDate(panelUser.created_at)}
                </div>
                <div>
                  <span style={{ color: COLORS.muted }}>Last sign in: </span>
                  {formatAuDateTime(panelUser.last_sign_in_at)}
                </div>
                <div>
                  <span style={{ color: COLORS.muted }}>Location: </span>
                  {panelUser.profile?.location ||
                    [panelUser.profile?.city, panelUser.profile?.state].filter(Boolean).join(', ') ||
                    'N/A'}
                </div>
                <div>
                  <span style={{ color: COLORS.muted }}>Skill types: </span>
                  {formatSkillTypes(panelUser.profile)}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: COLORS.muted }}>Bio: </span>
                  {bioSnippet(panelUser.profile)}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: COLORS.muted }}>Subscription status: </span>
                  {subscriptionStatusLabel(panelUser.profile)}
                </div>
              </div>

              {isAdmin && (
                <div
                  style={{
                    borderTop: `1px solid ${COLORS.border}`,
                    paddingTop: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, marginBottom: 6 }}>CHANGE TIER</div>
                    {panelUser.profile ? (
                      <select
                        value={(panelUser.profile.subscription_tier || 'basic').toLowerCase()}
                        onChange={(e) => handleUpdateTier(panelUser.id, e.target.value)}
                        disabled={actionLoading === panelUser.id}
                        style={{
                          width: '100%',
                          ...GLASS_NATIVE_FIELD,
                          padding: '10px 12px',
                          borderRadius: 8,
                          color: COLORS.white,
                          fontSize: 13,
                          ...FONT,
                        }}
                      >
                        {['basic', 'pro', 'expert', 'elite'].map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontSize: 12, color: COLORS.dim }}>No profile, tier cannot be set here.</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, marginBottom: 6 }}>CHANGE ROLE</div>
                    {panelUser.profile ? (
                      <select
                        value={(panelUser.profile.role || 'user').toLowerCase()}
                        onChange={(e) => {
                          const newRole = e.target.value;
                          const displayRole = (panelUser.profile?.role || 'user').toLowerCase();
                          if (newRole === displayRole) return;
                          setConfirmRoleChange({
                            userId: panelUser.id,
                            email: panelUser.email,
                            fromLabel: displayRole.charAt(0).toUpperCase() + displayRole.slice(1),
                            toLabel: newRole.charAt(0).toUpperCase() + newRole.slice(1),
                            toRole: newRole,
                          });
                        }}
                        disabled={actionLoading === panelUser.id}
                        style={{
                          width: '100%',
                          ...GLASS_NATIVE_FIELD,
                          padding: '10px 12px',
                          borderRadius: 8,
                          color: COLORS.white,
                          fontSize: 13,
                          ...FONT,
                        }}
                      >
                        {['user', 'staff', 'admin'].map((r) => (
                          <option key={r} value={r}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontSize: 12, color: COLORS.dim }}>No profile, role cannot be set here.</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete({ id: panelUser.id, email: panelUser.email })}
                    disabled={actionLoading === panelUser.id}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: COLORS.pinkDim,
                      border: `1px solid ${COLORS.pink}`,
                      borderRadius: 8,
                      color: COLORS.pink,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: actionLoading === panelUser.id ? 'wait' : 'pointer',
                      opacity: actionLoading === panelUser.id ? 0.6 : 1,
                      ...FONT,
                    }}
                  >
                    Delete user
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...TYPO.heading, fontSize: 22, fontWeight: 800, color: COLORS.white }}>Admin panel</div>
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>LensTrybe user management</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setBroadcastOpen(true)}
            style={{ padding: '8px 14px', borderRadius: 8, color: COLORS.white, fontSize: 13, ...FONT }}
          >
            Broadcast
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={exportCsv}
            style={{ padding: '8px 14px', borderRadius: 8, color: COLORS.muted, fontSize: 13, ...FONT }}
          >
            Export CSV
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/dashboard')}
            style={{ padding: '8px 16px', borderRadius: 8, color: COLORS.muted, fontSize: 13, ...FONT }}
          >
            Back to dashboard
          </Button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { label: 'Total users', value: stats.total, color: COLORS.white },
          { label: 'Creatives', value: stats.creatives, color: COLORS.blue },
          { label: 'Clients', value: stats.clients, color: COLORS.muted },
          { label: 'Elite', value: stats.elite, color: COLORS.green },
          { label: 'Expert', value: stats.expert, color: COLORS.yellow },
          { label: 'Pro', value: stats.pro, color: COLORS.blue },
          { label: 'Basic', value: stats.basic, color: COLORS.muted },
          {
            label: 'Estimated MRR',
            value: `$${stats.mrr.toFixed(2)}`,
            color: COLORS.green,
            greenCard: true,
            valueFontSize: 20,
          },
          {
            label: 'Avg Revenue Per User',
            value: `$${stats.arpu.toFixed(2)}`,
            color: COLORS.green,
            greenCard: true,
            valueFontSize: 20,
          },
          { label: 'Paying Users', value: stats.payingUsers, color: COLORS.yellow },
          {
            label: 'Conversion Rate',
            value: `${stats.conversionRate.toFixed(1)}%`,
            color: COLORS.blue,
            valueFontSize: 22,
          },
          { label: 'Free Tier', value: stats.basic, color: COLORS.muted },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              ...(s.greenCard ? GLASS_CARD_GREEN : GLASS_CARD),
              borderRadius: 10,
              padding: '14px 16px',
              minWidth: 0,
            }}
          >
            <div
              style={{
                ...TYPO.stat,
                fontSize: s.valueFontSize ?? 24,
                fontWeight: 800,
                color: s.color,
                lineHeight: 1.1,
              }}
            >
              {s.value}
            </div>
            <div style={{ ...TYPO.label, fontSize: 11, color: COLORS.muted, marginTop: 4, lineHeight: 1.25 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <CollapsibleHeader title="Analytics" open={analyticsOpen} onToggle={() => setAnalyticsOpen((o) => !o)} />
        {analyticsOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              style={{
                ...GLASS_CARD,
                borderRadius: 12,
                padding: '16px 18px',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 12, letterSpacing: '0.05em' }}>
                SIGN-UPS (LAST 6 MONTHS)
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, minHeight: 140 }}>
                {signupBuckets.map((b) => {
                  const hPct = (b.count / maxSignupCount) * 100;
                  return (
                    <div key={b.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.white }}>{b.count}</div>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: 48,
                          margin: '0 auto',
                          height: 100,
                          background: COLORS.panelAlt,
                          borderRadius: 6,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end',
                          overflow: 'hidden',
                          border: `1px solid ${COLORS.border}`,
                        }}
                      >
                        <div
                          style={{
                            height: `${hPct}%`,
                            minHeight: b.count > 0 ? 4 : 0,
                            background: COLORS.green,
                            borderRadius: '0 0 4px 4px',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 10, color: COLORS.muted, textAlign: 'center', lineHeight: 1.2 }}>{b.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                ...GLASS_CARD,
                borderRadius: 12,
                padding: '16px 18px',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 12, letterSpacing: '0.05em' }}>
                TIER BREAKDOWN (CREATIVES WITH PROFILE)
              </div>
              {tierBarTotal === 0 ? (
                <div style={{ fontSize: 13, color: COLORS.dim }}>No tier data yet.</div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      height: 28,
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: `1px solid ${COLORS.border}`,
                      marginBottom: 12,
                    }}
                  >
                    {(['basic', 'pro', 'expert', 'elite']).map((key) => {
                      const n = tierBar[key];
                      const pct = (n / tierBarTotal) * 100;
                      if (pct <= 0) return null;
                      return (
                        <div
                          key={key}
                          title={`${key}: ${n}`}
                          style={{
                            width: `${pct}%`,
                            background: TIER_COLORS[key]?.bar || COLORS.muted,
                            minWidth: n > 0 ? 2 : 0,
                          }}
                        />
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', fontSize: 12 }}>
                    {(['basic', 'pro', 'expert', 'elite']).map((key) => {
                      const n = tierBar[key];
                      const pct = tierBarTotal ? ((n / tierBarTotal) * 100).toFixed(1) : '0';
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 2,
                              background: TIER_COLORS[key]?.bar,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ color: COLORS.white, fontWeight: 600, textTransform: 'capitalize' }}>{key}</span>
                          <span style={{ color: COLORS.muted }}>
                            {n} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div
              style={{
                ...GLASS_CARD,
                borderRadius: 12,
                padding: '16px 18px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>TOTAL MRR ESTIMATE</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.green }}>
                  ${platformAnalytics.mrrEstimate.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: COLORS.dim, marginTop: 4 }}>
                  Basic ${MRR_BASIC}, Pro ${MRR_PRO}, Expert ${MRR_EXPERT}, Elite ${MRR_ELITE} per user
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>ACTIVE USERS (LAST 30 DAYS)</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.blue }}>{platformAnalytics.active30}</div>
                <div style={{ fontSize: 11, color: COLORS.dim, marginTop: 4 }}>Based on last sign in time</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>NEW SIGN-UPS THIS WEEK</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.white }}>{platformAnalytics.signupsWeek}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>NEW SIGN-UPS THIS MONTH</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.white }}>{platformAnalytics.signupsMonth}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <CollapsibleHeader title="Flags" open={flagsOpen} onToggle={() => setFlagsOpen((o) => !o)} />
        {flagsOpen && (
          <div
            style={{
              ...GLASS_CARD,
              borderRadius: 12,
              padding: investigationFlags.length === 0 ? '20px 18px' : '14px 14px',
              border: investigationFlags.length === 0 ? `1px solid ${COLORS.border}` : 'none',
            }}
          >
            {investigationFlags.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 1.5 }}>
                No flags to review. Nothing matched ghost or suspicious email rules right now.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {investigationFlags.map((f) => {
                  const busy = actionLoading === f.userId;
                  return (
                    <div
                      key={f.id}
                      style={{
                        borderRadius: 12,
                        padding: '14px 16px',
                        background: COLORS.pinkDim,
                        border: `1px solid ${COLORS.pink}`,
                      }}
                    >
                      <div style={{ fontSize: 14, color: COLORS.white, fontWeight: 600, marginBottom: 4 }}>{f.email}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.pink, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                        {f.kind}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 4, lineHeight: 1.45 }}>{f.reason}</div>
                      <div style={{ fontSize: 11, color: COLORS.dim, marginBottom: 12 }}>Created: {f.createdAt}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => dismissInvestigationFlag(f.id)}
                          style={{
                            padding: '6px 12px',
                            background: COLORS.panelAlt,
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: 8,
                            color: COLORS.muted,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            ...FONT,
                          }}
                        >
                          Dismiss
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete({ id: f.userId, email: f.email })}
                            disabled={busy}
                            style={{
                              padding: '6px 12px',
                              background: COLORS.pinkDim,
                              border: `1px solid ${COLORS.pink}`,
                              borderRadius: 8,
                              color: COLORS.pink,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: busy ? 'wait' : 'pointer',
                              opacity: busy ? 0.55 : 1,
                              ...FONT,
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <CollapsibleHeader title="Reports" open={reportsOpen} onToggle={() => setReportsOpen((o) => !o)} />
        {reportsOpen && (
          <div
            style={{
              ...GLASS_CARD,
              borderRadius: 12,
              padding: '20px 18px',
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.55, textAlign: 'center' }}>
              No reports yet. When users report profiles or messages, they will appear here for review.
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or business name…"
          style={{
            ...GLASS_NATIVE_FIELD,
            width: '100%',
            padding: '9px 14px',
            borderRadius: 8,
            color: COLORS.white,
            fontSize: 13,
            outline: 'none',
            ...FONT,
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: COLORS.dim, fontWeight: 700, marginRight: 4 }}>TIER</span>
          {['all', 'elite', 'expert', 'pro', 'basic'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTierFilter(t)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: t === 'all' ? 'none' : 'capitalize',
                ...FONT,
                background: tierFilter === t ? COLORS.greenDim : COLORS.panel,
                border: `1px solid ${tierFilter === t ? COLORS.green : COLORS.border}`,
                color: tierFilter === t ? COLORS.green : COLORS.muted,
              }}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: COLORS.dim, fontWeight: 700, marginRight: 4 }}>ROLE</span>
          {['all', 'admin', 'staff', 'user'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
                ...FONT,
                background: roleFilter === r ? COLORS.blueDim : COLORS.panel,
                border: `1px solid ${roleFilter === r ? COLORS.blue : COLORS.border}`,
                color: roleFilter === r ? COLORS.blue : COLORS.muted,
              }}
            >
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: COLORS.dim, fontWeight: 700, marginRight: 4 }}>LAST ACTIVE</span>
          {[
            { id: 'all', label: 'All time' },
            { id: '7d', label: 'Last 7 days' },
            { id: '30d', label: 'Last 30 days' },
            { id: '90d', label: 'Last 90 days' },
            { id: 'inactive90', label: 'Inactive 90+ days' },
          ].map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setActiveFilter(a.id)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                ...FONT,
                background: activeFilter === a.id ? COLORS.yellowDim : COLORS.panel,
                border: `1px solid ${activeFilter === a.id ? COLORS.yellow : COLORS.border}`,
                color: activeFilter === a.id ? COLORS.yellow : COLORS.muted,
              }}
            >
              {a.label}
            </button>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={loadUsers}
            style={{ padding: '8px 14px', borderRadius: 8, color: COLORS.muted, fontSize: 13, marginLeft: 'auto', ...FONT }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div
        style={{
          ...GLASS_CARD,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 140px',
            padding: '10px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            fontSize: 11,
            fontWeight: 700,
            color: COLORS.dim,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          <div>User</div>
          <div>Business</div>
          <div>Tier</div>
          <div>Joined</div>
          <div>Role</div>
          <div>Actions</div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: COLORS.muted, fontSize: 13 }}>Loading users…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: COLORS.muted, fontSize: 13 }}>No users found</div>
        ) : (
          filtered.map((u, i) => {
            const isLoading = actionLoading === u.id;
            const tier = u.profile ? (u.profile.subscription_tier || 'basic') : null;
            const displayRole = (u.profile?.role || 'user').toLowerCase();
            const roleLabel = displayRole.charAt(0).toUpperCase() + displayRole.slice(1);
            const joined = formatAuDate(u.created_at);
            const canEditTier = isAdmin;
            const canEditRole = isAdmin && u.profile;
            const showDelete = isAdmin;

            return (
              <div
                key={u.id}
                onClick={() => setPanelUserId(u.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 140px',
                  padding: '12px 16px',
                  borderBottom: i < filtered.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                  alignItems: 'center',
                  opacity: isLoading ? 0.5 : 1,
                  transition: 'opacity 0.2s, background 0.15s',
                  cursor: 'pointer',
                  background: panelUserId === u.id ? 'rgba(29,185,84,0.06)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (panelUserId !== u.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = panelUserId === u.id ? 'rgba(29,185,84,0.06)' : 'transparent';
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: COLORS.white, fontWeight: 500 }}>{u.email}</div>
                  {u.profile?.location && <div style={{ fontSize: 11, color: COLORS.dim, marginTop: 2 }}>{u.profile.location}</div>}
                </div>

                <div style={{ fontSize: 13, color: COLORS.muted }}>
                  {u.profile?.business_name || (u.profile ? 'No business name' : 'Client account')}
                </div>

                <div onClick={(e) => e.stopPropagation()}>
                  {!u.profile ? (
                    <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 400 }}>N/A</span>
                  ) : editingTier === u.id ? (
                    <select
                      defaultValue={tier}
                      onChange={(e) => handleUpdateTier(u.id, e.target.value)}
                      onBlur={() => setEditingTier(null)}
                      autoFocus
                      style={{
                        background: COLORS.panelAlt,
                        border: `1px solid ${COLORS.green}`,
                        borderRadius: 6,
                        color: COLORS.white,
                        fontSize: 12,
                        padding: '3px 6px',
                        cursor: 'pointer',
                        outline: 'none',
                        ...FONT,
                      }}
                    >
                      {['basic', 'pro', 'expert', 'elite'].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div
                      onClick={() => canEditTier && u.profile && setEditingTier(u.id)}
                      style={{ cursor: canEditTier && u.profile ? 'pointer' : 'default' }}
                    >
                      <TierBadge tier={tier} />
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 12, color: COLORS.muted }}>{joined}</div>

                <div onClick={(e) => e.stopPropagation()}>
                  {canEditRole && roleDropdownUserId === u.id ? (
                    <select
                      value={displayRole}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        setRoleDropdownUserId(null);
                        if (newRole === displayRole) return;
                        setConfirmRoleChange({
                          userId: u.id,
                          email: u.email,
                          fromLabel: roleLabel,
                          toLabel: newRole.charAt(0).toUpperCase() + newRole.slice(1),
                          toRole: newRole,
                        });
                      }}
                      onBlur={() => setRoleDropdownUserId(null)}
                      autoFocus
                      style={{
                        background: COLORS.panelAlt,
                        border: `1px solid ${COLORS.green}`,
                        borderRadius: 6,
                        color: COLORS.white,
                        fontSize: 12,
                        padding: '3px 6px',
                        cursor: 'pointer',
                        outline: 'none',
                        ...FONT,
                      }}
                    >
                      {['user', 'staff', 'admin'].map((r) => (
                        <option key={r} value={r}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div
                      onClick={() => canEditRole && setRoleDropdownUserId(u.id)}
                      style={{ cursor: canEditRole ? 'pointer' : 'default', display: 'inline-block' }}
                    >
                      <RoleBadge role={displayRole} />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  {showDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ id: u.id, email: u.email })}
                      disabled={isLoading}
                      style={{
                        padding: '5px 10px',
                        background: COLORS.pinkDim,
                        border: `1px solid ${COLORS.pink}`,
                        borderRadius: 6,
                        color: COLORS.pink,
                        fontSize: 12,
                        cursor: 'pointer',
                        fontWeight: 600,
                        ...FONT,
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: COLORS.dim, textAlign: 'right' }}>
        {filtered.length} of {users.length} users shown
      </div>
    </div>
  );
}
