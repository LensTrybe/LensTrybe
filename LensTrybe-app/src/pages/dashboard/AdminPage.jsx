import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { GLASS_CARD, GLASS_CARD_GREEN, GLASS_MODAL_PANEL, GLASS_MODAL_OVERLAY_BASE, GLASS_NATIVE_FIELD, DIVIDER_GRADIENT_STYLE, TYPO, glassCardAccentBorder } from '../../lib/glassTokens'
import Button from '../../components/ui/Button'

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

const TIER_COLORS = {
  basic: { bg: 'rgba(136,136,170,0.12)', color: '#8888aa' },
  pro: { bg: 'rgba(74,158,255,0.12)', color: '#4A9EFF' },
  expert: { bg: 'rgba(245,166,35,0.12)', color: '#F5A623' },
  elite: { bg: 'rgba(29,185,84,0.12)', color: '#1DB954' },
};

function TierBadge({ tier }) {
  const t = (tier || 'basic').toLowerCase();
  const cfg = TIER_COLORS[t] || TIER_COLORS.basic;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
      background: cfg.bg, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
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
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
      background: cfg.bg, color: cfg.color, letterSpacing: '0.04em',
    }}>
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

/** Disposable / throwaway inbox domains (partial match on registrable suffix). */
const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'guerrillamail.net',
  'sharklasers.com',
  'pokemail.net',
  'spam4.me',
  'grr.la',
  'yopmail.com',
  'yopmail.fr',
  'tempmail.com',
  'tempmail.net',
  'tempmailo.com',
  'throwam.com',
  'throwaway.email',
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
  return DISPOSABLE_EMAIL_DOMAINS.some(
    (block) => d === block || d.endsWith(`.${block}`),
  );
}

/**
 * Heuristic: long digit runs in local part (common automated spam signups).
 * @returns {string | null} human-readable reason or null
 */
function numericSpamLocalPartReason(local) {
  if (!local) return null;
  if (/\d{6,}/.test(local)) {
    return 'Email local part contains a long numeric sequence (possible automated signup).';
  }
  const digits = (local.match(/\d/g) || []).length;
  if (local.length >= 10 && digits >= 6 && digits / local.length >= 0.45) {
    return 'Email local part is mostly random digits and characters.';
  }
  return null;
}

/**
 * @param {string} email
 * @returns {string | null}
 */
function getSuspiciousEmailFlagReason(email) {
  const { local, domain } = emailLocalAndDomain(email);
  if (isDisposableEmailDomain(domain)) {
    return `Disposable or throwaway email domain (${domain}).`;
  }
  return numericSpamLocalPartReason(local);
}

/**
 * @param {Array<{ id: string, email?: string, created_at?: string, profile?: object }>} users
 * @param {Set<string>} dismissedIds
 */
