// Dashboard theme tokens — light (clean glass) and dark ("Jarvis" HUD glass).
export function themeTokens(dark) {
  if (dark) {
    return {
      dark: true,
      pageBg:
        'radial-gradient(1100px 620px at 72% -12%, rgba(56,189,248,0.14), transparent 62%), ' +
        'radial-gradient(900px 600px at 8% 112%, rgba(34,211,154,0.08), transparent 60%), ' +
        'linear-gradient(160deg, #060a12 0%, #0a1122 55%, #0b1328 100%)',
      text: '#e8f0fc',
      textSecondary: '#b7c6e6',
      textMuted: '#7f95b8',
      title: '#7fd3ff',
      accent: '#38bdf8',
      green: '#22e39a',
      danger: '#ff6b6b',
      glassBg: 'linear-gradient(160deg, rgba(28,42,72,0.55) 0%, rgba(16,26,50,0.42) 100%)',
      glassBorder: '1px solid rgba(120,190,255,0.16)',
      glassShadow:
        '0 0 0 1px rgba(120,190,255,0.05), 0 24px 60px -28px rgba(0,0,0,0.75), ' +
        'inset 0 1px 0 rgba(150,210,255,0.12), inset 0 0 44px -22px rgba(56,189,248,0.35)',
      glassBlur: 'blur(9px) saturate(140%)',
      inputBg: 'rgba(16,26,50,0.7)',
      inputBorder: '1px solid rgba(120,190,255,0.2)',
      rowBorder: '1px solid rgba(120,190,255,0.1)',
      ctrlBg: 'rgba(28,42,72,0.75)',
      ctrlBorder: '1px solid rgba(120,190,255,0.25)',
      ctrlText: '#b7c6e6',
      pillBg: 'rgba(28,42,72,0.6)',
      pillBorder: '1px solid rgba(120,190,255,0.2)',
      pillText: '#b7c6e6',
      cardBg: 'rgba(20,32,58,0.72)',
      cardBorder: '1px solid rgba(120,190,255,0.14)',
      cardShadow: '0 2px 12px -6px rgba(0,0,0,0.6)',
      squareOpacity: 0.5,
      squareBlend: 'screen',
      sidebarBg: 'linear-gradient(180deg, rgba(12,20,40,0.92), rgba(8,14,30,0.88))',
      sidebarBorder: '1px solid rgba(120,190,255,0.12)',
    }
  }
  return {
    dark: false,
    pageBg: 'linear-gradient(135deg, #f7f6f4 0%, #f3f2f0 50%, #f5f4f6 100%)',
    text: '#14111a',
    textSecondary: '#4b4a57',
    textMuted: '#8a8995',
    title: '#6b6a77',
    accent: '#1DB954',
    green: '#0f7a37',
    danger: '#c0392b',
    glassBg:
      'linear-gradient(125deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.16) 28%, rgba(255,255,255,0.05) 56%), ' +
      'linear-gradient(135deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.18) 100%)',
    glassBorder: '1px solid rgba(255,255,255,0.7)',
    glassShadow: '0 18px 50px -14px rgba(31,38,90,0.3), inset 0 1px 1px rgba(255,255,255,0.95)',
    glassBlur: 'blur(7px) saturate(180%) brightness(1.06)',
    inputBg: 'rgba(255,255,255,0.75)',
    inputBorder: '1px solid rgba(20,17,26,0.1)',
    rowBorder: '1px solid rgba(20,17,26,0.06)',
    ctrlBg: 'rgba(255,255,255,0.85)',
    ctrlBorder: '1px solid rgba(20,17,26,0.12)',
    ctrlText: '#4b4a57',
    pillBg: 'rgba(255,255,255,0.7)',
    pillBorder: '1px solid rgba(20,17,26,0.12)',
    pillText: '#3d3b47',
    cardBg: 'rgba(255,255,255,0.85)',
    cardBorder: '1px solid rgba(20,17,26,0.07)',
    cardShadow: '0 2px 8px -4px rgba(40,30,60,0.18)',
    squareOpacity: 0.22,
    squareBlend: 'normal',
    sidebarBg: null,
    sidebarBorder: null,
  }
}
