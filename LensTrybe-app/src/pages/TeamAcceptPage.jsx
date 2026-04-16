import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function TeamAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const fetchInvitation = async () => {
      const { data, error } = await supabase
        .from('team_invitations')
        .select('*, profiles:creative_id(business_name)')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (error || !data) {
        setError('This invitation link is invalid or has already been used.');
      } else {
        setInvitation(data);
      }
      setLoading(false);
    };
    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    const { error } = await supabase
      .from('team_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('token', token);

    if (error) {
      setError('Failed to accept invitation. Please try again.');
      setAccepting(false);
      return;
    }

    if (invitation?.creative_id && invitation?.email) {
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({ creative_id: invitation.creative_id, email: invitation.email, role: invitation.role, status: 'active' });
      if (memberError) {
        // ignore insert errors (e.g., already exists) so accept flow still completes
      }
    }
    setAccepted(true);
    setAccepting(false);
    setTimeout(() => {
      window.location.href = 'https://swinging-lens-trybe-pro.base44.app/JoinAsCreative';
    }, 3000);
  };

  if (loading) return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#888' }}>Loading invitation...</div>
    </div>
  );

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: '32px' }}>
      <div style={{ background: '#13131a', border: '1px solid #1e1e1e', borderRadius: '14px', padding: '40px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', fontWeight: '900', color: '#39ff14', marginBottom: '4px' }}>LensTrybe</div>
        <div style={{ fontSize: '13px', color: '#555', marginBottom: '32px' }}>For creatives, by creatives</div>

        {accepted ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Invitation Accepted!</h2>
            <p style={{ color: '#888', fontSize: '14px' }}>Redirecting you to create your profile on LensTrybe...</p>
          </>
        ) : error ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Invalid Invitation</h2>
            <p style={{ color: '#888', fontSize: '14px' }}>{error}</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>You've been invited!</h2>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '24px' }}>
              <strong style={{ color: 'white' }}>{invitation?.profiles?.business_name || 'A creative studio'}</strong> has invited you to join their team as a <strong style={{ color: 'white' }}>{invitation?.role || 'member'}</strong>.
            </p>
            <div style={{ background: '#1a1a24', border: '1px solid #202027', borderRadius: '10px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px' }}>Invitation details</div>
              <div style={{ fontSize: '14px', color: '#e8e8e8' }}><strong>Studio:</strong> {invitation?.profiles?.business_name || 'LensTrybe'}</div>
              <div style={{ fontSize: '14px', color: '#e8e8e8', marginTop: '6px' }}><strong>Role:</strong> {invitation?.role || 'Member'}</div>
              <div style={{ fontSize: '14px', color: '#e8e8e8', marginTop: '6px' }}><strong>Email:</strong> {invitation?.email}</div>
            </div>
            <div style={{ background: '#1e2a1e', border: '1px solid #39ff14', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#39ff14', marginBottom: '6px' }}>📋 Important — Read before signing up</div>
              <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.6' }}>
                You are joining as a team member under an <strong style={{ color: 'white' }}>Elite subscription</strong>. When creating your profile, select the <strong style={{ color: 'white' }}>Basic (Free)</strong> plan — your team owner's Elite subscription covers all features for the whole team.
              </div>
            </div>
            <button
              onClick={handleAccept}
              disabled={accepting}
              style={{ background: '#39ff14', color: '#000', fontWeight: '700', fontSize: '16px', padding: '14px 36px', borderRadius: '10px', border: 'none', cursor: 'pointer', width: '100%' }}
            >
              {accepting ? 'Accepting...' : 'Accept Invitation'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