function buildAdminInvestigationFlags(users, dismissedIds) {
  /** @type {{ id: string, userId: string, email: string, reason: string, kind: string }[]} */
  const out = [];
  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;

  for (const u of users) {
    if (!u?.id || !u.email) continue;

    const ghost =
      !u.profile &&
      u.created_at &&
      now - new Date(u.created_at).getTime() > ms24h;
    if (ghost) {
      const id = `ghost:${u.id}`;
      if (!dismissedIds.has(id)) {
        out.push({
          id,
          userId: u.id,
          email: u.email,
          kind: 'Incomplete signup',
          reason:
            'Auth account exists for more than 24 hours with no profile row (incomplete signup / ghost account).',
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
    <div style={{
      position: 'fixed', inset: 0, ...GLASS_MODAL_OVERLAY_BASE, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        ...GLASS_MODAL_PANEL,
        borderRadius: 14, padding: 28, maxWidth: 420, width: '90%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, color: COLORS.white, marginBottom: 8, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 24, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button type="button" variant="secondary" onClick={onCancel} style={{ padding: '9px 20px', borderRadius: 8, color: COLORS.white, fontSize: 13, ...FONT }}>
            Cancel
          </Button>
          <Button type="button" variant={danger ? 'danger' : 'primary'} onClick={onConfirm} style={{ padding: '9px 20px', borderRadius: 8, color: COLORS.white, fontSize: 13, fontWeight: 700, ...FONT }}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [callerRole, setCallerRole] = useState(null);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmRoleChange, setConfirmRoleChange] = useState(null);
  const [roleDropdownUserId, setRoleDropdownUserId] = useState(null);
  const [editingTier, setEditingTier] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [dismissedFlagIds, setDismissedFlagIds] = useState(() => readDismissedAdminFlags());
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

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
    const { data: { session } } = await supabase.auth.getSession();
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
      if (!session) { navigate('/login'); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', session.user.id)
        .single();
      const allowed =
        ['admin', 'staff'].includes(profile?.role) || profile?.is_admin;
      if (!allowed) { navigate('/dashboard'); return; }
      loadUsers();
    });
  }, [navigate]);

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
        setUsers(prev => prev.filter(u => u.id !== userId));
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
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, profile: { ...u.profile, subscription_tier: tier } } : u
        ));
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
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, profile: { ...u.profile, role: roleSlug } } : u
        ));
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

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.profile?.business_name?.toLowerCase().includes(search.toLowerCase());
    const matchTier = tierFilter === 'all' ||
      (u.profile?.subscription_tier || 'basic').toLowerCase() === tierFilter;
    return matchSearch && matchTier;
  });

  const stats = {
    total: users.length,
    creatives: users.filter(u => u.profile).length,
    elite: users.filter(u => u.profile?.subscription_tier === 'elite').length,
    expert: users.filter(u => u.profile?.subscription_tier === 'expert').length,
    staff: users.filter(u => u.profile?.role === 'staff').length,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', ...FONT, padding: '24px 28px' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 2000,
          padding: '12px 20px', borderRadius: 10,
          background: toast.type === 'error' ? COLORS.pink : COLORS.green,
          color: '#fff', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Confirm modal */}
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

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ ...TYPO.heading, fontSize: 22, fontWeight: 800, color: COLORS.white }}>Admin Panel</div>
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>LensTrybe user management</div>
        </div>
        <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')} style={{ padding: '8px 16px', borderRadius: 8, color: COLORS.muted, fontSize: 13, ...FONT }}>
          Back to Dashboard
        </Button>
      </div>

      {/* Analytics */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          ...TYPO.heading,
          fontSize: 13,
          fontWeight: 700,
          color: COLORS.muted,
          marginBottom: 10,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          Analytics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[
            { label: 'Total Users', value: stats.total, color: COLORS.white },
            { label: 'Creatives', value: stats.creatives, color: COLORS.blue },
            { label: 'Elite', value: stats.elite, color: COLORS.green },
            { label: 'Expert', value: stats.expert, color: COLORS.yellow },
            { label: 'Staff', value: stats.staff, color: COLORS.blue },
          ].map(s => (
            <div key={s.label} style={{
              ...(s.color === COLORS.green ? GLASS_CARD_GREEN : GLASS_CARD),
              borderRadius: 10, padding: '14px 16px',
            }}>
              <div style={{ ...TYPO.stat, fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ ...TYPO.label, fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Flags — investigation (dismissals stored in localStorage on this device) */}
      {investigationFlags.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            ...TYPO.heading,
            fontSize: 13,
            fontWeight: 700,
            color: COLORS.muted,
            marginBottom: 6,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            Flags
          </div>
          <div style={{ fontSize: 12, color: COLORS.dim, marginBottom: 12, lineHeight: 1.45 }}>
            Automatic review signals. Dismiss hides a card on refresh for this browser only.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {investigationFlags.map((f) => {
              const showDelete = callerRole === 'admin';
              const busy = actionLoading === f.userId;
              return (
                <div
                  key={f.id}
                  style={{
                    position: 'relative',
                    borderRadius: 12,
                    padding: '14px 16px 14px 44px',
                    background: COLORS.pinkDim,
                    border: `1px solid ${COLORS.pink}`,
                    boxShadow: '0 0 0 1px rgba(255,45,120,0.08) inset',
                  }}
                >
                  <button
                    type="button"
                    aria-label="Dismiss flag"
                    onClick={() => dismissInvestigationFlag(f.id)}
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: `1px solid rgba(255,45,120,0.45)`,
                      background: 'rgba(0,0,0,0.2)',
                      color: COLORS.pink,
                      cursor: 'pointer',
                      fontSize: 16,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...FONT,
                    }}
                  >
                    ×
                  </button>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.pink, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                    {f.kind}
                  </div>
                  <div style={{ fontSize: 14, color: COLORS.white, fontWeight: 600, marginBottom: 6 }}>{f.email}</div>
                  <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.45, marginBottom: showDelete ? 12 : 0 }}>{f.reason}</div>
                  {showDelete && (
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
                        cursor: busy ? 'wait' : 'pointer',
                        fontWeight: 700,
                        opacity: busy ? 0.55 : 1,
                        ...FONT,
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email or business name..."
          style={{
            ...GLASS_NATIVE_FIELD,
            flex: 1, padding: '9px 14px', borderRadius: 8,
            color: COLORS.white, fontSize: 13, outline: 'none', ...FONT,
          }}
        />
        {['all', 'elite', 'expert', 'pro', 'basic'].map(t => (
          <button key={t} type="button" onClick={() => setTierFilter(t)} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', textTransform: 'capitalize', ...FONT,
            background: tierFilter === t ? COLORS.greenDim : COLORS.panel,
            border: `1px solid ${tierFilter === t ? COLORS.green : COLORS.border}`,
            color: tierFilter === t ? COLORS.green : COLORS.muted,
          }}>
            {t === 'all' ? 'All' : t}
          </button>
        ))}
        <Button type="button" variant="secondary" onClick={loadUsers} style={{ padding: '8px 14px', borderRadius: 8, color: COLORS.muted, fontSize: 13, ...FONT }}>
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div style={{
        ...GLASS_CARD,
        borderRadius: 12, overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 140px',
          padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          fontSize: 11, fontWeight: 700, color: COLORS.dim, textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          <div>User</div>
          <div>Business</div>
          <div>Tier</div>
          <div>Joined</div>
          <div>Role</div>
          <div>Actions</div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: COLORS.muted, fontSize: 13 }}>
            Loading users...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: COLORS.muted, fontSize: 13 }}>
            No users found
          </div>
        ) : (
          filtered.map((u, i) => {
            const isLoading = actionLoading === u.id;
            const tier = u.profile ? (u.profile.subscription_tier || 'basic') : null;
            const displayRole = (u.profile?.role || 'user').toLowerCase();
            const roleLabel = displayRole.charAt(0).toUpperCase() + displayRole.slice(1);
            const joined = new Date(u.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
            const canEditTier = callerRole === 'admin';
            const canEditRole = callerRole === 'admin' && u.profile;
            const showDelete = callerRole === 'admin';

            return (
              <div key={u.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 140px',
                padding: '12px 16px',
                borderBottom: i < filtered.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                alignItems: 'center',
                opacity: isLoading ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}>
                {/* Email */}
                <div>
                  <div style={{ fontSize: 13, color: COLORS.white, fontWeight: 500 }}>{u.email}</div>
                  {u.profile?.location && (
                    <div style={{ fontSize: 11, color: COLORS.dim, marginTop: 2 }}>{u.profile.location}</div>
                  )}
                </div>

                {/* Business */}
                <div style={{ fontSize: 13, color: COLORS.muted }}>
                  {u.profile?.business_name || (u.profile ? 'No business name' : 'Client account')}
                </div>

                {/* Tier */}
                <div>
                  {!u.profile ? (
                    <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 400 }}>N/A</span>
                  ) : editingTier === u.id ? (
                    <select
                      defaultValue={tier}
                      onChange={e => handleUpdateTier(u.id, e.target.value)}
                      onBlur={() => setEditingTier(null)}
                      autoFocus
                      style={{
                        background: COLORS.panelAlt, border: `1px solid ${COLORS.green}`,
                        borderRadius: 6, color: COLORS.white, fontSize: 12, padding: '3px 6px',
                        cursor: 'pointer', outline: 'none', ...FONT,
                      }}
                    >
                      {['basic', 'pro', 'expert', 'elite'].map(t => (
                        <option key={t} value={t}>{t}</option>
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

                {/* Joined */}
                <div style={{ fontSize: 12, color: COLORS.muted }}>{joined}</div>

                {/* Role */}
                <div>
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
                        background: COLORS.panelAlt, border: `1px solid ${COLORS.green}`,
                        borderRadius: 6, color: COLORS.white, fontSize: 12, padding: '3px 6px',
                        cursor: 'pointer', outline: 'none', ...FONT,
                      }}
                    >
                      {['user', 'staff', 'admin'].map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
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

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {showDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ id: u.id, email: u.email })}
                      disabled={isLoading}
                      style={{
                        padding: '5px 10px', background: COLORS.pinkDim,
                        border: `1px solid ${COLORS.pink}`, borderRadius: 6,
                        color: COLORS.pink, fontSize: 12, cursor: 'pointer', fontWeight: 600, ...FONT,
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
