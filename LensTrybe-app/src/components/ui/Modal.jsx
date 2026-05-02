import { useState } from 'react';

const sizeMap = {
  sm: '400px',
  md: '520px',
  lg: '680px',
  xl: '860px',
};

const glassModalPanel = {
  backdropFilter: 'blur(60px) saturate(180%)',
  WebkitBackdropFilter: 'blur(60px) saturate(180%)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderTop: '1px solid rgba(255,255,255,0.25)',
  borderRadius: '24px',
  boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
};

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const [closeHovered, setCloseHovered] = useState(false);

  if (!isOpen) return null;

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(6,6,16,0.65)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  };

  const panelStyle = {
    ...glassModalPanel,
    width: '100%',
    maxWidth: sizeMap[size] ?? sizeMap.md,
    maxHeight: '90vh',
    overflowY: 'auto',
  };

  const headerStyle = {
    padding: '24px 24px 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const titleStyle = {
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--text-xl)',
    fontWeight: 600,
    letterSpacing: '-0.3px',
    lineHeight: 1.6,
    color: '#ffffff',
    margin: 0,
  };

  const closeButtonStyle = {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-full)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    background: closeHovered
      ? 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))'
      : 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))',
    border: '1px solid rgba(255,255,255,0.12)',
    borderTop: '1px solid rgba(255,255,255,0.18)',
    color: closeHovered ? '#ffffff' : 'rgba(255,255,255,0.65)',
    cursor: 'pointer',
    fontSize: '18px',
    fontWeight: 600,
    letterSpacing: '-0.2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all var(--transition-base)',
    flexShrink: 0,
  };

  const contentStyle = {
    padding: '24px',
  };

  const headerDivider = {
    height: '1px',
    margin: '16px 24px 0',
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          {title && <h2 style={titleStyle}>{title}</h2>}
          <button
            type="button"
            style={closeButtonStyle}
            onClick={onClose}
            onMouseEnter={() => setCloseHovered(true)}
            onMouseLeave={() => setCloseHovered(false)}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div style={headerDivider} />
        <div style={contentStyle}>{children}</div>
      </div>
    </div>
  );
}
