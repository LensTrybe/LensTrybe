import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

const fmt = (n) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n || 0);

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—';

const statusColor = {
  paid: '#39ff14', confirmed: '#39ff14', active: '#39ff14',
  sent: '#3b82f6', pending: '#f59e0b',
  overdue: '#ef4444', cancelled: '#ef4444', declined: '#ef4444',
  draft: '#555', lead: '#888',
};

export default function HomePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ totalRevenue: 0, pendingRevenue: 0, totalBookings: 0, unreadMessages: 0, totalContacts: 0, totalInvoices: 0 });
  const [recentBookings, setRecentBookings] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) loadAll(data.user.id);
    });
  }, []);

  const loadAll = async (uid) => {
    setLoading(true);
    await Promise.all([fetchProfile(uid), fetchStats(uid), fetchRecentBookings(uid), fetchRecentInvoices(uid), fetchRecentMessages(uid)]);
    setLoading(false);
  };

  const fetchProfile = async (uid) => {
    const { data } = await supabase.from('profiles').select('business_name, avatar_url').eq('id', uid).single();
    if (data) setProfile(data);
  };

  const fetchStats = async (uid) => {
    const [invoiceRes, bookingRes, messageRes, contactRes] = await Promise.all([
      supabase.from('invoices').select('amount, status').eq('creative_id', uid),
      supabase.from('bookings').select('id').eq('creative_id', uid),
      supabase.from('messages').select('id').eq('creative_id', uid).eq('read', false),
      supabase.from('crm_contacts').select('id').eq('creative_id', uid),
    ]);
    const invoices = invoiceRes.data || [];
    const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0);
    const pendingRevenue = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + Number(i.amount || 0), 0);
    setStats({ totalRevenue, pendingRevenue, totalBookings: (bookingRes.data||[]).length, unreadMessages: (messageRes.data||[]).length, totalContacts: (contactRes.data||[]).length, totalInvoices: invoices.length });
  };

  const fetchRecentBookings = async (uid) => {
    const { data } = await supabase.from('bookings').select('*').eq('creative_id', uid).order('created_at', { ascending: false }).limit(5);
    setRecentBookings(data || []);
  };

  const fetchRecentInvoices = async (uid) => {
    const { data } = await supabase.from('invoices').select('*').eq('creative_id', uid).order('created_at', { ascending: false }).limit(5);
    setRecentInvoices(data || []);
  };

  const fetchRecentMessages = async (uid) => {
    const { data } = await supabase.from('message_threads').select('*').eq('creative_id', uid).order('last_message_at', { ascending: false }).limit(5);
    setRecentMessages(data || []);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = profile?.business_name?.split(' ')[0] || 'there';

  const statCards = [
    { label: 'Total Revenue', value: fmt(stats.totalRevenue), icon: '💰', color: '#39ff14', sub: 'from paid invoices', path: '/dashboard/finance/invoicing' },
    { label: 'Pending Revenue', value: fmt(stats.pendingRevenue), icon: '⏳', color: '#f59e0b', sub: 'awaiting payment', path: '/dashboard/finance/invoicing' },
    { label: 'Total Bookings', value: stats.totalBookings, icon: '📅', color: '#3b82f6', sub: 'all time', path: '/dashboard/my-work/my-bookings' },
    { label: 'Unread Messages', value: stats.unreadMessages, icon: '💬', color: '#a855f7', sub: 'from clients', path: '/dashboard/clients/messages' },
    { label: 'Total Contacts', value: stats.totalContacts, icon: '👥', color: '#ec4899', sub: 'in your CRM', path: '/dashboard/clients/crm' },
    { label: 'Total Invoices', value: stats.totalInvoices, icon: '🧾', color: '#06b6d4', sub: 'all time', path: '/dashboard/finance/invoicing' },
  ];

  if (loading) return <div style={{ padding: 32, color: '#888' }}>Loading dashboard…</div>;

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 }}>{greeting}, {name} 👋</h1>
        <p style={{ color: '#888', marginTop: 6, fontSize: 15 }}>Here is what is happening with your business today.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 36 }}>
        {statCards.map((s) => (
          <div key={s.label} onClick={() => navigate(s.path)} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, padding: '22px 24px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{s.label}</div>
                <div style={{ color: s.color, fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{s.value}</div>
                <div style={{ color: '#555', fontSize: 12, marginTop: 6 }}>{s.sub}</div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{s.icon}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 }}>Recent Bookings</h3>
            <button onClick={() => navigate('/dashboard/my-work/my-bookings')} style={{ background: 'none', border: 'none', color: '#39ff14', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View all</button>
          </div>
          {recentBookings.length === 0 ? <div style={{ textAlign: 'center', padding: '28px 0', color: '#555' }}>No bookings yet</div> : recentBookings.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #222' }}>
              <div><div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{b.client_name}</div><div style={{ color: '#666', fontSize: 12 }}>{b.service} · {formatDate(b.booking_date)}</div></div>
              <span style={{ background: (statusColor[b.status]||'#555') + '22', color: statusColor[b.status]||'#555', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{b.status}</span>
            </div>
          ))}
        </div>
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 }}>Recent Invoices</h3>
            <button onClick={() => navigate('/dashboard/finance/invoicing')} style={{ background: 'none', border: 'none', color: '#39ff14', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View all</button>
          </div>
          {recentInvoices.length === 0 ? <div style={{ textAlign: 'center', padding: '28px 0', color: '#555' }}>No invoices yet</div> : recentInvoices.map(inv => (
            <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #222' }}>
              <div><div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{inv.client_name}</div><div style={{ color: '#666', fontSize: 12 }}>Due {formatDate(inv.due_date)}</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{fmt(inv.amount)}</span>
                <span style={{ background: (statusColor[inv.status]||'#555') + '22', color: statusColor[inv.status]||'#555', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{inv.status}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, padding: 24, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 }}>Recent Messages</h3>
            <button onClick={() => navigate('/dashboard/clients/messages')} style={{ background: 'none', border: 'none', color: '#39ff14', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View all</button>
          </div>
          {recentMessages.length === 0 ? <div style={{ textAlign: 'center', padding: '28px 0', color: '#555' }}>No messages yet</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {recentMessages.map(t => (
                <div key={t.id} onClick={() => navigate('/dashboard/clients/messages')} style={{ background: '#252525', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{t.client_name}</span>
                    {t.unread_count > 0 && <span style={{ background: '#a855f7', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{t.unread_count}</span>}
                  </div>
                  <div style={{ color: '#888', fontSize: 12 }}>{t.subject || t.client_email}</div>
                  <div style={{ color: '#555', fontSize: 11, marginTop: 6 }}>{formatDate(t.last_message_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 24, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, padding: 24 }}>
        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: '+ New Invoice', path: '/dashboard/finance/invoicing', color: '#39ff14' },
            { label: '+ New Quote', path: '/dashboard/finance/quotes', color: '#3b82f6' },
            { label: '+ New Contract', path: '/dashboard/finance/contracts', color: '#a855f7' },
            { label: '+ Deliver Files', path: '/dashboard/portfolio-design/deliver', color: '#f59e0b' },
            { label: '+ Add Contact', path: '/dashboard/clients/crm', color: '#ec4899' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} style={{ background: a.color + '18', color: a.color, border: `1px solid ${a.color}44`, padding: '9px 18px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
