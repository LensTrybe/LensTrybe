import { useState } from 'react';

export default function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  label,
  hint,
  error,
  disabled = false,
  prefix,
  suffix,
  className,
}) {
  const [focused, setFocused] = useState(false);

  const wrapperStyle = {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  };

  const labelStyle = {
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: 'var(--font-ui)',
    marginBottom: '6px',
  };

  const inputRowStyle = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-lg)',
    border: error
      ? '1px solid var(--error)'
      : focused
      ? '1px solid var(--pink)'
      : '1px solid var(--border-default)',
    boxShadow: error
      ? '0 0 0 3px rgba(239,68,68,0.15)'
      : focused
      ? '0 0 0 3px rgba(217,70,239,0.15)'
      : 'none',
    transition: 'border-color var(--transition-base), box-shadow var(--transition-base)',
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
  };

  const affixStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '0 10px',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--text-sm)',
    flexShrink: 0,
    userSelect: 'none',
  };

  const inputStyle = {
    flex: 1,
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    padding: prefix || suffix ? '10px 0' : '10px 14px',
    paddingLeft: prefix ? '4px' : '14px',
    paddingRight: suffix ? '4px' : '14px',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--text-base)',
    color: 'var(--text-primary)',
    cursor: disabled ? 'not-allowed' : 'text',
  };

  const hintStyle = {
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontFamily: 'var(--font-ui)',
    marginTop: '4px',
  };

  const errorStyle = {
    color: 'var(--error)',
    fontSize: '12px',
    fontFamily: 'var(--font-ui)',
    marginTop: '4px',
  };

  return (
    <div style={wrapperStyle} className={className}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={inputRowStyle}>
        {prefix && <span style={{ ...affixStyle, paddingLeft: '14px' }}>{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          style={inputStyle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {suffix && <span style={{ ...affixStyle, paddingRight: '14px' }}>{suffix}</span>}
      </div>
      {error && <span style={errorStyle}>{error}</span>}
      {!error && hint && <span style={hintStyle}>{hint}</span>}
    </div>
  );
}
