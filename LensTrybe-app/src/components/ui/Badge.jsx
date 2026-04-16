const sizeStyles = {
  sm: { fontSize: '11px', padding: '2px 8px' },
  md: { fontSize: '12px', padding: '4px 10px' },
};

const variantStyles = {
  default: {
    background: 'var(--bg-subtle)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-default)',
  },
  pink: {
    background: 'var(--pink-dim)',
    color: 'var(--pink)',
    border: '1px solid rgba(217,70,239,0.3)',
  },
  green: {
    background: 'var(--green-dim)',
    color: 'var(--green)',
    border: '1px solid rgba(74,222,128,0.3)',
  },
  warning: {
    background: 'rgba(245,158,11,0.15)',
    color: 'var(--warning)',
    border: '1px solid rgba(245,158,11,0.3)',
  },
  error: {
    background: 'rgba(239,68,68,0.15)',
    color: 'var(--error)',
    border: '1px solid rgba(239,68,68,0.3)',
  },
  info: {
    background: 'rgba(96,165,250,0.15)',
    color: 'var(--info)',
    border: '1px solid rgba(96,165,250,0.3)',
  },
};

export default function Badge({ variant = 'default', size = 'md', children, className }) {
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 'var(--radius-full)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 500,
    ...sizeStyles[size] ?? sizeStyles.md,
    ...variantStyles[variant] ?? variantStyles.default,
  };

  return (
    <span style={style} className={className}>
      {children}
    </span>
  );
}
