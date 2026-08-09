import { useState } from 'react';

const glassCard = {
  backdropFilter: 'blur(22px) saturate(150%)',
  WebkitBackdropFilter: 'blur(22px) saturate(150%)',
  background: 'linear-gradient(160deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.55) 100%)',
  border: '1px solid rgba(20,17,26,0.07)',
  borderTop: '1px solid rgba(255,255,255,0.9)',
  borderLeft: '1px solid rgba(255,255,255,0.7)',
  borderRadius: '20px',
  boxShadow: '0 10px 30px -12px rgba(40,30,60,0.16), inset 0 1px 0 rgba(255,255,255,0.85)',
};

const glassCardHover = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.7) 100%)',
  borderColor: 'rgba(20,17,26,0.1)',
  borderTopColor: 'rgba(255,255,255,0.95)',
  borderLeftColor: 'rgba(255,255,255,0.8)',
  transform: 'translateY(-3px)',
  boxShadow: '0 18px 44px -14px rgba(40,30,60,0.24), inset 0 1px 0 rgba(255,255,255,0.9)',
};

const variantStyles = {
  default: {
    ...glassCard,
    padding: '24px',
  },
  subtle: {
    ...glassCard,
    background: 'linear-gradient(160deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.45) 100%)',
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
