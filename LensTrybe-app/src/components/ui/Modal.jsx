import { useState } from 'react';

const sizeMap = {
  sm: '400px',
  md: '520px',
  lg: '680px',
  xl: '860px',
};

const glassModalPanel = {
  backdropFilter: 'blur(30px) saturate(150%)',
  WebkitBackdropFilter: 'blur(30px) saturate(150%)',
  background: 'linear-gradient(160deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.82) 100%)',
  border: '1px solid rgba(20,17,26,0.08)',
  borderTop: '1px solid rgba(255,255,255,0.9)',
  borderRadius: '24px',
  boxShadow: '0 24px 64px -20px rgba(40,30,60,0.35), inset 0 1px 0 rgba(255,255,255,0.9)',
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
    color: 'var(--text-primary)',
    margin: 0,
  };

  const closeButtonStyle = {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-full)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    background: closeHovered
      ? 'rgba(20,17,26,0.08)'
      : 'rgba(20,17,26,0.04)',
    border: '1px solid rgba(20,17,26,0.12)',
    borderTop: '1px solid rgba(20,17,26,0.1)',
    color: closeHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
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
    background: 'linear-gradient(90deg, transparent, rgba(20,17,26,0.08), transparent)',
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
