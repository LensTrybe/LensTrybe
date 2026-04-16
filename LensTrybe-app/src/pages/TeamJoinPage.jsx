import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function TeamJoinPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('accept'); // accept | signup | success

  // Signup form fields
  const [businessName, setBusinessName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    const fetchInvitation = async () => {
      const { data, error } = await supabase
        .from('team_invitations')
        .select('*, profiles:creative_id(business_name, brand_primary_color)')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (error || !data) {
        setError('This invitation link is invalid or has already been used.');
      } else {
        setInvitation(data);
        setEmail(data.email || '');
      }
      setLoading(false);
    };
    fetchInvitation();
  }, [token]);

  const handleAccept = () => setStep('signup');

  const handleSignup = async () => {
    setFormError(null);
    if (!businessName || !firstName || !email || !password) {
      setFormError('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);

    try {
      // Use edge function to create account, bypass email confirmation,
      // create profile, link to team, all in one step
      const { data, error } = await supabase.functions.invoke('join-team', {
        body: {
          creative_id: invitation.creative_id,
          email,
          password,
          business_name: businessName,
          first_name: firstName,
          last_name: lastName,
          role: invitation.role || 'member',
          invitation_token: token,
        }
      });

      if (error || data?.error) {
        setFormError(error?.message || data?.error || 'Failed to create account.');
        setSubmitting(false);
        return;
      }

      // Set the session directly so they're logged in immediately
      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      setStep('success');
      setSubmitting(false);
      setTimeout(() => navigate('/dashboard'), 3000);

    } catch (err) {
      setFormError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  const inputStyle = {
    background: '#1a1a24',
    border: '1px solid #202027',
    borderRadius: '8px',
    padding: '10px 14px',
    color: 'white',
    width: '100%',
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    color: '#888',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: '6px',
    display: 'block',
  };

  const accentColor = invitation?.profiles?.brand_primary_color || '#39ff14';

  if (loading) return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#888' }}>Loading invitation...</div>
    </div>
  );

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: '32px' }}>
      <div style={{ background: '#13131a', border: '1px solid #1e1e1e', borderRadius: '14px', padding: '40px', maxWidth: '500px', width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '26px', fontWeight: '900', color: accentColor, letterSpacing: '-0.5px' }}>LensTrybe</div>
          <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>For creatives, by creatives</div>
        </div>

        {error && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>❌</div>
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Invalid Invitation</h2>
            <p style={{ color: '#888', fontSize: '14px' }}>{error}</p>
          </div>
        )}

        {!error && step === 'accept' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎉</div>
              <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>You've been invited!</h2>
              <p style={{ color: '#aaa', fontSize: '14px' }}>
                <strong style={{ color: 'white' }}>{invitation?.profiles?.business_name || 'A creative studio'}</strong> has invited you to join their team as a <strong style={{ color: 'white' }}>{invitation?.role || 'Member'}</strong>.
              </p>
            </div>

            <div style={{ background: '#1e2a1e', border: `1px solid ${accentColor}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: accentColor, marginBottom: '6px' }}>✅ What's included</div>
              <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.7' }}>
                <div>• Full <strong style={{ color: 'white' }}>Elite tier access</strong> — covered by your team owner</div>
                <div>• Your own creative profile on LensTrybe</div>
                <div>• Access to all business tools: invoicing, contracts, CRM, deliver and more</div>
                <div>• No subscription payment required</div>
              </div>
            </div>

            <div style={{ background: '#13131a', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '14px 16px', marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px' }}>Invitation details</div>
              <div style={{ fontSize: '14px', color: '#e8e8e8' }}><strong>Studio:</strong> {invitation?.profiles?.business_name}</div>
              <div style={{ fontSize: '14px', color: '#e8e8e8', marginTop: '6px' }}><strong>Role:</strong> {invitation?.role || 'Member'}</div>
              <div style={{ fontSize: '14px', color: '#e8e8e8', marginTop: '6px' }}><strong>Email:</strong> {invitation?.email}</div>
            </div>

            <button
              onClick={handleAccept}
              style={{ background: accentColor, color: '#000', fontWeight: '700', fontSize: '15px', padding: '13px', borderRadius: '10px', border: 'none', cursor: 'pointer', width: '100%' }}
            >
              Accept & Create My Profile →
            </button>
          </>
        )}

        {!error && step === 'signup' && (
          <>
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Create your account</h2>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>Set up your LensTrybe profile to join the team.</p>

            {formError && (
              <div style={{ background: '#2a1a1a', border: '1px solid #f87171', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>First Name *</label>
                <input style={inputStyle} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input style={inputStyle} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Business / Studio Name *</label>
              <input style={inputStyle} value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Your business or trading name" />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Email *</label>
              <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={labelStyle}>Password *</label>
                <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" />
              </div>
              <div>
                <label style={labelStyle}>Confirm Password *</label>
                <input style={inputStyle} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
              </div>
            </div>

            <button
              onClick={handleSignup}
              disabled={submitting}
              style={{ background: accentColor, color: '#000', fontWeight: '700', fontSize: '15px', padding: '13px', borderRadius: '10px', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', width: '100%', opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Creating your account...' : 'Create Account & Join Team'}
            </button>

            <button
              onClick={() => setStep('accept')}
              style={{ background: 'none', border: 'none', color: '#555', fontSize: '13px', cursor: 'pointer', width: '100%', marginTop: '12px', textAlign: 'center' }}
            >
              ← Back
            </button>
          </>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>✅ Welcome to the team! You now have Elite access. Taking you to your dashboard...</h2>
          </div>
        )}

      </div>
    </div>
  );
}
