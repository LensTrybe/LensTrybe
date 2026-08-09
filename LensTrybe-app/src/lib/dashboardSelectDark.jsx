/** Native <select> styling for dashboard pages (light theme). */

export const LT_DASHBOARD_SELECT_CLASS = 'lt-dashboard-select-dark'

export const LT_DASHBOARD_SELECT_STYLE = {
  background: '#ffffff',
  color: '#14111a',
  border: '1px solid rgba(20,17,26,0.12)',
  boxSizing: 'border-box',
  cursor: 'pointer',
}

/** Mount once per page root that uses {@link LT_DASHBOARD_SELECT_CLASS}. */
export function LtDashboardSelectDarkStyles() {
  const c = LT_DASHBOARD_SELECT_CLASS
  return (
    <style>{`
      .${c} {
        color-scheme: light;
      }
      .${c},
      .${c} option {
        background-color: #ffffff;
        color: #14111a;
      }
      .${c} optgroup {
        background-color: #ffffff;
        color: #14111a;
        font-weight: 600;
      }
      .${c}:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    `}</style>
  )
}
