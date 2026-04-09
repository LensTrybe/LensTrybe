import React from 'react';

export default function MarketplacePage() {
  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', padding: '32px', fontFamily: 'Inter, sans-serif', color: 'rgb(242,242,242)' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '32px' }}>Gear Marketplace</h1>
      <div style={{ background: '#13131a', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '48px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛒</div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>Buy, Swap & Sell Gear</h2>
        <p style={{ color: '#888', fontSize: '14px', margin: '8px 0 28px' }}>Browse and manage all your gear listings on the LensTrybe marketplace.</p>
        <button
          onClick={() => window.open('https://swinging-lens-trybe-pro.base44.app/BuySwapSell', '_blank')}
          style={{ background: '#39ff14', color: '#000', fontWeight: '700', borderRadius: '8px', padding: '12px 28px', fontSize: '15px', cursor: 'pointer', border: 'none' }}
        >
          Go to Marketplace →
        </button>
      </div>
    </div>
  );
}                                                                           
