import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { GLASS_CARD, GLASS_CARD_GREEN, GLASS_MODAL_PANEL, GLASS_MODAL_OVERLAY_BASE, GLASS_NATIVE_FIELD, DIVIDER_GRADIENT_STYLE, TYPO, glassCardAccentBorder } from '../../lib/glassTokens'
import Button from '../../components/ui/Button'

const COLORS = {
  bg: '#0a0a0f',
  panel: '#111118',
  panelAlt: '#16161f',
  border: '#1e1e2e',
  green: '#1DB954',
  greenDim: 'rgba(29,185,84,0.12)',
  pink: '#FF2D78',
  pinkDim: 'rgba(255,45,120,0.12)',
  white: '#ffffff',
  muted: '#8888aa',
  dim: '#444466',
  lumiGrad: 'linear-gradient(135deg, #1DB954 0%, #FF2D78 100%)',
};

const FONT = { fontFamily: 'Inter, sans-serif' };

const QUICK_PROMPTS = [
  { icon: '💰', label: 'Help me price a project' },
  { icon: '📄', label: 'Write a client proposal' },
  { icon: '📅', label: 'How to follow up on overdue invoices' },
  { icon: '📈', label: 'Tips to attract more clients' },
];

const TIER_CONFIG = {
  basic: { monthly: 0, daily: 0 },
  pro: { monthly: 5, daily: 3 },
  expert: { monthly: 100, daily: 25 },
  elite: { monthly: null, daily: 50 },
};

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function MarkdownText({ text }) {
  const parsed = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:#1e1e2e;padding:1px 5px;border-radius:4px;font-size:0.9em">$1</code>')
    .replace(/\n/g, '<br/>');
  return (
    <span style={{ lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: parsed }} />
  );
}

