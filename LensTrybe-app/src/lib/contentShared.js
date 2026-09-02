// Shared helpers + styles for the Content section (Calendar + Ideas).
// Theme-aware via the dashboard --lt-* tokens; transparent backgrounds so the
// pages sit on the dashboard's moving-squares background in light and dark.

export const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', short: 'IG', color: '#E1306C' },
  { key: 'tiktok', label: 'TikTok', short: 'TT', color: '#00b8c4' },
  { key: 'facebook', label: 'Facebook', short: 'FB', color: '#1877F2' },
  { key: 'linkedin', label: 'LinkedIn', short: 'IN', color: '#0A66C2' },
]
export const PLATFORM_MAP = PLATFORMS.reduce((m, p) => { m[p.key] = p; return m }, {})

export const DEFAULT_CONTENT_STAGES = [
  { name: 'Idea', color: '#8b8f9a' },
  { name: 'Draft', color: '#4aa3ff' },
  { name: 'Scheduled', color: '#f5a524' },
  { name: 'Posted', color: '#1DB954' },
]

export const STAGE_COLORS = ['#8b8f9a', '#4aa3ff', '#1DB954', '#f5a524', '#FF2D78', '#9b6bff', '#38d16f', '#f0516d']

export const FORMATS = ['Reel', 'Post', 'Story', 'Carousel', 'Video', 'Short', 'Live', 'Article']

export function money() { return '' }

