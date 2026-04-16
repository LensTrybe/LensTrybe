import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const ToastContext = createContext(null);

const accentColors = {
  success: 'var(--green)',
  error:   'var(--error)',
  warning: 'var(--warning)',
  info:    'var(--info)',
  default: 'var(--pink)',
};

function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const itemStyle = {
    background: 'var(--bg-overlay)',
    border: '1px solid var(--border-default)',
    borderLeft: `3px solid ${accentColors[toast.type] ?? accentColors.default}`,
    borderRadius: 'var(--radius-xl)',
    padding: '14px 16px',
    minWidth: '280px',
    maxWidth: '380px',
    boxShadow: 'var(--shadow-lg)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    fontFamily: 'var(--font-ui)',
  };

  const bodyStyle = {
    flex: 1,
    minWidth: 0,
  };

  const titleStyle = {
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontWeight: 500,
    margin: 0,
  };

  const messageStyle = {
    color: 'var(--text-secondary)',
    fontSize: '13px',
    marginTop: '2px',
  };

  return (
    <div style={itemStyle}>
      <div style={bodyStyle}>
        <p style={titleStyle}>{toast.title}</p>
        {toast.message && <p style={messageStyle}>{toast.message}</p>}
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(({ type = 'default', title, message }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, title, message }]);
  }, []);

  const containerStyle = {
    position: 'fixed',
    bottom: 0,
    right: 0,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    zIndex: 2000,
    pointerEvents: 'none',
  };

  return (
    <ToastContext.Provider value={add}>
      {children}
      <div style={containerStyle}>
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const add = useContext(ToastContext);
  if (!add) throw new Error('useToast must be used within a ToastProvider');
  return add;
}
