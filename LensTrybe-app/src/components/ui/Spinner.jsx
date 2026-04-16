import { useEffect } from 'react';

const STYLE_ID = 'lenstybe-spinner-keyframes';

const sizeMap = {
  sm: '16px',
  md: '24px',
  lg: '40px',
};

function injectKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes lt-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

export default function Spinner({ size = 'md', color = 'var(--pink)' }) {
  useEffect(() => {
    injectKeyframes();
  }, []);

  const dimension = sizeMap[size] ?? sizeMap.md;

  const style = {
    width: dimension,
    height: dimension,
    borderRadius: '50%',
    border: '2px solid transparent',
    borderTopColor: color,
    animation: 'lt-spin 0.7s linear infinite',
    display: 'inline-block',
    flexShrink: 0,
  };

  return <div style={style} role="status" aria-label="Loading" />;
}
