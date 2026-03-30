import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

const formatCurrency = (n) => "$" + Number(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (ts) => new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });

export default function InsightsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);
  const [period, setPeriod] = useState("all");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user, period]);

  const fetchAll = async () => {
    setLoading(true);

    const dateFilter = period === "30d"
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : period === "90d"
      ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const base = (table) => {
      let q = supabase.from(table).select("*").eq("creative_id", user.id);
      if (dateFilter) q = q.gte("created_at", dateFilter);
      return q;
    };

    const [inv, quo, con, book, contacts, msgs, reviews, deliveries] = await Promise.all([
      base("invoices"),
      base("quotes"),
      base("contracts"),
      base("bookings"),
      base("crm_contacts"),
      base("messages"),
      base("reviews"),
      supabase.from("deliveries").select("*").eq("creative_id", user.id),
    ]);

    const invoices = inv.data || [];
    const quotes = quo.data || [];
    const contracts = con.data || [];
    const bookings = book.data || [];
    const crmContacts = contacts.data || [];
    const messages = msgs.data || [];
    const revs = reviews.data || [];
    const dels = deliveries.data || [];

    const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount || 0), 0);
    const pendingRevenue = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + Number(i.amount || 0), 0);
    const avgInvoice = invoices.length ? invoices.reduce((s, i) => s + Number(i.amount || 0), 0) / invoices.length : 0;
    const avgRating = revs.length ? revs.reduce((s, r) => s + (r.rating || 0), 0) / revs.length : 0;
    const conversionRate = quotes.length ? ((quotes.filter((q) => q.status === "accepted" || q.status === "converted").length / quotes.length) * 100).toFixed(0) : 0;

    setStats({
      totalRevenue,
      pendingRevenue,
      avgInvoice,
      totalInvoices: invoices.length,
      paidInvoices: invoices.filter((i) => i.status === "paid").length,
      totalQuotes: quotes.length,
      acceptedQuotes: quotes.filter((q) => q.status === "accepted" || q.status === "converted").length,
      conversionRate,
      totalContracts: contracts.length,
      signedContracts: contracts.filter((c) => c.status === "signed").length,
      totalBookings: bookings.length,
      totalContacts: crmContacts.length,
      totalMessages: messages.length,
      totalReviews: revs.length,
      avgRating: avgRating.toFixed(1),
      totalDeliveries: dels.length,
      downloadedDeliveries: dels.filter((d) => d.downloaded_at).length,
    });

    // Recent invoices
    setRecentInvoices(
      invoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5)
    );

    // Recent bookings
    setRecentBookings(
      bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5)
    );

    // Monthly revenue chart (last 6 months)
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString([], { month: "short" });
      const year = d.getFullYear();
      const month = d.getMonth();
      const revenue = invoices
        .filter((inv) => {
          const d2 = new Date(inv.created_at);
          return d2.getMonth() === month && d2.getFullYear() === year && inv.status === "paid";
        })
        .reduce((s, inv) => s + Number(inv.amount || 0), 0);
      months.push({ label, revenue });
    }
    setMonthlyRevenue(months);
    setLoading(false);
  };

  const maxRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 1);

  const statusColor = (status) => {
    const map = { paid: "#39ff14", draft: "#666", sent: "#facc15", overdue: "#f87171", accepted: "#39ff14", signed: "#39ff14", declined: "#f87171", converted: "#a78bfa", pending: "#facc15" };
    return map[status] || "#666";
  };

  const styles = `
    .insights-wrap { padding: 28px 32px; background: #0f0f0f; min-height: 100vh; color: #e8e8e8; font-family: 'DM Sans', system-ui, sans-serif; }
    .insights-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .insights-title { font-size: 22px; font-weight: 700; color: #fff; }
    .insights-subtitle { font-size: 13px; color: #555; margin-top: 4px; }
    .period-tabs { display: flex; gap: 6px; }
    .period-tab { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 6px; padding: 6px 14px; font-size: 12px; color: #666; cursor: pointer; }
    .period-tab.active { border-color: #39ff14; color: #39ff14; background: #1a2a1a; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px; }
    .stat-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 18px 20px; }
    .stat-label { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 8px; }
    .stat-value { font-size: 26px; font-weight: 800; color: #fff; line-height: 1; }
    .stat-sub { font-size: 12px; color: #555; margin-top: 6px; }
    .stat-value.green { color: #39ff14; }
    .stat-value.yellow { color: #facc15; }
    .stat-value.purple { color: #a78bfa; }
    .insights-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .insights-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 20px; }
    .insights-card-title { font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 16px; }
    .chart-wrap { display: flex; align-items: flex-end; gap: 8px; height: 120px; }
    .chart-bar-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; height: 100%; justify-content: flex-end; }
    .chart-bar { width: 100%; border-radius: 4px 4px 0 0; background: #1e2a1e; border: 1px solid #2a4a2a; transition: height 0.3s; min-height: 4px; }
    .chart-bar.has-value { background: #39ff14; border-color: #39ff14; opacity: 0.8; }
    .chart-label { font-size: 10px; color: #555; }
    .chart-amount { font-size: 9px; color: #39ff14; text-align: center; }
    .table-wrap { display: flex; flex-direction: column; gap: 8px; }
    .table-row { display: flex; align-items: center; gap: 12px; padding: 8px 10px; background: #1a1a1a; border-radius: 8px; }
    .table-name { flex: 1; font-size: 13px; color: #e8e8e8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .table-amount { font-size: 13px; color: #fff; font-weight: 600; white-space: nowrap; }
    .table-status { font-size: 10px; font-weight: 700; border-radius: 4px; padding: 2px 7px; border: 1px solid; text-transform: uppercase; white-space: nowrap; }
    .table-date { font-size: 11px; color: #555; white-space: nowrap; }
    .empty-row { font-size: 13px; color: #444; text-align: center; padding: 20px 0; }
    .progress-wrap { display: flex; flex-direction: column; gap: 12px; }
    .progress-item { display: flex; flex-direction: column; gap: 6px; }
    .progress-label-row { display: flex; justify-content: space-between; font-size: 12px; }
    .progress-label { color: #aaa; }
    .progress-value { color: #fff; font-weight: 600; }
    .progress-bar-bg { background: #1e1e1e; border-radius: 4px; height: 8px; overflow: hidden; }
    .progress-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
    .star { color: #facc15; font-size: 14px; }
  `;

  if (loading) return (
    <>
      <style>{styles}</style>
      <div className="insights-wrap">
        <div style={{ color: "#444", fontSize: 14, padding: "60px 0", textAlign: "center" }}>Loading insights...</div>
      </div>
    </>
  );

  return (
    <>
      <style>{styles}</style>
      <div className="insights-wrap">
        <div className="insights-header">
          <div>
            <div className="insights-title">Insights</div>
            <div className="insights-subtitle">Your business at a glance</div>
          </div>
          <div className="period-tabs">
            {[["30d", "30 days"], ["90d", "90 days"], ["all", "All time"]].map(([val, label]) => (
              <button key={val} className={"period-tab " + (period === val ? "active" : "")} onClick={() => setPeriod(val)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Key Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value green">{formatCurrency(stats.totalRevenue)}</div>
            <div className="stat-sub">{stats.paidInvoices} paid invoice{stats.paidInvoices !== 1 ? "s" : ""}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Revenue</div>
            <div className="stat-value yellow">{formatCurrency(stats.pendingRevenue)}</div>
            <div className="stat-sub">Awaiting payment</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Invoice Value</div>
            <div className="stat-value">{formatCurrency(stats.avgInvoice)}</div>
            <div className="stat-sub">{stats.totalInvoices} invoice{stats.totalInvoices !== 1 ? "s" : ""} total</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Quote Conversion</div>
            <div className="stat-value purple">{stats.conversionRate}%</div>
            <div className="stat-sub">{stats.acceptedQuotes} of {stats.totalQuotes} quotes</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Bookings</div>
            <div className="stat-value">{stats.totalBookings}</div>
            <div className="stat-sub">Total bookings</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Rating</div>
            <div className="stat-value yellow">{stats.totalReviews > 0 ? stats.avgRating : "—"}</div>
            <div className="stat-sub">
              {stats.totalReviews > 0
                ? Array.from({ length: Math.round(stats.avgRating) }).map((_, i) => <span key={i} className="star">★</span>)
                : "No reviews yet"}
            </div>
          </div>
        </div>

        {/* Revenue Chart + Activity */}
        <div className="insights-row">
          <div className="insights-card">
            <div className="insights-card-title">Monthly Revenue</div>
            <div className="chart-wrap">
              {monthlyRevenue.map((m, i) => (
                <div key={i} className="chart-bar-wrap">
                  {m.revenue > 0 && <div className="chart-amount">{formatCurrency(m.revenue)}</div>}
                  <div
                    className={"chart-bar " + (m.revenue > 0 ? "has-value" : "")}
                    style={{ height: ((m.revenue / maxRevenue) * 100) + "%" }}
                  />
                  <div className="chart-label">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="insights-card">
            <div className="insights-card-title">Business Overview</div>
            <div className="progress-wrap">
              {[
                { label: "Contracts Signed", value: stats.signedContracts, total: stats.totalContracts, color: "#39ff14" },
                { label: "Quotes Accepted", value: stats.acceptedQuotes, total: stats.totalQuotes, color: "#a78bfa" },
                { label: "Invoices Paid", value: stats.paidInvoices, total: stats.totalInvoices, color: "#facc15" },
                { label: "Files Downloaded", value: stats.downloadedDeliveries, total: stats.totalDeliveries, color: "#38bdf8" },
              ].map((item) => (
                <div key={item.label} className="progress-item">
                  <div className="progress-label-row">
                    <span className="progress-label">{item.label}</span>
                    <span className="progress-value">{item.value} / {item.total}</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: item.total > 0 ? (item.value / item.total * 100) + "%" : "0%",
                        background: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="insights-row">
          <div className="insights-card">
            <div className="insights-card-title">Recent Invoices</div>
            <div className="table-wrap">
              {recentInvoices.length === 0 ? (
                <div className="empty-row">No invoices yet</div>
              ) : recentInvoices.map((inv) => (
                <div key={inv.id} className="table-row">
                  <div className="table-name">{inv.client_name}</div>
                  <div className="table-amount">{formatCurrency(inv.amount)}</div>
                  <span className="table-status" style={{ color: statusColor(inv.status), borderColor: statusColor(inv.status) + "44" }}>
                    {inv.status}
                  </span>
                  <div className="table-date">{formatDate(inv.created_at)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="insights-card">
            <div className="insights-card-title">Recent Bookings</div>
            <div className="table-wrap">
              {recentBookings.length === 0 ? (
                <div className="empty-row">No bookings yet</div>
              ) : recentBookings.map((b) => (
                <div key={b.id} className="table-row">
                  <div className="table-name">{b.client_name}</div>
                  <div className="table-name" style={{ fontSize: 11, color: "#666" }}>{b.service}</div>
                  <span className="table-status" style={{ color: statusColor(b.status), borderColor: statusColor(b.status) + "44" }}>
                    {b.status}
                  </span>
                  <div className="table-date">{b.booking_date ? formatDate(b.booking_date) : ""}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="insights-row">
          <div className="insights-card">
            <div className="insights-card-title">Client Stats</div>
            <div className="table-wrap">
              {[
                { label: "Total Contacts", value: stats.totalContacts, icon: "👥" },
                { label: "Messages Sent", value: stats.totalMessages, icon: "💬" },
                { label: "Files Delivered", value: stats.totalDeliveries, icon: "📦" },
                { label: "Client Portals", value: "—", icon: "🔗" },
              ].map((item) => (
                <div key={item.label} className="table-row">
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <div className="table-name">{item.label}</div>
                  <div className="table-amount">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="insights-card">
            <div className="insights-card-title">Finance Summary</div>
            <div className="table-wrap">
              {[
                { label: "Total Invoiced", value: formatCurrency(recentInvoices.reduce((s, i) => s + Number(i.amount || 0), 0)), icon: "💰" },
                { label: "Total Quotes", value: stats.totalQuotes, icon: "📋" },
                { label: "Contracts Signed", value: stats.signedContracts, icon: "📝" },
                { label: "Reviews", value: stats.totalReviews, icon: "⭐" },
              ].map((item) => (
                <div key={item.label} className="table-row">
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <div className="table-name">{item.label}</div>
                  <div className="table-amount">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
