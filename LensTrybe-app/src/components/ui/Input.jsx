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
    color: 'rgba(255,255,255,0.35)',
    fontSize: '13px',
    fontWeight: 400,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-ui)',
    marginBottom: '6px',
    lineHeight: 1.6,
  };

  const glassRest = {
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderTop: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    boxShadow: 'none',
  };

  const glassFocused = {
    borderColor: 'rgba(29,185,84,0.4)',
    borderTopColor: 'rgba(29,185,84,0.45)',
    background: 'rgba(29,185,84,0.05)',
    boxShadow: '0 0 0 3px rgba(29,185,84,0.08)',
  };

  const glassError = {
    borderColor: 'rgba(255,45,120,0.45)',
    borderTopColor: 'rgba(255,45,120,0.5)',
    background: 'rgba(255,45,120,0.06)',
    boxShadow: '0 0 0 3px rgba(255,45,120,0.1)',
  };

  const inputRowStyle = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    ...glassRest,
    ...(error ? glassError : focused ? glassFocused : {}),
    transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
  };

  const affixStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '0 10px',
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--text-sm)',
    flexShrink: 0,
    userSelect: 'none',
    fontWeight: 400,
    lineHeight: 1.6,
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
    fontWeight: 400,
    lineHeight: 1.6,
    color: '#ffffff',
    cursor: disabled ? 'not-allowed' : 'text',
  };

  const hintStyle = {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '12px',
    fontFamily: 'var(--font-ui)',
    marginTop: '4px',
    fontWeight: 400,
    lineHeight: 1.6,
  };

  const errorStyle = {
    color: '#FF2D78',
    fontSize: '12px',
    fontFamily: 'var(--font-ui)',
    marginTop: '4px',
    fontWeight: 400,
    lineHeight: 1.6,
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
