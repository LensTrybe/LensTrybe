/* The dashboard's colour tokens and the background constants behind them.
 *
 * Named dashTokens rather than dashSurface on purpose. A dashSurface.js next
 * to DashSurface.jsx differs only in case, and macOS filesystems are
 * case-insensitive, so `import from './dashSurface'` inside DashSurface.jsx
 * resolved to the component importing itself. That crashed the whole app to a
 * white screen. Two files in one folder should never differ only by case.
 *
 * These lived inside DashboardLayout, and a hand written copy of the dark half
 * also lived inside ClientDashboardPage so that shared components mounted
 * there would not render as white panels. Two copies of the same values is a
 * drift waiting to happen, and this codebase has already been bitten by
 * exactly that with the brand palette. One copy, imported by both.
 */

const LIGHT_WRAP = {
  position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
  background: '#eef1f6',
}
const LIGHT_SCRIM = 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.30) 20%, rgba(255,255,255,0.34) 100%)'

const DARK_WRAP = {
  position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
  background: '#08070d',
}
const DARK_SCRIM = 'linear-gradient(180deg, rgba(8,7,13,0.42) 0%, rgba(8,7,13,0.55) 45%, rgba(8,7,13,0.66) 100%)'

/** Every --lt-* token, per theme. Injected once by DashSurface. */
export const DASH_TOKENS = `
        .lt-dash[data-theme="light"] {
          --lt-text: #14111a;
          --lt-muted: #55535f;
          --lt-faint: #86848f;
          --lt-glass-bg: linear-gradient(125deg, rgba(255,255,255,0.66) 0%, rgba(255,255,255,0.34) 42%, rgba(255,255,255,0.2) 100%);
          --lt-glass-border: 1px solid rgba(255,255,255,0.78);
          --lt-glass-shadow: 0 18px 50px -16px rgba(31,38,90,0.26), inset 0 1px 1px rgba(255,255,255,0.95);
          --lt-glass-blur: blur(12px) saturate(180%) brightness(1.05);
          --lt-modal-bg: linear-gradient(125deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.8) 100%);
          --lt-modal-border: 1px solid rgba(255,255,255,0.9);
          --lt-modal-shadow: 0 40px 100px -30px rgba(31,38,90,0.4), inset 0 1px 1px rgba(255,255,255,0.95);
          --lt-modal-blur: blur(30px) saturate(180%) brightness(1.04);
          --lt-sheen: linear-gradient(150deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.14) 26%, rgba(255,255,255,0) 52%);
          --lt-surface: rgba(20,17,26,0.05);
          --lt-surface-2: rgba(20,17,26,0.07);
          --lt-border: rgba(20,17,26,0.12);
          --lt-input-bg: rgba(255,255,255,0.72);
          --lt-input-border: rgba(20,17,26,0.16);
          --lt-hairline: rgba(20,17,26,0.09);
          --lt-track: rgba(20,17,26,0.10);
          --lt-chart-grid: rgba(20,17,26,0.10);
          --lt-chart-axis: rgba(20,17,26,0.5);
        }
        .lt-dash[data-theme="dark"] {
          --lt-text: rgba(255,255,255,0.92);
          --lt-muted: rgba(255,255,255,0.5);
          --lt-faint: rgba(255,255,255,0.42);
          --lt-glass-bg: linear-gradient(160deg, rgba(36,36,46,0.66) 0%, rgba(18,18,26,0.54) 100%);
          --lt-glass-border: 1px solid rgba(255,255,255,0.14);
          --lt-glass-shadow: 0 24px 60px -22px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 2px rgba(255,255,255,0.08), inset 1px 0 3px rgba(255,255,255,0.08), inset -1px 0 3px rgba(255,255,255,0.08);
          --lt-glass-blur: blur(22px) saturate(155%);
          --lt-modal-bg: linear-gradient(160deg, rgba(30,30,40,0.82) 0%, rgba(16,16,24,0.76) 100%);
          --lt-modal-border: 1px solid rgba(255,255,255,0.16);
          --lt-modal-shadow: 0 40px 100px -30px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.22), inset 1px 0 3px rgba(255,255,255,0.08), inset -1px 0 3px rgba(255,255,255,0.08);
          --lt-modal-blur: blur(32px) saturate(155%);
          --lt-sheen: linear-gradient(150deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 26%, rgba(255,255,255,0) 52%);
          --lt-surface: rgba(255,255,255,0.04);
          --lt-surface-2: rgba(255,255,255,0.06);
          --lt-border: rgba(255,255,255,0.10);
          --lt-input-bg: rgba(255,255,255,0.06);
          --lt-input-border: rgba(255,255,255,0.14);
          --lt-hairline: rgba(255,255,255,0.07);
          --lt-track: rgba(255,255,255,0.08);
          --lt-chart-grid: rgba(255,255,255,0.08);
          --lt-chart-axis: rgba(255,255,255,0.45);
        }
`

export { LIGHT_WRAP, DARK_SCRIM, LIGHT_SCRIM, DARK_WRAP }
