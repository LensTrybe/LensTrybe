const sizeStyles = {
  sm: { fontSize: '11px', padding: '2px 8px' },
  md: { fontSize: '12px', padding: '4px 10px' },
};

const variantStyles = {
  default: {
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
    color: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderTop: '1px solid rgba(255,255,255,0.22)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  pink: {
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    background: 'rgba(255,45,120,0.15)',
    color: '#FF2D78',
    border: '1px solid rgba(255,45,120,0.3)',
    borderTop: '1px solid rgba(255,45,120,0.42)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  green: {
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    background: 'rgba(29,185,84,0.15)',
    color: '#1DB954',
    border: '1px solid rgba(29,185,84,0.3)',
    borderTop: '1px solid rgba(29,185,84,0.42)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  warning: {
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    background: 'rgba(245,158,11,0.15)',
    color: 'var(--warning)',
    border: '1px solid rgba(245,158,11,0.3)',
    borderTop: '1px solid rgba(245,158,11,0.42)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  error: {
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    background: 'rgba(239,68,68,0.15)',
    color: 'var(--error)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderTop: '1px solid rgba(239,68,68,0.42)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  info: {
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    background: 'rgba(96,165,250,0.15)',
    color: 'var(--info)',
    border: '1px solid rgba(96,165,250,0.3)',
    borderTop: '1px solid rgba(96,165,250,0.42)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  },
};

export default function Badge({ variant = 'default', size = 'md', children, className }) {
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 'var(--radius-full)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 600,
    letterSpacing: '-0.2px',
    lineHeight: 1.6,
    ...sizeStyles[size] ?? sizeStyles.md,
    ...variantStyles[variant] ?? variantStyles.default,
  };

  return (
    <span style={style} className={className}>
      {children}
    </span>
  );
}
