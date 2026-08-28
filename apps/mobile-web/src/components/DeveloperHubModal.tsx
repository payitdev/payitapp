import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Webhook,
  Terminal,
  FileCode,
  Copy,
  Check,
  Plus,
  Trash2,
  Send,
  Shield,
  Activity,
  AlertCircle,
  Code2,
} from 'lucide-react';

interface DeveloperHubModalProps {
  entityId: string;
  entityName?: string;
  onClose: () => void;
  token?: string;
}

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

export const DeveloperHubModal: React.FC<DeveloperHubModalProps> = ({
  entityId,
  entityName = 'Business Entity',
  onClose,
  token,
}) => {
  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks' | 'logs' | 'docs'>('keys');
  const [keysList, setKeysList] = useState<any[]>([]);
  const [webhooksList, setWebhooksList] = useState<any[]>([]);
  const [logsList, setLogsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // New Key Generation State
  const [showGenerateKeyModal, setShowGenerateKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyEnv, setNewKeyEnv] = useState<'live' | 'test'>('live');
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(null);

  // Webhook Registration State
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [isSendingTestWebhook, setIsSendingTestWebhook] = useState(false);

  // Copy Feedback
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quickstart Lang
  const [docLang, setDocLang] = useState<'curl' | 'node' | 'python'>('curl');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    showToast(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const fetchKeys = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/developer/keys?entityId=${encodeURIComponent(entityId)}`);
      const data = await res.json();
      if (data.success) setKeysList(data.keys || []);
    } catch {}
  };

  const fetchWebhooks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/developer/webhooks?entityId=${encodeURIComponent(entityId)}`);
      const data = await res.json();
      if (data.success) setWebhooksList(data.webhooks || []);
    } catch {}
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/developer/logs?entityId=${encodeURIComponent(entityId)}`);
      const data = await res.json();
      if (data.success) setLogsList(data.logs || []);
    } catch {}
  };

  useEffect(() => {
    fetchKeys();
    fetchWebhooks();
    fetchLogs();
  }, [entityId]);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/developer/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          name: newKeyName.trim(),
          environment: newKeyEnv,
        }),
      });
      const data = await res.json();
      if (data.success && data.apiKey) {
        setNewlyCreatedSecret(data.apiKey.secretKey);
        fetchKeys();
      } else {
        alert(data.error || 'Failed to generate API key.');
      }
    } catch {
      alert('Error generating API key.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? Applications using this key will immediately fail.')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/developer/keys/${keyId}?entityId=${encodeURIComponent(entityId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showToast('API key revoked.');
        fetchKeys();
      }
    } catch {
      alert('Failed to revoke API key.');
    }
  };

  const handleRegisterWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim() || !webhookUrl.startsWith('https://')) {
      alert('Please enter a valid HTTPS webhook URL.');
      return;
    }
    setIsSavingWebhook(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/developer/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          url: webhookUrl.trim(),
          events: ['invoice.paid', 'payout.completed', 'deposit.detected', 'treasury.swept'],
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Webhook endpoint registered!');
        setWebhookUrl('');
        fetchWebhooks();
      } else {
        alert(data.error || 'Failed to register webhook.');
      }
    } catch {
      alert('Error saving webhook.');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    setIsSendingTestWebhook(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/developer/webhooks/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, event: 'invoice.paid' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('⚡ Test webhook event dispatched with HMAC signature!');
      } else {
        alert(data.error || 'Failed to dispatch test webhook.');
      }
    } catch {
      alert('Error testing webhook.');
    } finally {
      setIsSendingTestWebhook(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,24,0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 16 }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: 780, maxHeight: '90vh', background: '#091E1B', color: '#F7F8F4', borderRadius: 24, border: '1px solid rgba(53, 217, 208, 0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', fontFamily: "'Satoshi', sans-serif" }}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(53, 217, 208, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#35D9D0' }}>
              <Code2 size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: '-0.3px' }}>Developer & BaaS Platform</h2>
              <div style={{ fontSize: 12, color: 'rgba(247, 248, 244, 0.6)' }}>{entityName} · API Keys, Webhooks & 10-Chain Infrastructure</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#F7F8F4', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
          {[
            { key: 'keys', label: 'API Keys', icon: <Key size={15} /> },
            { key: 'webhooks', label: 'Webhooks', icon: <Webhook size={15} /> },
            { key: 'logs', label: 'Request Logs', icon: <Activity size={15} /> },
            { key: 'docs', label: 'API Quickstart', icon: <Terminal size={15} /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 10,
                border: activeTab === tab.key ? '1px solid #35D9D0' : '1px solid transparent',
                background: activeTab === tab.key ? 'rgba(53, 217, 208, 0.15)' : 'transparent',
                color: activeTab === tab.key ? '#35D9D0' : 'rgba(247, 248, 244, 0.65)',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          
          {/* ===== TAB 1: API KEYS ===== */}
          {activeTab === 'keys' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Active API Secret Keys</h3>
                  <div style={{ fontSize: 12, color: 'rgba(247, 248, 244, 0.6)' }}>Authenticate backend requests using Bearer secret tokens.</div>
                </div>
                <button
                  onClick={() => { setShowGenerateKeyModal(true); setNewlyCreatedSecret(null); setNewKeyName(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#35D9D0', color: '#050811', border: 'none', padding: '8px 16px', borderRadius: 999, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                >
                  <Plus size={14} /> Generate New Key
                </button>
              </div>

              {/* Keys List */}
              {keysList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <Key size={36} color="#35D9D0" style={{ marginBottom: 10, opacity: 0.8 }} />
                  <div style={{ fontSize: 13, fontWeight: 700 }}>No API Keys Generated Yet</div>
                  <div style={{ fontSize: 12, color: 'rgba(247, 248, 244, 0.5)', marginTop: 4 }}>Generate an API secret key to programmatically issue invoices, batch salaries, or derive multi-chain wallets.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {keysList.map(key => (
                    <div key={key.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 13.5 }}>{key.name}</span>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: key.environment === 'live' ? 'rgba(53, 217, 208, 0.2)' : 'rgba(251, 191, 36, 0.2)', color: key.environment === 'live' ? '#35D9D0' : '#FBBF24', fontWeight: 800, textTransform: 'uppercase' }}>
                            {key.environment}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                          <code style={{ fontSize: 11.5, color: '#35D9D0', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace' }}>
                            {key.keyPrefix}••••••••••••••••••••••••••••••••
                          </code>
                          <span style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.4)' }}>
                            Created {new Date(key.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeKey(key.id)}
                        style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Trash2 size={12} /> Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== TAB 2: WEBHOOKS ===== */}
          {activeTab === 'webhooks' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Webhook Endpoints</h3>
                <div style={{ fontSize: 12, color: 'rgba(247, 248, 244, 0.6)' }}>Receive real-time signed HTTP POST notifications when invoices are settled, salaries are disbursed, or deposits arrive.</div>
              </div>

              {/* Add Webhook Form */}
              <form onSubmit={handleRegisterWebhook} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#35D9D0' }}>Register New HTTPS Webhook URL</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="url"
                    placeholder="https://api.yourdomain.com/webhooks/proxim"
                    value={webhookUrl}
                    onChange={e => setWebhookUrl(e.target.value)}
                    required
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, outline: 'none' }}
                  />
                  <button
                    type="submit"
                    disabled={isSavingWebhook}
                    style={{ background: '#35D9D0', color: '#050811', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}
                  >
                    {isSavingWebhook ? 'Saving…' : 'Register'}
                  </button>
                </div>
              </form>

              {/* Webhooks List */}
              {webhooksList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <Webhook size={32} color="#35D9D0" style={{ marginBottom: 10, opacity: 0.8 }} />
                  <div style={{ fontSize: 13, fontWeight: 700 }}>No Webhooks Configured</div>
                  <div style={{ fontSize: 12, color: 'rgba(247, 248, 244, 0.5)', marginTop: 4 }}>Add a webhook endpoint above to listen for automated platform events.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {webhooksList.map(wh => (
                    <div key={wh.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(53, 217, 208, 0.2)', borderRadius: 14, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#ffffff' }}>{wh.url}</div>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(34, 197, 94, 0.2)', color: '#4ADE80', fontWeight: 800 }}>ACTIVE</span>
                      </div>
                      <div style={{ marginTop: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 11, color: 'rgba(247,248,244,0.5)', marginRight: 8 }}>Signing Secret:</span>
                          <code style={{ fontSize: 11.5, color: '#35D9D0', fontFamily: 'monospace' }}>{wh.secret}</code>
                        </div>
                        <button onClick={() => copyToClipboard(wh.secret, 'Webhook secret')} style={{ background: 'none', border: 'none', color: '#35D9D0', cursor: 'pointer' }}>
                          <Copy size={13} />
                        </button>
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 11, color: 'rgba(247,248,244,0.5)' }}>Events: invoice.paid, payout.completed, deposit.detected, treasury.swept</div>
                        <button
                          onClick={handleTestWebhook}
                          disabled={isSendingTestWebhook}
                          style={{ background: 'rgba(53, 217, 208, 0.15)', border: '1px solid #35D9D0', color: '#35D9D0', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Send size={11} /> {isSendingTestWebhook ? 'Dispatching…' : 'Send Test Ping'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== TAB 3: REQUEST LOGS ===== */}
          {activeTab === 'logs' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Real-Time API Telemetry</h3>
                  <div style={{ fontSize: 12, color: 'rgba(247, 248, 244, 0.6)' }}>Inspect recent HTTP requests, response status codes, and execution latencies.</div>
                </div>
                <button onClick={fetchLogs} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                  ↻ Refresh
                </button>
              </div>

              {logsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <Activity size={32} color="#35D9D0" style={{ marginBottom: 10, opacity: 0.8 }} />
                  <div style={{ fontSize: 13, fontWeight: 700 }}>No API Activity Logged Yet</div>
                  <div style={{ fontSize: 12, color: 'rgba(247, 248, 244, 0.5)', marginTop: 4 }}>Requests authenticated with your API keys will show up here in real time.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {logsList.map(log => (
                    <div key={log.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, background: log.method === 'POST' ? 'rgba(53, 217, 208, 0.2)' : 'rgba(74, 140, 255, 0.2)', color: log.method === 'POST' ? '#35D9D0' : '#4A8CFF', fontWeight: 800 }}>
                          {log.method}
                        </span>
                        <code style={{ fontSize: 12, color: '#F7F8F4' }}>{log.endpoint}</code>
                        <span style={{ fontSize: 11, color: log.statusCode < 400 ? '#4ADE80' : '#EF4444', fontWeight: 800 }}>
                          {log.statusCode}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'rgba(247, 248, 244, 0.5)' }}>
                        <span>{log.durationMs}ms</span>
                        <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== TAB 4: API QUICKSTART & DOCS ===== */}
          {activeTab === 'docs' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Integration Quickstart</h3>
                  <div style={{ fontSize: 12, color: 'rgba(247, 248, 244, 0.6)' }}>Interactive code recipes to integrate Proxim into your application.</div>
                </div>
                <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 8 }}>
                  {(['curl', 'node', 'python'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setDocLang(lang)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: docLang === lang ? '#35D9D0' : 'transparent',
                        color: docLang === lang ? '#050811' : 'rgba(247,248,244,0.6)',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                      }}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Endpoint 1: Create Invoice */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#35D9D0' }}>1. Create Multi-Rail Invoice (POST /v1/invoices)</div>
                  <button
                    onClick={() => {
                      const snippet = docLang === 'curl'
                        ? `curl -X POST https://api.proxim.finance/v1/invoices \\\n  -H "Authorization: Bearer px_live_sk_YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "clientName": "Acme Corp",\n    "clientEmail": "billing@acme.com",\n    "totalAmount": 2500.00,\n    "currency": "USD",\n    "settlementType": "crypto",\n    "cryptoNetwork": "Base"\n  }'`
                        : docLang === 'node'
                        ? `const res = await fetch('https://api.proxim.finance/v1/invoices', {\n  method: 'POST',\n  headers: {\n    'Authorization': 'Bearer px_live_sk_YOUR_KEY',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({\n    clientName: 'Acme Corp',\n    clientEmail: 'billing@acme.com',\n    totalAmount: 2500.00,\n    currency: 'USD',\n    settlementType: 'crypto',\n    cryptoNetwork: 'Base'\n  })\n});\nconst invoice = await res.json();`
                        : `import requests\n\nres = requests.post(\n    'https://api.proxim.finance/v1/invoices',\n    headers={'Authorization': 'Bearer px_live_sk_YOUR_KEY'},\n    json={\n        'clientName': 'Acme Corp',\n        'clientEmail': 'billing@acme.com',\n        'totalAmount': 2500.00,\n        'currency': 'USD',\n        'settlementType': 'crypto',\n        'cryptoNetwork': 'Base'\n    }\n)\nprint(res.json())`;
                      copyToClipboard(snippet, 'Code snippet');
                    }}
                    style={{ background: 'none', border: 'none', color: '#35D9D0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
                <pre style={{ margin: 0, padding: 12, borderRadius: 8, background: '#050c0b', color: '#35D9D0', fontSize: 11.5, overflowX: 'auto', fontFamily: 'monospace' }}>
                  {docLang === 'curl'
                    ? `curl -X POST https://api.proxim.finance/v1/invoices \\\n  -H "Authorization: Bearer px_live_sk_YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "clientName": "Acme Corp",\n    "clientEmail": "billing@acme.com",\n    "totalAmount": 2500.00,\n    "currency": "USD",\n    "settlementType": "crypto",\n    "cryptoNetwork": "Base"\n  }'`
                    : docLang === 'node'
                    ? `const res = await fetch('https://api.proxim.finance/v1/invoices', {\n  method: 'POST',\n  headers: {\n    'Authorization': 'Bearer px_live_sk_YOUR_KEY',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({\n    clientName: 'Acme Corp',\n    clientEmail: 'billing@acme.com',\n    totalAmount: 2500.00,\n    currency: 'USD',\n    settlementType: 'crypto',\n    cryptoNetwork: 'Base'\n  })\n});\nconst invoice = await res.json();`
                    : `import requests\n\nres = requests.post(\n    'https://api.proxim.finance/v1/invoices',\n    headers={'Authorization': 'Bearer px_live_sk_YOUR_KEY'},\n    json={\n        'clientName': 'Acme Corp',\n        'clientEmail': 'billing@acme.com',\n        'totalAmount': 2500.00,\n        'currency': 'USD',\n        'settlementType': 'crypto',\n        'cryptoNetwork': 'Base'\n    }\n)\nprint(res.json())`}
                </pre>
              </div>

              {/* Endpoint 2: Derive 10-Chain Wallet */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#35D9D0' }}>2. Derive 10-Chain MPC Wallets (POST /v1/wallets/derive)</div>
                  <button
                    onClick={() => {
                      const snippet = `curl -X POST https://api.proxim.finance/v1/wallets/derive \\\n  -H "Authorization: Bearer px_live_sk_YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"customerId": "usr_94821"}'`;
                      copyToClipboard(snippet, 'Wallet derive snippet');
                    }}
                    style={{ background: 'none', border: 'none', color: '#35D9D0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
                <pre style={{ margin: 0, padding: 12, borderRadius: 8, background: '#050c0b', color: '#35D9D0', fontSize: 11.5, overflowX: 'auto', fontFamily: 'monospace' }}>
                  {`curl -X POST https://api.proxim.finance/v1/wallets/derive \\\n  -H "Authorization: Bearer px_live_sk_YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"customerId": "usr_94821"}'`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Generate Key Submodal */}
        {showGenerateKeyModal && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 130 }}>
            <div style={{ background: '#091E1B', border: '1px solid #35D9D0', borderRadius: 20, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
              
              {!newlyCreatedSecret ? (
                <form onSubmit={handleGenerateKey}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>Create API Secret Key</h3>
                  <div style={{ fontSize: 12, color: 'rgba(247,248,244,0.6)', marginBottom: 16 }}>Choose an environment and identifier for this key.</div>
                  
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#35D9D0', marginBottom: 6 }}>Key Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Production Backend, Invoicing Bot"
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#35D9D0', marginBottom: 6 }}>Environment</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setNewKeyEnv('live')}
                        style={{ padding: '10px', borderRadius: 10, border: newKeyEnv === 'live' ? '1px solid #35D9D0' : '1px solid rgba(255,255,255,0.1)', background: newKeyEnv === 'live' ? 'rgba(53, 217, 208, 0.2)' : 'transparent', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      >
                        🟢 Live Production
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewKeyEnv('test')}
                        style={{ padding: '10px', borderRadius: 10, border: newKeyEnv === 'test' ? '1px solid #FBBF24' : '1px solid rgba(255,255,255,0.1)', background: newKeyEnv === 'test' ? 'rgba(251, 191, 36, 0.2)' : 'transparent', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      >
                        🟡 Test Sandbox
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={() => setShowGenerateKeyModal(false)} style={{ flex: 1, padding: 12, borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={isLoading} style={{ flex: 1, padding: 12, borderRadius: 12, background: '#35D9D0', border: 'none', color: '#050811', fontWeight: 900, cursor: 'pointer' }}>
                      {isLoading ? 'Generating…' : 'Generate Key'}
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4ADE80', marginBottom: 8 }}>
                    <Check size={20} />
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Save Your Secret Key</h3>
                  </div>
                  <p style={{ fontSize: 12, color: 'rgba(247,248,244,0.7)', margin: '0 0 14px' }}>
                    Please copy this secret key now and store it in a secure environment variable. <strong>You will not be able to view it again.</strong>
                  </p>

                  <div style={{ background: '#050c0b', border: '1px solid #35D9D0', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                    <code style={{ fontSize: 12, color: '#35D9D0', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                      {newlyCreatedSecret}
                    </code>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => copyToClipboard(newlyCreatedSecret, 'API Secret Key')}
                      style={{ flex: 1, padding: 12, borderRadius: 12, background: '#35D9D0', border: 'none', color: '#050811', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Copy size={14} /> Copy Secret Key
                    </button>
                    <button
                      onClick={() => { setShowGenerateKeyModal(false); setNewlyCreatedSecret(null); }}
                      style={{ padding: '12px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating Toast */}
        {toastMessage && (
          <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: '#35D9D0', color: '#050811', padding: '10px 20px', borderRadius: 12, fontWeight: 800, fontSize: 12, zIndex: 9999, boxShadow: '0 4px 20px rgba(53, 217, 208, 0.4)' }}>
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
};
