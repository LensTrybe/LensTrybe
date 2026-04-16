import { useState } from 'react';

const sizeStyles = {
  sm: { fontSize: '12px', padding: '6px 12px' },
  md: { fontSize: '13px', padding: '10px 16px' },
  lg: { fontSize: '15px', padding: '12px 20px' },
};

const variantBase = {
  primary: { background: 'var(--green)', color: '#000000', border: 'none' },
  secondary: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-strong)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
  },
  danger: {
    background: 'var(--error)',
    color: '#ffffff',
    border: 'none',
  },
};

const variantHover = {
  primary: { background: 'var(--green-bright)' },
  secondary: { background: 'var(--bg-overlay)', borderColor: 'var(--border-strong)' },
  ghost: { background: 'var(--bg-subtle)', color: 'var(--text-primary)' },
  danger: { background: '#dc2626' },
};

const variantActive = {
  primary: { background: '#17a349' },
  secondary: { background: 'var(--bg-base)' },
  ghost: { background: 'var(--bg-overlay)' },
  danger: { background: '#b91c1c' },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  children,
  className,
}) {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);

  const base = {
    fontFamily: 'var(--font-ui)',
    fontWeight: 500,
    borderRadius: 'var(--radius-lg)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    border: 'none',
    transition: 'all var(--transition-base)',
    outline: 'none',
    ...sizeStyles[size] ?? sizeStyles.md,
    ...variantBase[variant] ?? variantBase.primary,
  };

  if (disabled) {
    return (
      <button
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
