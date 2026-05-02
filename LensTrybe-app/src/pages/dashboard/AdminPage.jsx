import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

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

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: COLORS.panel, border: `1px solid ${COLORS.border}`,
        borderRadius: 14, padding: 28, maxWidth: 380, width: '90%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, color: COLORS.white, marginBottom: 8, fontWeight: 600 }}>Are you sure?</div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 24, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button type="button" onClick={onCancel} style={{
            padding: '9px 20px', background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`,
            borderRadius: 8, color: COLORS.white, fontSize: 13, cursor: 'pointer', ...FONT,
          }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} style={{
            padding: '9px 20px', background: COLORS.pink, border: 'none',
            borderRadius: 8, color: COLORS.white, fontSize: 13, fontWeight: 700, cursor: 'pointer', ...FONT,
          }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingTier, setEditingTier] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

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
        .select('is_admin')
        .eq('id', session.user.id)
        .single();
      if (!profile?.is_admin) { navigate('/dashboard'); return; }
      loadUsers();
    });
  }, [navigate]);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await callEdge({ action: 'list_users' });
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

  async function handleToggleAdmin(userId, currentValue) {
    setActionLoading(userId);
    try {
      const data = await callEdge({ action: 'toggle_admin', userId, isAdmin: !currentValue });
      if (data.success) {
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, profile: { ...u.profile, is_admin: !currentValue } } : u
        ));
        showToast(!currentValue ? 'Admin access granted' : 'Admin access removed');
      } else {
        showToast(data.error || 'Failed to update admin', 'error');
      }
    } catch (e) {
      showToast('Failed to update admin', 'error');
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
    pro: users.filter(u => u.profile?.subscription_tier === 'pro').length,
    basic: users.filter(u => u.profile?.subscription_tier === 'basic' || !u.profile).length,
  };

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, ...FONT, padding: '24px 28px' }}>

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
          message={`This will permanently delete ${confirmDelete.email} and all their data. This cannot be undone.`}
          onConfirm={() => handleDeleteUser(confirmDelete.id, confirmDelete.email)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.white }}>Admin Panel</div>
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>LensTrybe user management</div>
        </div>
        <button type="button" onClick={() => navigate('/dashboard')} style={{
          padding: '8px 16px', background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`,
          borderRadius: 8, color: COLORS.muted, fontSize: 13, cursor: 'pointer', ...FONT,
        }}>
          Back to Dashboard
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Users', value: stats.total, color: COLORS.white },
          { label: 'Creatives', value: stats.creatives, color: COLORS.blue },
          { label: 'Elite', value: stats.elite, color: COLORS.green },
          { label: 'Expert', value: stats.expert, color: COLORS.yellow },
          { label: 'Pro', value: stats.pro, color: COLORS.blue },
        ].map(s => (
          <div key={s.label} style={{
            background: COLORS.panel, border: `1px solid ${COLORS.border}`,
            borderRadius: 10, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email or business name..."
          style={{
            flex: 1, padding: '9px 14px', background: COLORS.panel,
            border: `1px solid ${COLORS.border}`, borderRadius: 8,
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
        <button type="button" onClick={loadUsers} style={{
          padding: '8px 14px', background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`,
          borderRadius: 8, color: COLORS.muted, fontSize: 13, cursor: 'pointer', ...FONT,
        }}>
          Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{
        background: COLORS.panel, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 140px',
          padding: '10px 16px', borderBottom: `1px solid ${COLORS.border}`,
          fontSize: 11, fontWeight: 700, color: COLORS.dim, textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          <div>User</div>
          <div>Business</div>
          <div>Tier</div>
          <div>Joined</div>
          <div>Admin</div>
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
            const isAdmin = u.profile?.is_admin || false;
            const joined = new Date(u.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

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
                    <div onClick={() => setEditingTier(u.id)} style={{ cursor: 'pointer' }}>
                      <TierBadge tier={tier} />
                    </div>
                  )}
                </div>

                {/* Joined */}
                <div style={{ fontSize: 12, color: COLORS.muted }}>{joined}</div>

                {/* Admin toggle */}
                <div>
                  {u.profile ? (
                    <button
                      type="button"
                      onClick={() => handleToggleAdmin(u.id, isAdmin)}
                      disabled={isLoading}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', ...FONT,
                        background: isAdmin ? COLORS.yellowDim : COLORS.panelAlt,
                        border: `1px solid ${isAdmin ? COLORS.yellow : COLORS.border}`,
                        color: isAdmin ? COLORS.yellow : COLORS.dim,
                      }}
                    >
                      {isAdmin ? 'Admin' : 'User'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: COLORS.dim }}>N/A</span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
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
