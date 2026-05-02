import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const ToastContext = createContext(null);

const accentColors = {
  success: '#1DB954',
  error: '#FF2D78',
  warning: 'var(--warning)',
  info: 'var(--info)',
  default: '#FF2D78',
};

function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const accent = accentColors[toast.type] ?? accentColors.default;

  const itemStyle = {
    backdropFilter: 'blur(40px) saturate(200%) brightness(1.1)',
    WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(1.1)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderTop: '1px solid rgba(255,255,255,0.2)',
    borderLeft: `3px solid ${accent}`,
    borderRadius: '20px',
    padding: '14px 16px',
    minWidth: '280px',
    maxWidth: '380px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
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
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '-0.3px',
    lineHeight: 1.6,
    margin: 0,
  };

  const messageStyle = {
    color: 'rgba(255,255,255,0.75)',
    fontSize: '13px',
    fontWeight: 400,
    lineHeight: 1.6,
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