function ConvoMenu({ convo, onRename, onPin, onDelete, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const items = [
    {
      icon: '📌',
      label: convo.pinned ? 'Unpin' : 'Pin',
      onClick: () => { onPin(convo); onClose(); },
    },
    {
      icon: '✏️',
      label: 'Rename',
      onClick: () => { onRename(convo); onClose(); },
    },
    {
      icon: '🗑️',
      label: 'Delete',
      onClick: () => { onDelete(convo.id); onClose(); },
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: 28,
        right: 0,
        background: '#1e1e2e',
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: '4px',
        zIndex: 100,
        minWidth: 150,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            borderRadius: 7,
            color: item.danger ? COLORS.pink : COLORS.white,
            fontSize: 13,
            cursor: 'pointer',
            textAlign: 'left',
            ...FONT,
          }}
        >
          <span style={{ fontSize: 14 }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function LumiPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tier, setTier] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConvoId, setActiveConvoId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [usage, setUsage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const renameInputRef = useRef(null);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/login'); return; }
      setUser(session.user);
    });
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('subscription_tier, business_name, tagline')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setTier((data.subscription_tier || 'basic').toLowerCase());
        } else {
          setTier('basic');
        }
      });
  }, [user]);

  const callEdge = useCallback(async (body) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${supabaseUrl}/functions/v1/lumi-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }, [supabaseUrl]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConvos(true);
    try {
      const data = await callEdge({ action: 'load_conversations' });
      setConversations(data.conversations || []);
    } catch (e) {
      console.error('Failed to load conversations', e);
    } finally {
      setLoadingConvos(false);
    }
  }, [user, callEdge]);

  useEffect(() => {
    if (user) loadConversations();
  }, [user, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  function openConversation(convo) {
    if (renamingId) return;
    setActiveConvoId(convo.id);
    setMessages(convo.messages || []);
  }

  async function startNewConversation() {
    setActiveConvoId(null);
    setMessages([]);
    inputRef.current?.focus();
  }

  async function handleDelete(convoId) {
    setConversations(prev => prev.filter(c => c.id !== convoId));
    if (activeConvoId === convoId) {
      setActiveConvoId(null);
      setMessages([]);
    }
    try {
      await callEdge({ action: 'delete_conversation', conversationId: convoId });
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  }

  function startRename(convo) {
    setRenamingId(convo.id);
    setRenameValue(convo.title || '');
  }

  async function commitRename(convoId) {
    const newTitle = renameValue.trim() || 'Untitled';
    setConversations(prev => prev.map(c => c.id === convoId ? { ...c, title: newTitle } : c));
    setRenamingId(null);
    try {
      await callEdge({ action: 'rename_conversation', conversationId: convoId, title: newTitle });
    } catch (err) {
      console.error('Failed to rename conversation', err);
    }
  }

  function handleRenameKeyDown(e, convoId) {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(convoId); }
    if (e.key === 'Escape') { setRenamingId(null); }
  }

  async function handlePin(convo) {
    const newPinned = !convo.pinned;
    setConversations(prev => {
      const updated = prev.map(c => c.id === convo.id ? { ...c, pinned: newPinned } : c);
      return [...updated.filter(c => c.pinned), ...updated.filter(c => !c.pinned)];
    });
    try {
      await callEdge({ action: 'pin_conversation', conversationId: convo.id, pinned: newPinned });
    } catch (err) {
      console.error('Failed to pin conversation', err);
    }
  }

  async function sendMessage(text) {
    const msg = (text || input).trim();
    if (!msg || sending) return;
    if (tier === 'basic') return;

    setInput('');
    setSending(true);

    const optimisticUser = { role: 'user', content: msg };
    setMessages(prev => [...prev, optimisticUser]);

    try {
      const data = await callEdge({ message: msg, conversationId: activeConvoId });

      if (data.error) {
        const errMsg = data.error === 'monthly_limit_reached'
          ? `You have reached your monthly limit of ${data.limit} messages. Your limit resets next month.`
          : data.error === 'daily_limit_reached'
          ? `You have reached your daily limit of ${data.limit} messages. Come back tomorrow!`
          : 'Something went wrong. Please try again.';
        setMessages(prev => [...prev, { role: 'error', content: errMsg }]);
        setSending(false);
        return;
      }

      if (data.reply) setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.usage) setUsage(data.usage);

      const newId = data.conversationId;
      if (newId && newId !== activeConvoId) {
        setActiveConvoId(newId);
        const newConvo = {
          id: newId,
          title: data.title || msg.substring(0, 60),
          updated_at: new Date().toISOString(),
          pinned: false,
          messages: [optimisticUser, { role: 'assistant', content: data.reply }],
        };
        setConversations(prev => [newConvo, ...prev]);
      } else if (newId) {
        setConversations(prev => prev.map(c =>
          c.id === newId
            ? { ...c, updated_at: new Date().toISOString(), messages: [...(c.messages || []), optimisticUser, { role: 'assistant', content: data.reply }] }
            : c
        ));
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', content: 'Connection error. Please try again.' }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.basic;
  const isLocked = tier !== null && tier === 'basic';
  const usedMonthly = usage?.monthly || 0;
  const monthlyLimit = tierConfig.monthly;
  const usagePercent = monthlyLimit ? Math.min(100, (usedMonthly / monthlyLimit) * 100) : 0;
  const hasMessages = messages.length > 0;

  const pinnedConvos = conversations.filter(c => c.pinned);
  const unpinnedConvos = conversations.filter(c => !c.pinned);

  function renderConvoItem(convo) {
    const isActive = activeConvoId === convo.id;
    const isRenaming = renamingId === convo.id;
    const isMenuOpen = openMenuId === convo.id;

    return (
      <div
        key={convo.id}
        onClick={() => openConversation(convo)}
        style={{
          padding: '8px 10px',
          borderRadius: 8,
          cursor: 'pointer',
          background: isActive ? COLORS.greenDim : 'transparent',
          border: `1px solid ${isActive ? COLORS.green : 'transparent'}`,
          marginBottom: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          position: 'relative',
          transition: 'background 0.15s',
        }}
      >
        {convo.pinned && (
          <span style={{ fontSize: 10, opacity: 0.5, flexShrink: 0 }}>📌</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => handleRenameKeyDown(e, convo.id)}
              onBlur={() => commitRename(convo.id)}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                background: '#0a0a0f',
                border: `1px solid ${COLORS.green}`,
                borderRadius: 4,
                padding: '2px 6px',
                color: COLORS.white,
                fontSize: 12,
                outline: 'none',
                boxSizing: 'border-box',
                ...FONT,
              }}
            />
          ) : (
            <div style={{
              fontSize: 12,
              fontWeight: 500,
              color: isActive ? COLORS.green : COLORS.white,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {convo.title || 'Conversation'}
            </div>
          )}
          {!isRenaming && (
            <div style={{ fontSize: 11, color: COLORS.dim, marginTop: 1 }}>
              {formatRelativeTime(convo.updated_at)}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={e => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : convo.id); }}
          aria-label="Conversation options"
          className="convo-menu-btn"
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.muted,
            cursor: 'pointer',
            fontSize: 16,
            padding: '1px 4px',
            borderRadius: 4,
            flexShrink: 0,
            lineHeight: 1,
            opacity: isActive || isMenuOpen ? 1 : 0,
            ...FONT,
          }}
        >
          ···
        </button>

        {isMenuOpen && (
          <ConvoMenu
            convo={convo}
            onRename={startRename}
            onPin={handlePin}
            onDelete={handleDelete}
            onClose={() => setOpenMenuId(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'transparent', ...FONT }}>

      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? 260 : 0,
        minWidth: sidebarOpen ? 260 : 0,
        transition: 'width 0.2s ease, min-width 0.2s ease',
        overflow: 'hidden',
        ...GLASS_CARD,
        borderRadius: 0,
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.white }}>Conversations</span>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={startNewConversation}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              color: COLORS.green,
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              ...FONT,
            }}
          >
            <span>+</span> New conversation
          </Button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
          {loadingConvos ? (
            <div style={{ padding: '24px 8px', textAlign: 'center', color: COLORS.dim, fontSize: 12 }}>
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '24px 8px', textAlign: 'center', color: COLORS.dim, fontSize: 12 }}>
              No conversations yet
            </div>
          ) : (
            <>
              {pinnedConvos.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.dim, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 10px 6px' }}>
                    Pinned
                  </div>
                  {pinnedConvos.map(renderConvoItem)}
                  {unpinnedConvos.length > 0 && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.dim, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 10px 6px' }}>
                      Recent
                    </div>
                  )}
                </>
              )}
              {unpinnedConvos.map(renderConvoItem)}
            </>
          )}
        </div>

        {!isLocked && monthlyLimit !== null && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: COLORS.muted }}>Monthly messages</span>
              <span style={{ fontSize: 11, color: COLORS.muted }}>{usedMonthly} / {monthlyLimit}</span>
            </div>
            <div style={{ height: 4, background: COLORS.border, borderRadius: 2 }}>
              <div style={{
                height: '100%',
                borderRadius: 2,
                background: usagePercent > 85 ? COLORS.pink : COLORS.green,
                width: `${usagePercent}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          ...GLASS_CARD,
          borderRadius: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={() => setSidebarOpen(o => !o)}
            style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer', fontSize: 18, padding: '2px 6px', borderRadius: 6, ...FONT }}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: COLORS.lumiGrad,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
          }}>
            ✨
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.white }}>Lumi AI</div>
            <div style={{ fontSize: 11, color: COLORS.muted }}>Your LensTrybe business assistant</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
              background: isLocked ? COLORS.dim + '33' : COLORS.greenDim,
              color: isLocked ? COLORS.dim : COLORS.green,
              border: `1px solid ${isLocked ? COLORS.dim : COLORS.green}`,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {tier || '...'}
            </span>
          </div>
        </div>

        {/* Locked state */}
        {isLocked ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ maxWidth: 420, textAlign: 'center', padding: 40, ...GLASS_CARD, borderRadius: 16 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.white, marginBottom: 8 }}>Meet Lumi</div>
              <div style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.6, marginBottom: 24 }}>
                Lumi is your AI business assistant. Get help with pricing, client proposals, contracts, and growing your creative business. Available on Pro and above.
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={() => navigate('/dashboard/settings/billing')}
                style={{ padding: '12px 28px', borderRadius: 10, color: COLORS.white, fontSize: 14, fontWeight: 700, ...FONT }}
              >
                Upgrade to unlock Lumi
              </Button>
            </div>
          </div>
        ) : tier === null ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: COLORS.dim, fontSize: 13 }}>Loading...</div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {!hasMessages && (
                <div style={{ maxWidth: 560, margin: '0 auto', width: '100%', paddingTop: 20 }}>
                  <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%', background: COLORS.lumiGrad,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 14px',
                    }}>
                      ✨
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.white, marginBottom: 6 }}>
                      Hi{profile?.business_name ? `, ${profile.business_name.split(' ')[0]}` : ''}! I am Lumi.
                    </div>
                    <div style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.6 }}>
                      Your AI business assistant. Ask me anything about running your creative business.
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {QUICK_PROMPTS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => sendMessage(p.label)}
                        style={{
                          padding: '12px 14px', ...GLASS_CARD,
                          borderRadius: 10, color: COLORS.white, fontSize: 13, cursor: 'pointer',
                          textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, ...FONT,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{p.icon}</span>
                        <span style={{ color: COLORS.muted, lineHeight: 1.4 }}>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                const isError = msg.role === 'error';
                return (
                  <div key={i} style={{
                    display: 'flex', gap: 10,
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    alignItems: 'flex-start', maxWidth: '80%',
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                  }}>
                    {!isUser && (
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: isError ? COLORS.pinkDim : COLORS.lumiGrad,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, flexShrink: 0, marginTop: 2,
                      }}>
                        {isError ? '!' : '✨'}
                      </div>
                    )}
                    <div style={{
                      ...(isUser ? GLASS_CARD_GREEN : isError ? glassCardAccentBorder(COLORS.pink) : GLASS_CARD),
                      padding: '11px 15px',
                      borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      fontSize: 14, color: isError ? COLORS.pink : COLORS.white, lineHeight: 1.6, maxWidth: '100%',
                    }}>
                      {isUser ? msg.content : <MarkdownText text={msg.content} />}
                    </div>
                  </div>
                );
              })}

              {sending && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', alignSelf: 'flex-start' }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', background: COLORS.lumiGrad,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                  }}>✨</div>
                  <div style={{
                    padding: '14px 18px', ...GLASS_CARD,
                    borderRadius: '14px 14px 14px 4px', display: 'flex', gap: 5, alignItems: 'center',
                  }}>
                    {[0, 1, 2].map(j => (
                      <div key={j} style={{
                        width: 6, height: 6, borderRadius: '50%', background: COLORS.muted,
                        animation: `lumiPulse 1.2s ease-in-out ${j * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', ...GLASS_CARD, borderRadius: 0, flexShrink: 0 }}>
              <div style={{
                display: 'flex', gap: 10, alignItems: 'flex-end',
                ...GLASS_CARD,
                borderRadius: 12, padding: '8px 12px',
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Lumi anything about your business..."
                  rows={1}
                  style={{
                    ...GLASS_NATIVE_FIELD,
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: COLORS.white, fontSize: 14, resize: 'none', lineHeight: 1.5,
                    maxHeight: 120, overflowY: 'auto', ...FONT,
                  }}
                />
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || sending}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: input.trim() && !sending ? COLORS.green : COLORS.border,
                    border: 'none',
                    color: input.trim() && !sending ? '#000' : COLORS.dim,
                    fontSize: 16, cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'background 0.15s',
                  }}
                  aria-label="Send message"
                >
                  ↑
                </button>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: COLORS.dim }}>
                {tier === 'elite'
                  ? 'Unlimited messages. Elite tier.'
                  : monthlyLimit !== null
                  ? `${monthlyLimit - usedMonthly} messages remaining this month`
                  : null}
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes lumiPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        div:hover > .convo-menu-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
