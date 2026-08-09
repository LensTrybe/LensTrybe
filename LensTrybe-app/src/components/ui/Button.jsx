import { useState } from 'react';

const sizeStyles = {
  sm: { fontSize: '12px', padding: '6px 12px' },
  md: { fontSize: '13px', padding: '10px 16px' },
  lg: { fontSize: '15px', padding: '12px 20px' },
};

const glassBase = {
  fontFamily: 'var(--font-ui)',
  fontWeight: 600,
  letterSpacing: '-0.2px',
  borderRadius: '10px',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer',
  transition: 'all var(--transition-base)',
  outline: 'none',
  lineHeight: 1.6,
};

const variantBase = {
  primary: {
    background: 'linear-gradient(180deg, #1ED760 0%, #17a94b 100%)',
    border: '1px solid rgba(16,120,55,0.45)',
    borderTop: '1px solid rgba(120,235,165,0.7)',
    color: '#ffffff',
    boxShadow: '0 6px 18px -6px rgba(29,185,84,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
  },
  secondary: {
    background: 'linear-gradient(160deg, rgba(255,255,255,0.9), rgba(255,255,255,0.6))',
    border: '1px solid rgba(20,17,26,0.12)',
    borderTop: '1px solid rgba(255,255,255,0.9)',
    color: 'var(--text-secondary)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  ghost: {
    background: 'linear-gradient(160deg, rgba(255,255,255,0.9), rgba(255,255,255,0.6))',
    border: '1px solid rgba(20,17,26,0.12)',
    borderTop: '1px solid rgba(255,255,255,0.9)',
    color: 'var(--text-secondary)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  danger: {
    background: 'linear-gradient(135deg, rgba(255,45,120,0.25), rgba(255,45,120,0.12))',
    border: '1px solid rgba(255,45,120,0.45)',
    borderTop: '1px solid rgba(255,45,120,0.6)',
    color: '#FF2D78',
    boxShadow: '0 4px 16px rgba(255,45,120,0.15), inset 0 1px 0 rgba(255,255,255,0.08)',
  },
};

const variantHover = {
  primary: {
    background: 'linear-gradient(180deg, #22e067 0%, #159a45 100%)',
    borderColor: 'rgba(16,120,55,0.55)',
    boxShadow: '0 8px 22px -6px rgba(29,185,84,0.55), inset 0 1px 0 rgba(255,255,255,0.3)',
  },
  secondary: {
    background: 'linear-gradient(160deg, rgba(255,255,255,1), rgba(255,255,255,0.75))',
    borderColor: 'rgba(20,17,26,0.18)',
    color: 'var(--text-primary)',
  },
  ghost: {
    background: 'linear-gradient(160deg, rgba(255,255,255,1), rgba(255,255,255,0.75))',
    borderColor: 'rgba(20,17,26,0.18)',
    color: 'var(--text-primary)',
  },
  danger: {
    background: 'linear-gradient(135deg, rgba(255,45,120,0.35), rgba(255,45,120,0.18))',
    borderColor: 'rgba(255,45,120,0.55)',
    boxShadow: '0 6px 20px rgba(255,45,120,0.22), inset 0 1px 0 rgba(255,255,255,0.12)',
  },
};

const variantActive = {
  primary: {
    background: 'linear-gradient(180deg, #1bc457 0%, #12833b 100%)',
    transform: 'translateY(1px)',
  },
  secondary: {
    background: 'linear-gradient(160deg, rgba(255,255,255,0.85), rgba(255,255,255,0.55))',
    transform: 'translateY(1px)',
  },
  ghost: {
    background: 'linear-gradient(160deg, rgba(255,255,255,0.85), rgba(255,255,255,0.55))',
    transform: 'translateY(1px)',
  },
  danger: {
    background: 'linear-gradient(135deg, rgba(255,45,120,0.2), rgba(255,45,120,0.1))',
    transform: 'translateY(1px)',
  },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  onClick,
  disabled = false,
  children,
  className,
  style: styleProp,
}) {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);

  const base = {
    ...glassBase,
    ...sizeStyles[size] ?? sizeStyles.md,
    ...variantBase[variant] ?? variantBase.primary,
    ...styleProp,
  };

  if (disabled) {
    return (
      <button
        type={type}
        disabled
        className={className}
        style={{ ...base, opacity: 0.4, cursor: 'not-allowed' }}
      >
        {children}
      </button>
    );
  }

  const interactionOverride = active
    ? variantActive[variant]
    : hovered
      ? variantHover[variant]
      : {};

  return (
    <button
      type={type}
      onClick={onClick}
      className={className}
      style={{ ...base, ...interactionOverride }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
    >
      {children}
    </button>
  );
}
