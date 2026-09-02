// Shared styling + helpers for the Finance hub (Overview, Expenses, Tax).
// Everything is theme-aware via the dashboard's --lt-* CSS variables, so the
// same markup works in light and dark mode. Backgrounds stay transparent so the
// pages sit on the dashboard's moving-squares background.

// ── Money + numbers ────────────────────────────────────────────
export function money(v, opts = {}) {
  const n = Number(v)
  if (v == null || v === '' || Number.isNaN(n)) return '$0'
  return '$' + n.toLocaleString('en-AU', {
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

export function money0(v) {
  const n = Number(v) || 0
  return '$' + Math.round(n).toLocaleString('en-AU')
}

// Compact money for chart axes / tight spots: $1.2k, $12k, $1.4m
export function moneyShort(v) {
  const n = Number(v) || 0
  const a = Math.abs(n)
  if (a >= 1_000_000) return '$' + (n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace(/\.0$/, '') + 'm'
  if (a >= 1_000) return '$' + (n / 1_000).toFixed(a >= 10_000 ? 0 : 1).replace(/\.0$/, '') + 'k'
  return '$' + Math.round(n)
}

// ── Australian financial year (1 July – 30 June) ───────────────
// FY is identified by its STARTING calendar year. FY starting 2025 = "FY 2025–26".
export function fyStartYear(date, startMonth = 7) {
  const d = date ? new Date(date) : new Date()
  const m = d.getMonth() + 1 // 1-12
  return m >= startMonth ? d.getFullYear() : d.getFullYear() - 1
}

export function fyRange(startYear, startMonth = 7) {
  const start = new Date(startYear, startMonth - 1, 1)
  const end = new Date(startYear + 1, startMonth - 1, 0, 23, 59, 59, 999) // last day before next FY
  return { start, end }
}

export function fyLabel(startYear) {
  const end = (startYear + 1) % 100
  return `FY ${startYear}–${String(end).padStart(2, '0')}`
}

// The four BAS quarters within a FY (AU standard: Jul-Sep, Oct-Dec, Jan-Mar, Apr-Jun).
export function fyQuarters(startYear, startMonth = 7) {
  const out = []
  for (let i = 0; i < 4; i++) {
    const qStartMonthIndex = (startMonth - 1 + i * 3) % 12
    const qStartYear = startYear + Math.floor((startMonth - 1 + i * 3) / 12)
    const start = new Date(qStartYear, qStartMonthIndex, 1)
    const end = new Date(qStartYear, qStartMonthIndex + 3, 0, 23, 59, 59, 999)
    const labels = ['Q1', 'Q2', 'Q3', 'Q4']
    out.push({
      key: labels[i],
      label: labels[i],
      months: `${start.toLocaleDateString('en-AU', { month: 'short' })}–${new Date(qStartYear, qStartMonthIndex + 2, 1).toLocaleDateString('en-AU', { month: 'short' })}`,
      start,
      end,
    })
  }
  return out
}

// Ordered list of the 12 months in a FY, each with its calendar range.
export function fyMonths(startYear, startMonth = 7) {
  const out = []
  for (let i = 0; i < 12; i++) {
    const mi = (startMonth - 1 + i) % 12
    const y = startYear + Math.floor((startMonth - 1 + i) / 12)
    const start = new Date(y, mi, 1)
    const end = new Date(y, mi + 1, 0, 23, 59, 59, 999)
    out.push({ label: start.toLocaleDateString('en-AU', { month: 'short' }), start, end, y, mi })
  }
  return out
}

export function inRange(dateStr, start, end) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  return d >= start && d <= end
}

export function prettyDate(d) {
  if (!d) return '—'
  const dt = new Date(d.length <= 10 ? d + 'T00:00:00' : d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// GST on a GST-inclusive amount (AU 10%): the GST component is amount / 11.
export function gstComponent(inclAmount) {
  const n = Number(inclAmount) || 0
  return n / 11
}

// ── AU deduction categories for visual creatives ───────────────
export const EXPENSE_CATEGORIES = [
  { key: 'equipment', label: 'Equipment & gear', color: '#4aa3ff' },
  { key: 'software', label: 'Software & subscriptions', color: '#9b6bff' },
  { key: 'travel', label: 'Travel & transport', color: '#f5a524' },
  { key: 'home_office', label: 'Home office', color: '#38d16f' },
  { key: 'marketing', label: 'Marketing & advertising', color: '#FF2D78' },
  { key: 'education', label: 'Education & training', color: '#1DB954' },
  { key: 'insurance', label: 'Insurance', color: '#5ac8fa' },
  { key: 'wardrobe', label: 'Props & wardrobe', color: '#e08cc0' },
  { key: 'contractors', label: 'Contractors & assistants', color: '#f0516d' },
  { key: 'fees', label: 'Bank & merchant fees', color: '#8b8f9a' },
  { key: 'phone', label: 'Phone & internet', color: '#7c9cff' },
  { key: 'other', label: 'Other', color: '#b0b0bb' },
]

export const CATEGORY_MAP = EXPENSE_CATEGORIES.reduce((m, c) => { m[c.key] = c; return m }, {})

export function categoryLabel(key) {
  return (CATEGORY_MAP[key] && CATEGORY_MAP[key].label) || 'Other'
}
export function categoryColor(key) {
  return (CATEGORY_MAP[key] && CATEGORY_MAP[key].color) || '#b0b0bb'
}

export const PAYMENT_METHODS = ['Card', 'Bank transfer', 'Cash', 'PayPal', 'Direct debit', 'Other']

// ── Shared CSS (class prefix .ltf) ─────────────────────────────
export const FINANCE_CSS = `
.ltf{position:relative;min-height:60vh;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--lt-text)}
.ltf *{box-sizing:border-box}
.ltf .inner{max-width:1240px;margin:0 auto;position:relative;z-index:1}
.ltf .phead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px;flex-wrap:wrap}
.ltf h1{font-size:26px;font-weight:800;letter-spacing:-0.03em;margin:0}
.ltf .sub{color:var(--lt-muted);font-size:13.5px;margin-top:4px;max-width:640px}
.ltf .hactions{display:flex;gap:10px;align-items:center;flex-shrink:0;flex-wrap:wrap}

.ltf .btn{font-family:inherit;font-size:13px;font-weight:600;border-radius:10px;padding:9px 15px;cursor:pointer;border:1px solid var(--lt-border);background:var(--lt-surface);color:var(--lt-text);display:inline-flex;align-items:center;gap:7px;transition:.15s;white-space:nowrap}
.ltf .btn:hover{background:var(--lt-surface-2)}
.ltf .btn svg{width:15px;height:15px}
.ltf .btn.primary{background:#1DB954;border-color:transparent;color:#04120a;font-weight:700;box-shadow:0 6px 18px -8px rgba(29,185,84,0.7)}
.ltf .btn.primary:hover{background:#22c95f}
.ltf .btn.ghost{background:transparent;border-color:transparent;color:var(--lt-muted)}
.ltf .btn.ghost:hover{color:var(--lt-text);background:var(--lt-surface)}
.ltf .btn.sm{padding:6px 11px;font-size:12px}
.ltf .btn:disabled{opacity:.5;cursor:default}

/* Finance sub-nav tabs */
.ltf .ftabs{display:flex;gap:4px;overflow-x:auto;margin-bottom:22px;padding-bottom:4px;scrollbar-width:none}
.ltf .ftabs::-webkit-scrollbar{display:none}
.ltf .ftab{display:inline-flex;align-items:center;gap:7px;font-family:inherit;font-size:13px;font-weight:600;color:var(--lt-muted);text-decoration:none;padding:8px 14px;border-radius:11px;white-space:nowrap;border:1px solid transparent;transition:.15s;cursor:pointer}
.ltf .ftab svg{width:15px;height:15px}
.ltf .ftab:hover{color:var(--lt-text);background:var(--lt-surface)}
.ltf .ftab.on{color:var(--lt-text);background:var(--lt-surface);border-color:var(--lt-border)}
.ltf .ftab.on .fdot{background:#1DB954}

/* Card */
.ltf .card{border-radius:16px;padding:18px;position:relative;overflow:hidden;background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur)}
.ltf .card.pad0{padding:0}
.ltf .card-t{font-size:14px;font-weight:700;letter-spacing:-0.01em;margin:0 0 2px}
.ltf .card-s{font-size:12px;color:var(--lt-muted);margin-bottom:14px}

/* KPI stat grid */
.ltf .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px}
.ltf .kpi{border-radius:16px;padding:16px 17px;position:relative;overflow:hidden;background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur)}
.ltf .kpi .accent{position:absolute;left:0;top:0;bottom:0;width:3px}
.ltf .kpi .klab{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--lt-muted);display:flex;align-items:center;gap:7px}
.ltf .kpi .kicon{width:15px;height:15px;opacity:.9}
.ltf .kpi .kval{font-size:26px;font-weight:800;letter-spacing:-0.03em;margin-top:8px;font-variant-numeric:tabular-nums}
.ltf .kpi .ksub{font-size:11.5px;color:var(--lt-faint);margin-top:4px}
.ltf .kpi .kpill{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:2px 7px;border-radius:99px;margin-top:8px}

.ltf .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ltf .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.ltf .colspan{display:flex;flex-direction:column;gap:14px}
.ltf .stack{display:flex;flex-direction:column;gap:14px}

/* Progress bar */
.ltf .prog{height:10px;border-radius:99px;background:var(--lt-track);overflow:hidden;margin-top:4px}
.ltf .prog > i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#1DB954,#38d16f);transition:width .5s ease}
.ltf .prow{display:flex;align-items:baseline;justify-content:space-between;gap:8px}

/* Bar chart */
.ltf .chart{display:flex;align-items:flex-end;gap:8px;height:180px;padding-top:10px;position:relative}
.ltf .chart .gl{position:absolute;left:0;right:0;height:1px;background:var(--lt-chart-grid)}
.ltf .cbarwrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end;position:relative;z-index:1}
.ltf .cbars{display:flex;align-items:flex-end;gap:3px;height:100%;width:100%;justify-content:center}
.ltf .cbar{width:11px;border-radius:5px 5px 0 0;min-height:2px;transition:height .4s ease}
.ltf .cbar.inc{background:linear-gradient(180deg,#1DB954,#178f43)}
.ltf .cbar.exp{background:linear-gradient(180deg,#FF2D78,#c31d59)}
.ltf .clbl{font-size:10px;color:var(--lt-faint);font-weight:600}
.ltf .legend{display:flex;gap:16px;margin-top:12px;font-size:11.5px;color:var(--lt-muted);font-weight:600}
.ltf .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}

/* Lists / tables */
.ltf .list{border-radius:15px;overflow:hidden;background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur)}
.ltf .lrow{display:grid;gap:12px;padding:13px 16px;border-bottom:1px solid var(--lt-hairline);align-items:center;transition:.12s}
.ltf .lrow:last-child{border-bottom:none}
.ltf .lrow.click{cursor:pointer}
.ltf .lrow.click:hover{background:var(--lt-surface)}
.ltf .lrow.head{background:var(--lt-surface);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--lt-faint)}
.ltf .lrow.head:hover{background:var(--lt-surface)}
.ltf .tnum{font-variant-numeric:tabular-nums;font-weight:700}
.ltf .muted{color:var(--lt-muted)}
.ltf .faint{color:var(--lt-faint)}

/* Pills */
.ltf .pill{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;white-space:nowrap}
.ltf .pill .dot{width:7px;height:7px;border-radius:50%}
.ltf .catdot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;display:inline-block}

/* Category breakdown rows */
.ltf .catrow{display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--lt-hairline)}
.ltf .catrow:last-child{border-bottom:none}
.ltf .catbar{flex:1;height:8px;border-radius:99px;background:var(--lt-track);overflow:hidden}
.ltf .catbar > i{display:block;height:100%;border-radius:99px}

/* Empty state */
.ltf .empty{padding:54px 20px;text-align:center;color:var(--lt-muted);font-size:14px}
.ltf .empty .big{font-size:16px;font-weight:700;color:var(--lt-text);margin-bottom:6px}

/* Toolbar / filters */
.ltf .toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.ltf .search{flex:1;min-width:200px;display:flex;align-items:center;gap:9px;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:11px;padding:9px 13px;color:var(--lt-muted)}
.ltf .search input{flex:1;background:none;border:none;outline:none;color:var(--lt-text);font-family:inherit;font-size:13.5px}
.ltf .search input::placeholder{color:var(--lt-faint)}
.ltf select.filter{font-family:inherit;font-size:13px;font-weight:600;color:var(--lt-text);background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:11px;padding:9px 34px 9px 13px;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239b99a8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}

/* FY selector */
.ltf .fypick{display:inline-flex;align-items:center;gap:2px;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:11px;padding:3px}
.ltf .fypick button{font-family:inherit;font-size:13px;font-weight:700;border:none;background:none;color:var(--lt-text);width:30px;height:30px;border-radius:8px;cursor:pointer}
.ltf .fypick button:hover{background:var(--lt-surface-2)}
.ltf .fypick .lbl{font-size:13px;font-weight:700;padding:0 10px;min-width:104px;text-align:center}

/* Modal */
.ltf .modal{position:fixed;inset:0;background:rgba(6,5,12,0.68);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:1100;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto}
.ltf .modalbox{width:100%;max-width:540px;border-radius:20px;padding:26px;background:var(--lt-modal-bg);border:var(--lt-modal-border);box-shadow:var(--lt-modal-shadow);backdrop-filter:var(--lt-modal-blur);-webkit-backdrop-filter:var(--lt-modal-blur)}
.ltf .mtitle{font-size:18px;font-weight:800;letter-spacing:-0.02em;margin-bottom:4px}
.ltf .msub{font-size:12.5px;color:var(--lt-muted);margin-bottom:18px}
.ltf .field{margin-bottom:14px}
.ltf .lab{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--lt-muted);display:block;margin-bottom:6px}
.ltf .inp{width:100%;background:var(--lt-input-bg);border:1px solid var(--lt-input-border);border-radius:10px;padding:11px 13px;color:var(--lt-text);font-family:inherit;font-size:14px;outline:none;transition:.15s}
.ltf .inp:focus{border-color:#1DB954}
.ltf select.inp{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239b99a8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:34px}
.ltf .fgrid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ltf .mactions{display:flex;gap:10px;justify-content:flex-end;margin-top:22px}
.ltf .hint{font-size:11.5px;color:var(--lt-faint);margin-top:6px;line-height:1.5}

/* Toggle */
.ltf .toggle{display:inline-flex;align-items:center;gap:9px;cursor:pointer;user-select:none}
.ltf .switch{width:40px;height:23px;border-radius:99px;background:var(--lt-track);position:relative;transition:.18s;flex:0 0 auto}
.ltf .switch > i{position:absolute;top:2.5px;left:2.5px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);transition:.18s}
.ltf .switch.on{background:#1DB954}
.ltf .switch.on > i{left:19.5px}

/* Receipt thumb */
.ltf .rthumb{width:34px;height:34px;border-radius:8px;background:var(--lt-surface);border:1px solid var(--lt-border);display:flex;align-items:center;justify-content:center;color:var(--lt-muted);cursor:pointer;flex:0 0 auto}
.ltf .rthumb:hover{border-color:#1DB954;color:#1DB954}

/* Toast */
.ltf .toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--lt-modal-bg);border:1px solid var(--lt-border);color:var(--lt-text);padding:12px 20px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:var(--lt-modal-shadow);opacity:0;pointer-events:none;transition:.28s;z-index:1300;display:flex;align-items:center;gap:9px}
.ltf .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.ltf .toast.err{border-color:rgba(240,81,109,0.5)}

@media (max-width:900px){
  .ltf .kpis{grid-template-columns:1fr 1fr}
  .ltf .grid2,.ltf .grid3{grid-template-columns:1fr}
}
@media (max-width:600px){
  .ltf .kpis{grid-template-columns:1fr 1fr}
  .ltf .fgrid2{grid-template-columns:1fr}
  .ltf .hide-m{display:none}
}
`
