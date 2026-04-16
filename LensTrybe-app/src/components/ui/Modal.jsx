import { useState } from 'react';

const sizeMap = {
  sm: '400px',
  md: '520px',
  lg: '680px',
  xl: '860px',
};

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const [closeHovered, setCloseHovered] = useState(false);

  if (!isOpen) return null;

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8,8,16,0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  };

  const panelStyle = {
    background: 'var(--bg-overlay)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-2xl)',
    width: '100%',
    maxWidth: sizeMap[size] ?? sizeMap.md,
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: 'var(--shadow-lg)',
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
    color: 'var(--text-primary)',
    margin: 0,
  };

  const closeButtonStyle = {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-full)',
    background: closeHovered ? 'var(--bg-subtle)' : 'transparent',
    border: 'none',
    color: closeHovered ? 'var(--text-primary)' : 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all var(--transition-base)',
    flexShrink: 0,
  };

  const contentStyle = {
    padding: '24px',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          {title && <h2 style={titleStyle}>{title}</h2>}
          <button
            style={closeButtonStyle}
            onClick={onClose}
            onMouseEnter={() => setCloseHovered(true)}
            onMouseLeave={() => setCloseHovered(false)}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div style={contentStyle}>{children}</div>
      </div>
    </div>
  );
}
