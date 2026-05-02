/** Native <select> dark styling for dashboard pages (control + option list hints). */

export const LT_DASHBOARD_SELECT_CLASS = 'lt-dashboard-select-dark'

export const LT_DASHBOARD_SELECT_STYLE = {
  background: '#111118',
  color: '#ffffff',
  border: '1px solid #1e1e2e',
  boxSizing: 'border-box',
  cursor: 'pointer',
}

/** Mount once per page root that uses {@link LT_DASHBOARD_SELECT_CLASS}. */
export function LtDashboardSelectDarkStyles() {
  const c = LT_DASHBOARD_SELECT_CLASS
  return (
    <style>{`
      .${c} {
        color-scheme: dark;
      }
      .${c},
      .${c} option {
        background-color: #111118;
        color: #ffffff;
      }
      .${c} optgroup {
        background-color: #111118;
        color: #ffffff;
        font-weight: 600;
      }
      .${c}:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    `}</style>
  )
}
