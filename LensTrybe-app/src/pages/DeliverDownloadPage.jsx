import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

export default function DeliverDownloadPage() {
  const { token } = useParams();
  const [delivery, setDelivery] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid download link.');
      setLoading(false);
      return;
    }
    fetchDelivery();
  }, [token]);

  const fetchDelivery = async () => {
    setLoading(true);

    const { data, error: err } = await supabase
      .from('deliveries')
      .select('*')
      .eq('download_token', token)
      .single();

    if (err || !data) {
      setError('This download link is invalid or has been removed.');
      setLoading(false);
      return;
    }

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      setError('This download link has expired. Please contact your photographer for a new link.');
      setLoading(false);
      return;
    }

    setDelivery(data);

    // Fetch creative profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('business_name, avatar_url, tagline')
      .eq('id', data.creative_id)
      .single();

    if (profileData) setProfile(profileData);
    setLoading(false);
  };

  const handleDownloadAll = async () => {
    if (!delivery?.files?.length) return;
    setDownloading(true);

    // Open each file in a new tab (triggers browser download)
    for (const file of delivery.files) {
      if (file.url) {
        const a = document.createElement('a');
        a.href = file.url;
        a.download = file.name || 'file';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await new Promise((r) => setTimeout(r, 300)); // small delay between files
      }
    }

    // Mark as downloaded in Supabase
    if (!delivery.downloaded_at) {
      await supabase
        .from('deliveries')
        .update({ downloaded_at: new Date().toISOString() })
        .eq('id', delivery.id);
    }

    setDownloaded(true);
    setDownloading(false);
  };

  const handleDownloadSingle = async (file) => {
    if (!file.url) return;
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name || 'file';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (!delivery.downloaded_at) {
      await supabase
        .from('deliveries')
        .update({ downloaded_at: new Date().toISOString() })
        .eq('id', delivery.id);
      setDelivery((prev) => ({ ...prev, downloaded_at: new Date().toISOString() }));
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <p style={{ color: '#888', fontSize: 15 }}>Loading your files…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
              Link Unavailable
            </h2>
            <p style={{ color: '#888', fontSize: 15, maxWidth: 340, margin: '0 auto' }}>{error}</p>
          </div>
        </div>
        <p style={{ color: '#444', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
          Powered by{' '}
          <a href="https://lenstrybe.com" style={{ color: '#39ff14', textDecoration: 'none' }}>
            LensTrybe
          </a>
        </p>
      </div>
    );
  }

  const fileCount = Array.isArray(delivery.files) ? delivery.files.length : 0;

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Creative header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 28,
            paddingBottom: 24,
            borderBottom: '1px solid #2a2a2a',
          }}
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.business_name}
              style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#252525',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              📷
            </div>
          )}
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
              {profile?.business_name || 'Your photographer'}
            </div>
            {profile?.tagline && (
              <div style={{ color: '#666', fontSize: 13, marginTop: 2 }}>{profile.tagline}</div>
            )}
          </div>
        </div>

        {/* Title block */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#39ff1422',
              color: '#39ff14',
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            📦 FILES READY
          </div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>
            {delivery.title}
          </h1>
          <p style={{ color: '#888', fontSize: 14, margin: 0 }}>
            {fileCount} file{fileCount !== 1 ? 's' : ''} for{' '}
            {delivery.client_name || delivery.client_email}
          </p>
          {delivery.expires_at && (
            <p style={{ color: '#555', fontSize: 13, marginTop: 6 }}>
              Link expires {formatDate(delivery.expires_at)}
            </p>
          )}
        </div>

        {/* Personal message */}
        {delivery.message && (
          <div
            style={{
              background: '#252525',
              border: '1px solid #333',
              borderRadius: 12,
              padding: '16px 18px',
              marginBottom: 24,
              color: '#ccc',
              fontSize: 14,
              lineHeight: 1.7,
            }}
          >
            {delivery.message}
          </div>
        )}

        {/* Download All button */}
        <button
          onClick={handleDownloadAll}
          disabled={downloading || fileCount === 0}
          style={{
            width: '100%',
            background: downloaded ? '#252525' : '#39ff14',
            color: downloaded ? '#39ff14' : '#0a0a0a',
            border: downloaded ? '1px solid #39ff14' : 'none',
            borderRadius: 12,
            padding: '16px',
            fontSize: 16,
            fontWeight: 800,
            cursor: downloading || fileCount === 0 ? 'not-allowed' : 'pointer',
            marginBottom: 20,
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {downloading ? (
            '⏳ Starting downloads…'
          ) : downloaded ? (
            '✓ Downloaded!'
          ) : (
            <>⬇ Download All {fileCount > 1 ? `(${fileCount} files)` : 'File'}</>
          )}
        </button>

        {/* Individual files */}
        {fileCount > 1 && (
          <div>
            <div
              style={{
                color: '#555',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 10,
              }}
            >
              Or download individually
            </div>
            {delivery.files.map((file, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#1e1e1e',
                  border: '1px solid #2a2a2a',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>
                    {/\.(jpg|jpeg|png|gif|webp|heic)$/i.test(file.name)
                      ? '🖼'
                      : /\.(mp4|mov|avi)$/i.test(file.name)
                      ? '🎬'
                      : /\.zip$/i.test(file.name)
                      ? '🗜'
                      : '📄'}
                  </span>
                  <div>
                    <div style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 500 }}>
                      {file.name}
                    </div>
                    {file.size && (
                      <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>
                        {formatSize(file.size)}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadSingle(file)}
                  style={{
                    background: '#252525',
                    color: '#39ff14',
                    border: '1px solid #39ff1444',
                    padding: '7px 14px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  ⬇ Download
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Already downloaded notice */}
        {delivery.downloaded_at && !downloaded && (
          <p style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 16 }}>
            Previously downloaded on {formatDate(delivery.downloaded_at)}
          </p>
        )}
      </div>

      <p style={{ color: '#333', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
        Secure file delivery by{' '}
        <a href="https://lenstrybe.com" style={{ color: '#39ff14', textDecoration: 'none' }}>
          LensTrybe
        </a>
      </p>
    </div>
  );
}

const pageStyle = {
  minHeight: '100vh',
  background: '#0a0a0a',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 16px',
};

const cardStyle = {
  width: '100%',
  maxWidth: 520,
  background: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: 20,
  padding: '32px',
};
