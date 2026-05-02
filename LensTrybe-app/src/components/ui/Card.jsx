import { useState } from 'react';

const glassCard = {
  backdropFilter: 'blur(40px) saturate(200%) brightness(1.1)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(1.1)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderTop: '1px solid rgba(255,255,255,0.2)',
  borderLeft: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '20px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
};

const glassCardHover = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)',
  borderColor: 'rgba(255,255,255,0.2)',
  borderTopColor: 'rgba(255,255,255,0.28)',
  borderLeftColor: 'rgba(255,255,255,0.22)',
  transform: 'translateY(-3px)',
  boxShadow: '0 16px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)',
};

const variantStyles = {
  default: {
    ...glassCard,
    padding: '24px',
  },
  subtle: {
    ...glassCard,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.025) 100%)',
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

  const baseVariant = variantStyles[variant] ?? variantStyles.default;

  const base = {
    boxSizing: 'border-box',
    transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s',
    ...baseVariant,
    ...(onClick && hovered && variant !== 'ghost' ? glassCardHover : {}),
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
