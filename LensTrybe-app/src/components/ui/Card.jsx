import { useState } from 'react';

const variantStyles = {
  default: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    padding: '24px',
  },
  subtle: {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    padding: '24px',
  },
  ghost: {
    background: 'none',
    border: 'none',
    borderRadius: 'var(--radius-xl)',
    padding: '24px',
  },
};

export default function Card({
  variant = 'default',
  onClick,
  children,
  className,
  style,
}) {
  const [hovered, setHovered] = useState(false);

  const base = {
    boxSizing: 'border-box',
    transition: 'background var(--transition-base)',
    ...variantStyles[variant] ?? variantStyles.default,
    ...(onClick ? { cursor: 'pointer' } : {}),
    ...(onClick && hovered ? { background: 'var(--bg-overlay)' } : {}),
    ...style,
  };

  return (
    <div
      className={className}
      style={base}
      onClick={onClick}
      onMouseEnter={onClick ? () => setHovered(true) : undefined}
      onMouseLeave={onClick ? () => setHovered(false) : undefined}
    >
      {children}
    </div>
  );
}