export function prettyDate(d) {
  if (!d) return ''
  const dt = new Date(d.length <= 10 ? d + 'T00:00:00' : d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function darken(hex, amt = 46) {
  try {
    const n = parseInt(hex.slice(1), 16)
    let r = (n >> 16) - amt, g = ((n >> 8) & 255) - amt, b = (n & 255) - amt
    r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b)
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  } catch { return hex }
}

export function initials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export const CONTENT_CSS = `
.ltc{position:relative;min-height:60vh;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--lt-text)}
.ltc *{box-sizing:border-box}
.ltc .inner{max-width:1280px;margin:0 auto;position:relative;z-index:1}
.ltc .phead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px;flex-wrap:wrap}
.ltc h1{font-size:26px;font-weight:800;letter-spacing:-0.03em;margin:0}
.ltc .sub{color:var(--lt-muted);font-size:13.5px;margin-top:4px;max-width:620px}
.ltc .hactions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.ltc .btn{font-family:inherit;font-size:13px;font-weight:600;border-radius:10px;padding:9px 15px;cursor:pointer;border:1px solid var(--lt-border);background:var(--lt-surface);color:var(--lt-text);display:inline-flex;align-items:center;gap:7px;transition:.15s;white-space:nowrap}
.ltc .btn:hover{background:var(--lt-surface-2)}
.ltc .btn svg{width:15px;height:15px}
.ltc .btn.primary{background:#1DB954;border-color:transparent;color:#04120a;font-weight:700;box-shadow:0 6px 18px -8px rgba(29,185,84,0.7)}
.ltc .btn.primary:hover{background:#22c95f}
.ltc .btn.sm{padding:6px 11px;font-size:12px}
.ltc .btn.ghost{background:transparent;border-color:transparent;color:var(--lt-muted)}
.ltc .btn.ghost:hover{color:var(--lt-text);background:var(--lt-surface)}
.ltc .btn.danger{color:#f0516d}
.ltc .btn:disabled{opacity:.5;cursor:default}
.ltc .toolbar{display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap}
.ltc .search{flex:1;min-width:180px;display:flex;align-items:center;gap:9px;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:11px;padding:9px 13px;color:var(--lt-muted)}
.ltc .search input{flex:1;background:none;border:none;outline:none;color:var(--lt-text);font-family:inherit;font-size:13.5px}
.ltc .search input::placeholder{color:var(--lt-faint)}
.ltc .segment{display:flex;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:11px;padding:3px}
.ltc .segment button{font-family:inherit;font-size:12.5px;font-weight:600;border:none;background:none;color:var(--lt-muted);padding:6px 13px;border-radius:8px;cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:6px}
.ltc .segment button.on{background:var(--lt-border);color:var(--lt-text)}
/* Board */
.ltc .board{display:flex;gap:15px;align-items:flex-start;overflow-x:auto;padding-bottom:24px;scrollbar-width:thin}
.ltc .board::-webkit-scrollbar{height:9px}
.ltc .board::-webkit-scrollbar-thumb{background:var(--lt-border);border-radius:99px}
.ltc .col{flex:0 0 288px;width:288px;border-radius:15px;padding:5px;transition:background .15s}
.ltc .col.dragover{background:var(--lt-surface)}
.ltc .colhead{display:flex;align-items:center;gap:9px;padding:8px 8px 12px}
.ltc .grip{color:var(--lt-faint);cursor:grab;display:flex;opacity:0;transition:.15s;margin-left:-4px}
.ltc .col:hover .grip{opacity:1}
.ltc .grip svg{width:14px;height:16px}
.ltc .dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
.ltc .colname{font-size:13px;font-weight:700;letter-spacing:-0.01em;outline:none;border-radius:5px;padding:1px 4px;margin:-1px -4px;max-width:150px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ltc .colname:focus{background:var(--lt-surface-2);box-shadow:0 0 0 2px rgba(29,185,84,0.5)}
.ltc .count{font-size:11.5px;color:var(--lt-faint);font-weight:600;background:var(--lt-surface);border-radius:99px;padding:1px 8px}
.ltc .colmenu{margin-left:auto;color:var(--lt-faint);cursor:pointer;width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;opacity:0;transition:.15s}
.ltc .col:hover .colmenu{opacity:1}
.ltc .colmenu:hover{background:var(--lt-surface-2);color:var(--lt-text)}
.ltc .cards{display:flex;flex-direction:column;gap:9px;min-height:40px;padding:2px}
.ltc .pcard{border-radius:13px;padding:12px 13px;cursor:pointer;transition:.15s;position:relative;overflow:hidden;background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur)}
.ltc .pcard:hover{transform:translateY(-1px)}
.ltc .pcard.dragging{opacity:.4}
.ltc .pcard .accent{position:absolute;left:0;top:0;bottom:0;width:3px}
.ltc .pcard .thumb{width:100%;aspect-ratio:16/9;border-radius:9px;object-fit:cover;margin-bottom:9px;background:var(--lt-surface-2)}
.ltc .ptitle{font-size:13.5px;font-weight:700;letter-spacing:-0.01em;margin-bottom:8px;padding-left:4px;line-height:1.35}
.ltc .chips{display:flex;gap:5px;flex-wrap:wrap;padding-left:4px;margin-bottom:8px}
.ltc .chip{font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px}
.ltc .prow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-left:4px}
.ltc .fmt{font-size:10.5px;font-weight:600;color:var(--lt-muted);background:var(--lt-surface-2);border-radius:99px;padding:2px 8px}
.ltc .cdate{font-size:11px;color:var(--lt-faint);display:inline-flex;align-items:center;gap:4px}
.ltc .avatar{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700;color:#fff;flex:0 0 auto}
.ltc .addcard{margin:6px 2px 0;padding:8px;border-radius:10px;border:1px dashed var(--lt-border);color:var(--lt-faint);font-size:12px;font-weight:600;text-align:center;cursor:pointer;transition:.15s}
.ltc .addcard:hover{border-color:#1DB954;color:#1DB954}
.ltc .addstage{flex:0 0 210px;padding:5px}
.ltc .addstage .box{border:1px dashed var(--lt-border);border-radius:14px;padding:16px 12px;text-align:center;color:var(--lt-faint);font-size:12.5px;font-weight:600;cursor:pointer;transition:.15s}
.ltc .addstage .box:hover{border-color:#1DB954;color:#1DB954;background:rgba(29,185,84,0.12)}
/* Calendar */
.ltc .cal{border-radius:15px;overflow:hidden;background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur)}
.ltc .calhead{display:flex;align-items:center;justify-content:space-between;padding:14px 16px}
.ltc .calnav{display:inline-flex;align-items:center;gap:2px;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:11px;padding:3px}
.ltc .calnav button{font-family:inherit;font-size:14px;font-weight:700;border:none;background:none;color:var(--lt-text);width:30px;height:30px;border-radius:8px;cursor:pointer}
.ltc .calnav button:hover{background:var(--lt-surface-2)}
.ltc .calmonth{font-size:15px;font-weight:800;letter-spacing:-0.02em;min-width:150px;text-align:center}
.ltc .dow{display:grid;grid-template-columns:repeat(7,1fr);border-top:1px solid var(--lt-hairline);border-bottom:1px solid var(--lt-hairline)}
.ltc .dow span{padding:7px 10px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--lt-faint)}
.ltc .weeks{display:grid;grid-template-columns:repeat(7,1fr)}
.ltc .day{min-height:104px;border-right:1px solid var(--lt-hairline);border-bottom:1px solid var(--lt-hairline);padding:6px;cursor:pointer;transition:.12s;overflow:hidden}
.ltc .day:nth-child(7n){border-right:none}
.ltc .day:hover{background:var(--lt-surface)}
.ltc .day.out{opacity:.4}
.ltc .daynum{font-size:11.5px;font-weight:700;color:var(--lt-muted);margin-bottom:4px}
.ltc .day.today .daynum{color:#1DB954}
.ltc .ev{font-size:10.5px;font-weight:600;padding:3px 6px;border-radius:6px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:5px}
.ltc .ev .ed{width:6px;height:6px;border-radius:50%;flex:0 0 auto}
.ltc .more{font-size:10px;color:var(--lt-faint);font-weight:600;padding-left:2px}
/* List */
.ltc .list{border-radius:15px;overflow:hidden;background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur)}
.ltc .lrow{display:grid;grid-template-columns:2fr 1.4fr 1fr 1fr 1fr;gap:12px;padding:13px 16px;border-bottom:1px solid var(--lt-hairline);align-items:center;cursor:pointer;transition:.12s}
.ltc .lrow:last-child{border-bottom:none}
.ltc .lrow:hover{background:var(--lt-surface)}
.ltc .lrow.head{cursor:default;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--lt-faint);background:var(--lt-surface)}
.ltc .lrow.head:hover{background:var(--lt-surface)}
.ltc .stagepill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:99px}
/* Popover / menu */
.ltc .pop{position:fixed;z-index:1200;background:var(--lt-modal-bg);border:1px solid var(--lt-input-border);border-radius:12px;padding:6px;min-width:190px;box-shadow:var(--lt-modal-shadow);backdrop-filter:var(--lt-modal-blur);-webkit-backdrop-filter:var(--lt-modal-blur)}
.ltc .pop button{display:flex;align-items:center;gap:10px;width:100%;font-family:inherit;font-size:13px;color:var(--lt-text);background:none;border:none;padding:9px 10px;border-radius:8px;cursor:pointer;text-align:left}
.ltc .pop button:hover{background:var(--lt-surface-2)}
.ltc .pop button.danger{color:#f0516d}
.ltc .pop button svg{width:15px;height:15px;color:var(--lt-muted)}
.ltc .pop .sep{height:1px;background:var(--lt-hairline);margin:5px 4px}
.ltc .pop .swatches{display:flex;gap:7px;padding:8px;flex-wrap:wrap}
.ltc .sw{width:22px;height:22px;border-radius:7px;cursor:pointer;border:2px solid transparent;transition:.12s}
.ltc .sw:hover{transform:scale(1.12)}
.ltc .sw.sel{border-color:#fff}
.ltc .pop .lbl{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--lt-faint);padding:6px 10px 2px}
/* Modal */
.ltc .modal{position:fixed;inset:0;background:rgba(6,5,12,0.68);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:1100;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto}
.ltc .modalbox{width:100%;max-width:560px;border-radius:20px;padding:24px;background:var(--lt-modal-bg);border:var(--lt-modal-border);box-shadow:var(--lt-modal-shadow);backdrop-filter:var(--lt-modal-blur);-webkit-backdrop-filter:var(--lt-modal-blur)}
.ltc .modalbox.sm{max-width:420px}
.ltc .mtitle{font-size:18px;font-weight:800;letter-spacing:-0.02em;margin-bottom:4px}
.ltc .msub{font-size:12.5px;color:var(--lt-muted);margin-bottom:18px}
.ltc .field{margin-bottom:14px}
.ltc .lab{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--lt-muted);display:block;margin-bottom:6px}
.ltc .inp{width:100%;background:var(--lt-input-bg);border:1px solid var(--lt-input-border);border-radius:10px;padding:11px 13px;color:var(--lt-text);font-family:inherit;font-size:14px;outline:none;transition:.15s}
.ltc .inp:focus{border-color:#1DB954}
.ltc select.inp{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239b99a8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:34px}
.ltc .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ltc .platgrid{display:flex;gap:8px;flex-wrap:wrap}
.ltc .plat{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:10px;border:1px solid var(--lt-input-border);cursor:pointer;transition:.15s;color:var(--lt-muted);background:var(--lt-surface)}
.ltc .plat .pd{width:9px;height:9px;border-radius:50%}
.ltc .plat.on{color:var(--lt-text);border-color:transparent}
.ltc .mactions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}
.ltc .uploader{aspect-ratio:16/9;border-radius:12px;border:1px dashed var(--lt-border);background:var(--lt-surface);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--lt-faint)}
.ltc .uploader:hover{border-color:#1DB954;color:#1DB954}
.ltc .uploader img{width:100%;height:100%;object-fit:cover}
.ltc .lumihint{margin-top:6px;font-size:11.5px;color:var(--lt-faint);display:flex;align-items:center;gap:6px}
.ltc .empty{padding:54px 20px;text-align:center;color:var(--lt-muted);font-size:14px}
.ltc .empty .big{font-size:16px;font-weight:700;color:var(--lt-text);margin-bottom:6px}
.ltc .toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--lt-modal-bg);border:1px solid var(--lt-border);color:var(--lt-text);padding:12px 20px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:var(--lt-modal-shadow);opacity:0;pointer-events:none;transition:.28s;z-index:1300;display:flex;align-items:center;gap:9px}
.ltc .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.ltc .toast.err{border-color:rgba(240,81,109,0.5)}
@media (max-width:760px){.ltc .g2{grid-template-columns:1fr}.ltc .col{flex:0 0 84vw;width:84vw}.ltc .lrow{grid-template-columns:1.6fr 1fr}.ltc .lrow .hide-m{display:none}.ltc .day{min-height:76px}}
`
